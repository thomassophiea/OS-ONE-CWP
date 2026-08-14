/**
 * Secure-onboarding session lifecycle.
 *
 * Two rules shape everything here.
 *
 * **A session only exists if the guest asked for one.** Nothing on the open
 * guest path creates a row. `create()` is reachable only from a request that
 * already carries an authorized portal session whose guest chose the secure
 * workflow.
 *
 * **`COMPLETED` means the gateway said so.** Every other status describes what
 * *we* did — generated a profile, drew a QR code, revealed a passphrase. None of
 * those is evidence a device joined anything, so none of them advances past
 * their own name. The only transition into `COMPLETED` is in `verifyJoin`,
 * which requires the station to appear on the secure WLAN's service id.
 */

import type { OnboardingSession, GuestSession } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { audit } from "@/lib/session/repository";
import { onboardingMaxChecks, onboardingTtlSeconds } from "@/lib/env";
import { normalizeMac } from "@/lib/captive/extractSessionFields";
import type { Platform } from "@/lib/onboarding/platform";
import { credentialProviderFor } from "@/lib/onboarding/providers";
import { hashOnboardingToken, newOnboardingToken } from "@/lib/onboarding/token";
import {
  GatewayUnavailableError,
  gatewayConfigured,
  readStations,
  type GatewayStation,
} from "@/lib/onboarding/gatewayClient";
import type { SecureNetwork } from "@/lib/onboarding/credentialProvider";

export type OnboardingStatusValue = OnboardingSession["status"];

/**
 * Statuses that describe an artifact having been handed over. Ranked so a guest
 * who views manual setup after downloading a profile does not appear to have
 * gone backwards.
 */
const ARTIFACT_RANK: Record<string, number> = {
  OFFERED: 0,
  STARTED: 1,
  MANUAL_SETUP_VIEWED: 2,
  QR_DISPLAYED: 2,
  PROFILE_DOWNLOADED: 3,
};

/** Terminal statuses never rewritten by an artifact hand-over. */
const TERMINAL = new Set(["COMPLETED", "FAILED", "EXPIRED"]);

export interface CreateOnboardingInput {
  session: GuestSession;
  platform: Platform;
  platformSource: string;
  network: SecureNetwork;
  sourceIp: string | null;
  userAgent: string | null;
}

export interface CreatedOnboarding {
  record: OnboardingSession;
  /** Raw token, for the cookie. Never persisted, never logged. */
  token: string;
}

export async function createOnboarding({
  session,
  platform,
  platformSource,
  network,
  sourceIp,
  userAgent,
}: CreateOnboardingInput): Promise<CreatedOnboarding> {
  const { token, hash } = newOnboardingToken();
  const provider = credentialProviderFor({
    clientMac: session.clientMac,
    sourceSsid: session.ssid,
  });

  const record = await prisma.onboardingSession.create({
    data: {
      tokenHash: hash,
      sessionId: session.id,
      clientMac: session.clientMac,
      clientMacRaw: session.clientMacRaw,
      clientIp: session.clientIp,
      sourceIp,
      userAgent,
      platform,
      platformSource,
      sourceSsid: session.ssid,
      sourceWlan: session.wlan,
      targetSsid: network.ssid,
      targetServiceId: network.serviceId,
      credentialProvider: provider.id,
      status: "STARTED",
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + onboardingTtlSeconds() * 1000),
    },
  });

  await audit(session.id, "SECURE_ONBOARDING_STARTED", "info", {
    onboardingSessionId: record.id,
    clientMac: session.clientMac,
    platform,
    platformSource,
    sourceSsid: session.ssid,
    targetSsid: network.ssid,
    provider: provider.id,
  });

  return { record, token };
}

/**
 * Load an onboarding session and prove the caller owns it.
 *
 * The id alone is never sufficient — it travels in URLs. Returns null for
 * "no such session", "wrong token" and "expired" alike, so a caller cannot use
 * the difference to enumerate ids.
 */
export async function authorizeOnboarding(
  id: string,
  token: string | null | undefined
): Promise<OnboardingSession | null> {
  if (!id || !token) return null;

  let record: OnboardingSession | null;
  try {
    record = await prisma.onboardingSession.findUnique({ where: { id } });
  } catch (err) {
    log.error("onboarding_lookup_failed", { err });
    return null;
  }
  if (!record) return null;

  // Constant-time comparison of the hashes; `hashOnboardingToken` is applied to
  // the presented token rather than the stored one being reversed.
  const presented = Buffer.from(hashOnboardingToken(token), "utf8");
  const stored = Buffer.from(record.tokenHash, "utf8");
  if (presented.length !== stored.length) return null;
  let diff = 0;
  for (let i = 0; i < presented.length; i += 1) diff |= presented[i] ^ stored[i];
  if (diff !== 0) return null;

  if (record.expiresAt.getTime() <= Date.now()) {
    if (!TERMINAL.has(record.status)) await markExpired(record.id);
    return null;
  }
  return record;
}

