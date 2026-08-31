import type { GuestSession, SponsorshipRequest } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { audit } from "@/lib/session/repository";
import {
  appBaseUrl,
  approvalUrlTtlSeconds,
  sponsorshipMaxPerSession,
  sponsorshipTtlSeconds,
  xccIdentity,
  xccSharedSecret,
} from "@/lib/env";
import { buildEcpApprovalUrl } from "@/lib/captive/ecpSigV4";
import type { PersistencePolicy } from "@/lib/privacy/policy";
import { newSponsorshipToken, hashSponsorshipToken, isWellFormedToken } from "./token";
import { effectiveStatus } from "./state";

/**
 * Sponsorship persistence and the one place a sponsor's decision becomes real.
 *
 * Everything that mutates a request goes through a *conditional* update —
 * `updateMany` filtered on the state being left — so concurrent actors
 * (a double-clicked Allow, an Allow racing a Deny, a poll racing an expiry)
 * resolve to exactly one winner inside Postgres rather than in application
 * code that read a stale row.
 */

export type DecisionAction = "approve" | "deny";

export interface CreateSponsorshipInput {
  session: GuestSession;
  guestName: string;
  guestEmail: string;
  sponsorEmail: string;
  policy: PersistencePolicy;
}

export type CreateSponsorshipResult =
  | { ok: true; request: SponsorshipRequest; token: string }
  | { ok: false; reason: "limit" | "unavailable" };

