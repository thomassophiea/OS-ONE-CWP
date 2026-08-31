import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { allowedHosts, sponsorshipMaxStatusChecks } from "@/lib/env";
import { hostIsAllowed } from "@/lib/request/getRequestMetadata";
import { SESSION_COOKIE, readSessionCookie } from "@/lib/session/cookie";
import { audit, isExpired } from "@/lib/session/repository";
import { effectiveStatus } from "@/lib/sponsorship/state";
import {
  latestSponsorshipForSession,
  persistExpiryIfDue,
  sponsoredApprovalUrl,
} from "@/lib/sponsorship/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/**
 * What the waiting guest polls.
 *
 * Bound to the signed session cookie, never to a request id — a guest can only
 * ever ask about their own visit, so there is nothing here to enumerate.
 *
 * On approval this endpoint is where the network grant actually starts: it
 * builds the same presigned `/ext_approval.php` URL the consent flow issues
 * and hands it to the guest's browser, which must fetch it itself — the ECP
 * callback lives on the access point and is reachable only from the wireless
 * client's own link. The sponsor's click can therefore never authorize
 * anything directly; it only permits this endpoint to release the URL to the
 * one browser that holds the session.
 */
export async function GET(request: NextRequest) {
  if (!hostIsAllowed(request.headers.get("host"), allowedHosts())) {
    return new NextResponse("Not found", { status: 404 });
  }

  const sessionId = readSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (!sessionId) {
    return NextResponse.json({ state: "no_session" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  let session;
  let sponsorship;
  try {
    session = await prisma.guestSession.findUnique({ where: { id: sessionId } });
    sponsorship = await latestSponsorshipForSession(sessionId);
  } catch (err) {
    log.error("sponsorship_status_lookup_failed", { err });
    return NextResponse.json({ state: "error" }, { status: 503, headers: NO_STORE_HEADERS });
  }

  if (!session) {
    return NextResponse.json({ state: "no_session" }, { status: 401, headers: NO_STORE_HEADERS });
  }
  if (!sponsorship) {
    return NextResponse.json({ state: "none" }, { status: 404, headers: NO_STORE_HEADERS });
  }

  // Bounded polling: a tab left open on a locked phone must eventually stop.
  // The count is persisted, so reloading the page does not reset the budget.
  const maxChecks = sponsorshipMaxStatusChecks();
  if (sponsorship.checkCount >= maxChecks && sponsorship.status === "PENDING") {
    return NextResponse.json(
      { state: "exhausted", pollAfterMs: null },
      { headers: NO_STORE_HEADERS }
    );
  }
  await prisma.sponsorshipRequest
    .update({ where: { id: sponsorship.id }, data: { checkCount: { increment: 1 } } })
    .catch(() => undefined);

  sponsorship = await persistExpiryIfDue(sponsorship);
  const status = effectiveStatus(sponsorship);

  // The guest's own session outliving the wait is a real outcome and is
  // reported as itself: an approval that arrives after the gateway token died
  // cannot be redeemed, and "reconnect and ask again" is the honest answer.
  if (session.status === "AUTHORIZED") {
    return NextResponse.json({ state: "authorized" }, { headers: NO_STORE_HEADERS });
  }
  if (isExpired(session) && status !== "APPROVED") {
    return NextResponse.json({ state: "session_expired" }, { headers: NO_STORE_HEADERS });
  }

  switch (status) {
    case "PENDING":
      return NextResponse.json(
        { state: "pending", pollAfterMs: 4000 },
        { headers: NO_STORE_HEADERS }
      );
    case "DENIED":
      return NextResponse.json({ state: "denied" }, { headers: NO_STORE_HEADERS });
    case "CANCELLED":
    case "EXPIRED":
      return NextResponse.json({ state: "expired" }, { headers: NO_STORE_HEADERS });
    case "APPROVED": {
      if (isExpired(session)) {
        return NextResponse.json({ state: "session_expired" }, { headers: NO_STORE_HEADERS });
      }
      const approvalUrl = sponsoredApprovalUrl(session);
      if (!approvalUrl) {
        await audit(session.id, "SPONSORSHIP_AUTHORIZATION_FAILED", "error", {
          requestId: sponsorship.id,
          reason: "SESSION_INCOMPLETE_OR_SIGNING_FAILED",
        });
        return NextResponse.json({ state: "error" }, { status: 503, headers: NO_STORE_HEADERS });
      }

      // First issuance moves the session to ACCEPTED — the same meaning that
      // state has on the consent path: "the approval URL is out". Conditional,
      // so a poll racing the gateway's confirmation cannot regress AUTHORIZED.
      const firstIssue = sponsorship.authorizationIssuedAt === null;
      try {
        await prisma.guestSession.updateMany({
          where: { id: session.id, status: { in: ["STARTED", "ACCEPTED"] } },
          data: {
            status: "ACCEPTED",
            authorizationAttemptedAt: new Date(),
            authorizationResult: "SPONSOR_APPROVED_URL_ISSUED",
          },
        });
        if (firstIssue) {
          await prisma.sponsorshipRequest.updateMany({
            where: { id: sponsorship.id, authorizationIssuedAt: null },
            data: { authorizationIssuedAt: new Date() },
          });
          await audit(session.id, "SPONSORSHIP_AUTHORIZATION_ISSUED", "info", {
            requestId: sponsorship.id,
            clientMac: session.clientMac,
            gatewayHost: session.gatewayHost,
            wlan: session.wlan,
          });
        }
      } catch (err) {
        log.error("sponsorship_issue_update_failed", { err });
      }

      return NextResponse.json(
        { state: "approved", approvalUrl },
        { headers: NO_STORE_HEADERS }
      );
    }
  }
}
