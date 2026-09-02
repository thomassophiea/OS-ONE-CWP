import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { allowedHosts, sessionTtlSeconds } from "@/lib/env";
import { hostIsAllowed } from "@/lib/request/getRequestMetadata";
import { SESSION_COOKIE, readSessionCookie, sessionCookieOptions } from "@/lib/session/cookie";
import { audit, isExpired } from "@/lib/session/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/** How many times one visit may push its own clock back out (WCAG 2.2.1). */
const MAX_EXTENSIONS = 5;

/**
 * Lets the guest's own browser push its session's expiry back out by one full
 * TTL, from the warning banner rendered on the consent/pending/secure pages.
 *
 * Bound to the signed session cookie only, the same trust boundary as
 * `/api/sponsorship/status` (GET) — not the double-submit CSRF token used by
 * `/api/accept`. Two reasons that is the right boundary here rather than a
 * gap: the CSRF cookie is deleted the moment consent is accepted
 * (`cwp_session` outlives it, see `app/api/accept/route.ts`), so a
 * double-submit check would be unsatisfiable on the pending/secure pages this
 * banner also renders on; and `SameSite=Lax` already keeps this fetch's
 * cookie from attaching to a cross-site request, since a script-initiated
 * POST is not a top-level navigation. The action itself only ever extends the
 * calling browser's own access window — there is no other account or
 * privilege to escalate into.
 */
export async function POST(request: NextRequest) {
  if (!hostIsAllowed(request.headers.get("host"), allowedHosts())) {
    return new NextResponse("Not found", { status: 404 });
  }

  const sessionId = readSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (!sessionId) {
    return NextResponse.json({ error: "no_session" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  let session;
  try {
    session = await prisma.guestSession.findUnique({ where: { id: sessionId } });
  } catch (err) {
    log.error("session_extend_lookup_failed", { err });
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
  }

  if (!session) {
    return NextResponse.json({ error: "no_session" }, { status: 401, headers: NO_STORE_HEADERS });
  }
  // Too late — the same request that would extend it is proof the deadline
  // already passed. The guest gets the ordinary expired-session page instead.
  if (isExpired(session)) {
    return NextResponse.json({ error: "expired" }, { status: 410, headers: NO_STORE_HEADERS });
  }

  let extensionCount = 0;
  try {
    extensionCount = await prisma.auditEvent.count({
      where: { sessionId: session.id, action: "session_extended" },
    });
  } catch (err) {
    log.error("session_extend_count_failed", { err });
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
  }
  if (extensionCount >= MAX_EXTENSIONS) {
    return NextResponse.json(
      { error: "extend_limit" },
      { status: 429, headers: NO_STORE_HEADERS }
    );
  }

  const ttlSeconds = sessionTtlSeconds();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  try {
    await prisma.guestSession.update({ where: { id: session.id }, data: { expiresAt } });
  } catch (err) {
    log.error("session_extend_write_failed", { err });
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE_HEADERS });
  }

  await audit(session.id, "session_extended", "info", {
    extensionCount: extensionCount + 1,
    expiresAt: expiresAt.toISOString(),
  });

  // The session cookie's own max-age is a separate clock from `expiresAt` —
  // refresh it too, or the browser could drop the cookie before the row says
  // the visit should end.
  const response = NextResponse.json(
    { expiresAt: expiresAt.toISOString() },
    { status: 200, headers: NO_STORE_HEADERS }
  );
  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value;
  if (cookieValue) {
    response.cookies.set(SESSION_COOKIE, cookieValue, sessionCookieOptions(ttlSeconds));
  }
  return response;
}
