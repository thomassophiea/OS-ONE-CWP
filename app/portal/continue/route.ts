import { NextRequest, NextResponse } from "next/server";
import { appBaseUrl, allowedHosts, sessionTtlSeconds } from "@/lib/env";
import { getRequestMetadata, hostIsAllowed } from "@/lib/request/getRequestMetadata";
import {
  SESSION_COOKIE,
  signSessionCookie,
  sessionCookieOptions,
} from "@/lib/session/cookie";
import { redeemHandoffToken } from "@/lib/onboarding/handoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pick a portal session back up in a different browser.
 *
 * This is the far end of the captive-assistant hand-off. The OS captive-portal
 * window and the real browser do not share cookies, so a guest arriving here
 * has no session at all; the single-use token in the query string is the only
 * thing that identifies them.
 *
 * A route handler rather than a page, for three reasons that all matter:
 *
 *  - it can set a cookie, which a server component cannot;
 *  - it can answer with a redirect, so the token leaves the address bar on the
 *    very next paint instead of sitting in history and in the referrer of every
 *    subsequent request;
 *  - it can send `Referrer-Policy: no-referrer`, so the token cannot leak out
 *    through the referrer of the page it redirects to.
 *
 * The session's own TTL is refreshed on the way through. Without that, a guest
 * who spent a few minutes reading the instructions before tapping the link
 * would arrive in Safari and be told their session had ended — the exact
 * failure this route exists to remove, arriving by a different door.
 */
export async function GET(request: NextRequest) {
  const base = (() => {
    try {
      return appBaseUrl();
    } catch {
      return new URL(request.url).origin;
    }
  })();

  if (!hostIsAllowed(request.headers.get("host"), allowedHosts())) {
    return new NextResponse("Not found", { status: 404 });
  }

  const meta = getRequestMetadata(request.headers);
  const token = request.nextUrl.searchParams.get("h");
  const outcome = await redeemHandoffToken(token, meta.sourceIp, sessionTtlSeconds());

  // Every failure looks the same to the guest. "Already used", "expired" and
  // "never existed" are recorded separately in the audit trail, but telling a
  // caller which one it was turns the endpoint into an oracle.
  if (!outcome.ok) {
    const url = new URL("/portal/error", base);
    url.searchParams.set("code", outcome.reason === "used" ? "handoff_used" : "handoff_invalid");
    return noReferrer(NextResponse.redirect(url, 303));
  }

  const response = NextResponse.redirect(new URL("/portal/secure", base), 303);
  response.cookies.set(
    SESSION_COOKIE,
    signSessionCookie(outcome.session.id),
    sessionCookieOptions(sessionTtlSeconds())
  );
  return noReferrer(response);
}

function noReferrer(response: NextResponse): NextResponse {
  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set("cache-control", "no-store, no-cache, must-revalidate, private");
  return response;
}
