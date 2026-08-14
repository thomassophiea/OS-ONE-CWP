import { NextRequest, NextResponse } from "next/server";
import { allowedHosts } from "@/lib/env";
import { getRequestMetadata, hostIsAllowed } from "@/lib/request/getRequestMetadata";
import { SESSION_COOKIE, readSessionCookie } from "@/lib/session/cookie";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { bySourceAddress, type CapportIdentification } from "@/lib/capport/resolve";
import { capportContext, capportResponse } from "@/lib/capport/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Captive Portal API — RFC 8908 — at the network-wide URI.
 *
 * This is what a device asks instead of probing `captive.apple.com` and reading
 * the tea leaves of an intercepted response. It is reached only if the network
 * advertises it (RFC 8910: DHCP option 114, DHCPv6 option 103, or RA option
 * 37), so until something emits that option this route is simply never called.
 *
 * Identification, in descending order of certainty. Each step is only taken
 * when the previous one gave no answer, and the last one is a refusal to guess
 * rather than a guess:
 *
 *   1. the session cookie, when the client's captive agent shares one;
 *   2. the source address, but only when exactly one live session carries it;
 *   3. nothing — answer conservatively.
 *
 * The per-client URI (`/captive-api/{token}`, RFC 8908 §4) is the reliable
 * form and is preferred wherever the network can provision it.
 */
export async function GET(request: NextRequest) {
  if (!hostIsAllowed(request.headers.get("host"), allowedHosts())) {
    return new NextResponse("Not found", { status: 404 });
  }

  const meta = getRequestMetadata(request.headers);
  let identification: CapportIdentification = { how: "unidentified", reason: "no-token" };

  const sessionId = readSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (sessionId) {
    try {
      const session = await prisma.guestSession.findUnique({ where: { id: sessionId } });
      if (session) identification = { how: "session-cookie", session };
    } catch (err) {
      log.error("capport_cookie_lookup_failed", { err });
    }
  }

  if (identification.how === "unidentified") {
    const { session, ambiguous } = await bySourceAddress(meta.sourceIp);
    if (session) identification = { how: "source-address", session };
    else if (ambiguous) identification = { how: "unidentified", reason: "ambiguous-address" };
  }

  return capportResponse(identification, capportContext());
}