/** The newest request for a session, if any. */
export async function latestSponsorshipForSession(
  sessionId: string
): Promise<SponsorshipRequest | null> {
  return prisma.sponsorshipRequest.findFirst({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Create a request row and its approval token.
 *
 * Guest identity is stored only when the session's persistence policy allows
 * it; the caller passes the typed values regardless, because the email (sent
 * by the caller, transiently) needs them either way.
 *
 * The raw token is returned exactly once, for the email. It is never stored
 * and never logged.
 */
export async function createSponsorshipRequest(
  input: CreateSponsorshipInput
): Promise<CreateSponsorshipResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sponsorshipTtlSeconds() * 1000);

  const priorCount = await prisma.sponsorshipRequest.count({
    where: { sessionId: input.session.id },
  });
  if (priorCount >= sponsorshipMaxPerSession()) {
    await audit(input.session.id, "SPONSORSHIP_LIMIT_REACHED", "warn", {
      clientMac: input.session.clientMac,
      priorCount,
    });
    return { ok: false, reason: "limit" };
  }

  const { token, hash } = newSponsorshipToken();
  const storeIdentity = input.policy.personalDataAllowed;

  try {
    const request = await prisma.sponsorshipRequest.create({
      data: {
        sessionId: input.session.id,
        clientMac: input.session.clientMac,
        tokenHash: hash,
        // Under a storage prohibition the identity columns are never written —
        // the values live on in this request's memory only, long enough to
        // render the email.
        guestName: storeIdentity ? input.guestName : null,
        guestEmail: storeIdentity ? input.guestEmail : null,
        sponsorEmail: input.sponsorEmail,
        ssid: input.session.ssid,
        apName: input.session.apName,
        expiresAt,
      },
    });
    return { ok: true, request, token };
  } catch (err) {
    log.error("sponsorship_create_failed", { err, sessionId: input.session.id });
    return { ok: false, reason: "unavailable" };
  }
}

/** The absolute review URL the sponsor receives. */
export function sponsorReviewUrl(token: string): string {
  return `${appBaseUrl()}/sponsor/${token}`;
}

/** Look a request up by its raw token. Malformed tokens never reach Postgres. */
export async function sponsorshipByToken(
  token: string | null | undefined
): Promise<SponsorshipRequest | null> {
  if (!isWellFormedToken(token)) return null;
  return prisma.sponsorshipRequest.findUnique({
    where: { tokenHash: hashSponsorshipToken(token) },
  });
}

/**
 * Note that the review page was opened. First open only, and deliberately not
 * treated as evidence of anything — mail scanners open links too.
 */
export async function recordSponsorViewed(id: string): Promise<void> {
  await prisma.sponsorshipRequest
    .updateMany({ where: { id, viewedAt: null }, data: { viewedAt: new Date() } })
    .catch((err) => log.error("sponsorship_viewed_update_failed", { err, id }));
}

/**
 * Persist EXPIRED for a request whose deadline passed while it was PENDING.
 *
 * Enforcement does not depend on this — every reader applies
 * `effectiveStatus` — but the stored row should eventually say what every
 * reader already concluded. Conditional, so it can never overwrite a decision
 * that landed in the same instant.
 */
export async function persistExpiryIfDue(
  request: SponsorshipRequest,
  now: Date = new Date()
): Promise<SponsorshipRequest> {
  if (request.status !== "PENDING" || effectiveStatus(request, now) !== "EXPIRED") {
    return request;
  }
  const updated = await prisma.sponsorshipRequest.updateMany({
    where: { id: request.id, status: "PENDING" },
    data: { status: "EXPIRED", decidedAt: null },
  });
  if (updated.count === 1) {
    await audit(request.sessionId, "SPONSORSHIP_EXPIRED", "info", {
      requestId: request.id,
      clientMac: request.clientMac,
      sponsorDomain: request.sponsorEmail.slice(request.sponsorEmail.lastIndexOf("@") + 1),
    });
    return { ...request, status: "EXPIRED" };
  }
  // Lost the race to a concurrent decision or another reader; re-read.
  return (
    (await prisma.sponsorshipRequest.findUnique({ where: { id: request.id } })) ?? request
  );
}

export type DecisionOutcome =
  | { applied: true; request: SponsorshipRequest }
  | { applied: false; request: SponsorshipRequest | null };

/**
 * Apply the sponsor's decision. Exactly-once by construction: the UPDATE is
 * filtered on `status = PENDING` *and* the deadline, so of any number of
 * concurrent approve/deny attempts precisely one changes the row and every
 * other caller is told the truth about what it now says.
 */
export async function decideSponsorship(
  request: SponsorshipRequest,
  action: DecisionAction,
  meta: { sourceIp: string | null; userAgent: string | null }
): Promise<DecisionOutcome> {
  const now = new Date();
  const approved = action === "approve";

  const result = await prisma.sponsorshipRequest.updateMany({
    where: { id: request.id, status: "PENDING", expiresAt: { gt: now } },
    data: {
      status: approved ? "APPROVED" : "DENIED",
      decidedAt: now,
      approvedAt: approved ? now : null,
      deniedAt: approved ? null : now,
      decisionIp: meta.sourceIp,
      decisionUserAgent: meta.userAgent,
    },
  });

  const current = await prisma.sponsorshipRequest.findUnique({
    where: { id: request.id },
  });

  if (result.count === 1 && current) {
    await audit(
      request.sessionId,
      approved ? "SPONSORSHIP_APPROVED" : "SPONSORSHIP_DENIED",
      "info",
      {
        requestId: request.id,
        clientMac: request.clientMac,
        sponsorDomain: request.sponsorEmail.slice(request.sponsorEmail.lastIndexOf("@") + 1),
        decisionIp: meta.sourceIp,
      }
    );
    return { applied: true, request: current };
  }
  return { applied: false, request: current };
}

/**
 * The presigned gateway callback for a sponsored session — the same URL, built
 * by the same signer, as the consent flow's. This is the whole authorization
 * integration: sponsorship changes *when* this URL is released, never *what*
 * authorizes the guest.
 *
 * Null when the session is missing a field the callback needs; the caller
 * reports that honestly rather than sending the guest somewhere broken.
 */
export function sponsoredApprovalUrl(session: GuestSession): string | null {
  if (!session.gatewayHost || !session.gatewayToken || !session.wlan || !session.clientMacRaw) {
    return null;
  }
  const confirmUrl = new URL("/success", appBaseUrl());
  confirmUrl.searchParams.set("s", session.id);
  try {
    return buildEcpApprovalUrl({
      gatewayHost: session.gatewayHost,
      gatewayPort: session.gatewayPort ?? "443",
      token: session.gatewayToken,
      username: session.clientMacRaw,
      wlan: session.wlan,
      dest: confirmUrl.toString(),
      identity: xccIdentity(),
      sharedSecret: xccSharedSecret(),
      expiresSeconds: approvalUrlTtlSeconds(),
    });
  } catch (err) {
    log.error("sponsorship_sign_failed", { err, sessionId: session.id });
    return null;
  }
}
