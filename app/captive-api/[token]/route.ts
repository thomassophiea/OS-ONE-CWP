import { NextRequest, NextResponse } from "next/server";
import { allowedHosts } from "@/lib/env";
import { hostIsAllowed } from "@/lib/request/getRequestMetadata";
import { bySessionToken, type CapportIdentification } from "@/lib/capport/resolve";
import { capportContext, capportResponse } from "@/lib/capport/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Captive Portal API at a per-client URI — RFC 8908 §4.
 *
 * "If the API server needs information about the client identity that is not
 * otherwise visible to it, the URI provided to the client during provisioning
 * SHOULD be distinct per client."
 *
 * That is this portal exactly. It runs off-network behind the site's NAT, so
 * every station arrives with the same public source address and cannot be told
 * apart from the request. A distinct URI per client is the RFC's own answer,
 * and it is the only form that answers correctly for a busy site.
 *
 * The token is read-only by construction: it selects a session and produces a
 * state document. It cannot authorize a station, cannot reach a credential,
 * and never sets a cookie — so a leaked one discloses one device's captive
 * state and nothing more.
 *
 * An unknown token is answered, not refused. A client that has been given a
 * stale URI needs to be told it is captive so it opens the portal; a 404 would
 * leave it with no state at all and no route out.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!hostIsAllowed(request.headers.get("host"), allowedHosts())) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { token } = await params;
  const session = await bySessionToken(token);
  const identification: CapportIdentification = session
    ? { how: "per-client-uri", session }
    : { how: "unidentified", reason: "unknown-token" };

  return capportResponse(identification, capportContext());
}