/** Record that a provisioning artifact was handed over. Never sets COMPLETED. */
export async function recordArtifact(
  record: OnboardingSession,
  status: "PROFILE_DOWNLOADED" | "QR_DISPLAYED" | "MANUAL_SETUP_VIEWED",
  method: OnboardingSession["method"]
): Promise<OnboardingSession> {
  const stampField =
    status === "PROFILE_DOWNLOADED"
      ? "profileRequestedAt"
      : status === "QR_DISPLAYED"
        ? "qrDisplayedAt"
        : "manualViewedAt";

  const keepStatus =
    TERMINAL.has(record.status) ||
    (ARTIFACT_RANK[record.status] ?? 0) > (ARTIFACT_RANK[status] ?? 0);

  const updated = await prisma.onboardingSession.update({
    where: { id: record.id },
    data: {
      status: keepStatus ? record.status : status,
      method,
      [stampField]: new Date(),
    },
  });

  await audit(record.sessionId, "SECURE_ONBOARDING_ARTIFACT_ISSUED", "info", {
    onboardingSessionId: record.id,
    clientMac: record.clientMac,
    platform: record.platform,
    method,
    // The status the *artifact* implies, distinct from the session's status,
    // so an audit reader can see both without inferring either.
    artifact: status,
    targetSsid: record.targetSsid,
  });

  return updated;
}

export async function markFailed(
  record: OnboardingSession,
  reason: string
): Promise<void> {
  await prisma.onboardingSession
    .update({
      where: { id: record.id },
      data: { status: "FAILED", failedAt: new Date(), failureReason: reason },
    })
    .catch((err) => log.error("onboarding_fail_update_failed", { err }));

  await audit(record.sessionId, "SECURE_ONBOARDING_FAILED", "warn", {
    onboardingSessionId: record.id,
    clientMac: record.clientMac,
    platform: record.platform,
    reason,
  });
}

async function markExpired(id: string): Promise<void> {
  await prisma.onboardingSession
    .update({ where: { id }, data: { status: "EXPIRED" } })
    .catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Join verification
// ---------------------------------------------------------------------------

/**
 * Shared station-list cache.
 *
 * The gateway question is "where is every station right now", not "where is
 * this one" — so one bulk read answers every onboarding in flight. With a short
 * TTL, ten guests polling every five seconds produce one gateway request every
 * few seconds in total rather than ten. This is what keeps a demo-scale feature
 * from becoming a load problem on the controller.
 */
const STATION_CACHE_MS = 6_000;
let stationCache: { at: number; stations: GatewayStation[] } | null = null;
let stationInFlight: Promise<GatewayStation[]> | null = null;

async function stations(): Promise<GatewayStation[]> {
  const now = Date.now();
  if (stationCache && now - stationCache.at < STATION_CACHE_MS) {
    return stationCache.stations;
  }
  // Collapse concurrent misses into one request.
  if (!stationInFlight) {
    stationInFlight = readStations()
      .then((list) => {
        stationCache = { at: Date.now(), stations: list };
        return list;
      })
      .finally(() => {
        stationInFlight = null;
      });
  }
  return stationInFlight;
}

export type VerificationOutcome =
  | { state: "completed"; record: OnboardingSession; accessPointName: string | null }
  | { state: "pending"; record: OnboardingSession }
  | { state: "unavailable"; record: OnboardingSession; reason: string }
  | { state: "exhausted"; record: OnboardingSession };

/**
 * Ask the gateway whether this station is now on the secure WLAN.
 *
 * Correlation is by MAC and service id — the two fields the controller reports
 * per station. A device that moved networks keeps its MAC and changes its
 * `serviceId`, which is exactly the transition being tested.
 *
 * Randomised MAC addresses are the honest limitation: a phone using a different
 * private address per SSID appears as a *different* station on the secure WLAN,
 * and this check will never see it. That produces `exhausted`, not a false
 * `COMPLETED`.
 */
export async function verifyJoin(record: OnboardingSession): Promise<VerificationOutcome> {
  if (record.status === "COMPLETED") {
    return { state: "completed", record, accessPointName: null };
  }
  if (!record.clientMac || !record.targetServiceId) {
    return { state: "unavailable", record, reason: "no_correlation_key" };
  }
  if (!gatewayConfigured()) {
    return { state: "unavailable", record, reason: "gateway_not_configured" };
  }
  if (record.checkCount >= onboardingMaxChecks()) {
    return { state: "exhausted", record };
  }

  let list: GatewayStation[];
  try {
    list = await stations();
  } catch (err) {
    await prisma.onboardingSession
      .update({
        where: { id: record.id },
        data: { checkCount: { increment: 1 }, lastCheckedAt: new Date() },
      })
      .catch(() => undefined);
    return {
      state: "unavailable",
      record,
      reason: err instanceof GatewayUnavailableError ? "gateway_unreachable" : "gateway_error",
    };
  }

  const wanted = normalizeMac(record.clientMac);
  const match = list.find(
    (station) =>
      station.macAddress &&
      normalizeMac(station.macAddress) === wanted &&
      station.serviceId === record.targetServiceId
  );

  const updated = await prisma.onboardingSession.update({
    where: { id: record.id },
    data: {
      checkCount: { increment: 1 },
      lastCheckedAt: new Date(),
      ...(match
        ? {
            status: "COMPLETED",
            completedAt: new Date(),
            verifiedAt: new Date(),
            verifiedServiceId: match.serviceId,
          }
        : {}),
    },
  });

  if (match) {
    await audit(record.sessionId, "SECURE_ONBOARDING_COMPLETED", "info", {
      onboardingSessionId: record.id,
      clientMac: record.clientMac,
      platform: record.platform,
      method: record.method,
      sourceSsid: record.sourceSsid,
      targetSsid: record.targetSsid,
      verifiedServiceId: match.serviceId,
      accessPointName: match.accessPointName,
    });
    return { state: "completed", record: updated, accessPointName: match.accessPointName };
  }

  return { state: "pending", record: updated };
}

/** Test seam — drops the memoised station list. */
export function resetStationCache(): void {
  stationCache = null;
  stationInFlight = null;
}
