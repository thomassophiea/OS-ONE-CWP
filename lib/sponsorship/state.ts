import type { SponsorshipStatus } from "@prisma/client";

/**
 * Pure state arithmetic for sponsorship requests.
 *
 * Expiry is evaluated lazily on every read rather than by a background
 * sweeper: this application has no scheduler, and a request nobody ever looks
 * at again does not need its row to say EXPIRED — it needs every *reader* to
 * treat it as expired, which these functions guarantee. Persisting the EXPIRED
 * status when a reader notices it is bookkeeping, not enforcement.
 */

export interface ExpirableRequest {
  status: SponsorshipStatus;
  expiresAt: Date;
}

/**
 * The status a reader must act on, with expiry applied.
 *
 * Only PENDING can decay to EXPIRED. A decision that was made in time stays
 * made: an APPROVED request does not "expire" into some other state — whether
 * the *guest* can still use the approval is the session's question, not this
 * record's.
 */
export function effectiveStatus(
  request: ExpirableRequest,
  now: Date = new Date()
): SponsorshipStatus {
  if (request.status === "PENDING" && request.expiresAt.getTime() <= now.getTime()) {
    return "EXPIRED";
  }
  return request.status;
}

/** True when a sponsor's decision would still be honoured. */
export function isDecidable(request: ExpirableRequest, now: Date = new Date()): boolean {
  return effectiveStatus(request, now) === "PENDING";
}

/** Terminal states — nothing about the request will change again. */
export function isTerminal(status: SponsorshipStatus): boolean {
  return status !== "PENDING";
}

/**
 * Whether an APPROVED request may still be redeemed for network access.
 *
 * Approval and redemption have different clocks: `expiresAt` bounds how long
 * the *sponsor* had to decide, and this bounds how long the *guest* has to
 * come back and collect — measured from the decision, so an approval in the
 * last minute of the decision window is not stillborn. Used by cross-session
 * continuity: a guest whose captive window closed mid-wait reconnects, gets a
 * fresh session and a fresh gateway token, and the standing approval is
 * honoured instead of making them ask their sponsor twice.
 */
export function approvalRedeemable(
  request: { status: SponsorshipStatus; approvedAt: Date | null },
  redemptionSeconds: number,
  now: Date = new Date()
): boolean {
  return (
    request.status === "APPROVED" &&
    request.approvedAt !== null &&
    request.approvedAt.getTime() + redemptionSeconds * 1000 > now.getTime()
  );
}
