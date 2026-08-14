/**
 * Wire representation of a guest.
 *
 * The internal API is consumed by AURA, not by a browser, but it still only
 * emits what the management plane needs: nothing here carries a gateway token,
 * a CSRF hash, or request headers.
 */

import type { GuestAuthorization } from "@prisma/client";
import {
  effectiveStatus,
  type LastOnboardingSummary,
  type LastSessionSummary,
} from "@/lib/guests/repository";

export interface GuestDto {
  id: string;
  macAddress: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source: string;
  /** Stored status; may lag the clock. */
  storedStatus: string;
  /** Status after applying `expiresAt`. This is the one to display. */
  authorizationStatus: string;
  ssid: string | null;
  wlan: string | null;
  gatewayHost: string | null;
  apName: string | null;
  apSerial: string | null;
  siteId: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  authorizedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  createdBy: string | null;
  lastSessionId: string | null;
  /** Status of the most recent portal visit — the only honest source of "failed". */
  lastSessionStatus: string | null;
  lastSessionAt: string | null;
  lastSessionFailureReason: string | null;
  /** IP the portal saw, used only when the gateway has no live answer. */
  lastKnownIp: string | null;
  /**
   * Most recent secure-onboarding attempt, or null when this guest never asked
   * for one — which is the normal case, since it is opt-in. `status` is the
   * onboarding lifecycle, not the guest's authorization: COMPLETED here means
   * the gateway saw the device on the secure WLAN, nothing more and nothing
   * less.
   */
  secureOnboarding: {
    id: string;
    status: string;
    method: string | null;
    platform: string;
    sourceSsid: string | null;
    targetSsid: string;
    startedAt: string;
    completedAt: string | null;
    failureReason: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

const iso = (value: Date | null) => (value ? value.toISOString() : null);

export function toGuestDto(
  guest: GuestAuthorization,
  now = new Date(),
  lastSession: LastSessionSummary | null = null,
  lastOnboarding: LastOnboardingSummary | null = null
): GuestDto {
  return {
    id: guest.id,
    macAddress: guest.macAddress,
    displayName: guest.displayName,
    email: guest.email,
    phone: guest.phone,
    notes: guest.notes,
    source: guest.source,
    storedStatus: guest.status,
    authorizationStatus: effectiveStatus(guest, now),
    ssid: guest.ssid,
    wlan: guest.wlan,
    gatewayHost: guest.gatewayHost,
    apName: guest.apName,
    apSerial: guest.apSerial,
    siteId: guest.siteId,
    firstSeen: iso(guest.firstSeen),
    lastSeen: iso(guest.lastSeen),
    authorizedAt: iso(guest.authorizedAt),
    expiresAt: iso(guest.expiresAt),
    revokedAt: iso(guest.revokedAt),
    revokedBy: guest.revokedBy,
    createdBy: guest.createdBy,
    lastSessionId: lastSession?.id ?? guest.lastSessionId,
    lastSessionStatus: lastSession?.status ?? null,
    lastSessionAt: iso(lastSession?.createdAt ?? null),
    lastSessionFailureReason: lastSession?.failureReason ?? null,
    lastKnownIp: lastSession?.clientIp ?? null,
    secureOnboarding: lastOnboarding
      ? {
          id: lastOnboarding.id,
          status: lastOnboarding.status,
          method: lastOnboarding.method,
          platform: lastOnboarding.platform,
          sourceSsid: lastOnboarding.sourceSsid,
          targetSsid: lastOnboarding.targetSsid,
          startedAt: lastOnboarding.createdAt.toISOString(),
          completedAt: iso(lastOnboarding.completedAt),
          failureReason: lastOnboarding.failureReason,
        }
      : null,
    createdAt: guest.createdAt.toISOString(),
    updatedAt: guest.updatedAt.toISOString(),
  };
}
