import { NextRequest, NextResponse } from "next/server";
import { verifyJoin } from "@/lib/onboarding/service";
import { NO_STORE_HEADERS, guardOnboarding } from "@/lib/onboarding/routeGuards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Has this device actually joined the secure network?
 *
 * The answer comes from the gateway's station list, correlated by MAC and
 * service id. Four outcomes, and the distinction between them is the point of
 * the endpoint:
 *
 * - `completed`   — the gateway reports this station on the secure WLAN. This
 *                   is the *only* thing that sets the session to COMPLETED.
 * - `pending`     — not seen there yet. Keep waiting.
 * - `exhausted`   — the poll budget ran out. Not a failure and not a success;
 *                   the device may well have joined under a randomised MAC.
 * - `unavailable` — the gateway could not be asked, or there is no MAC to
 *                   correlate on. Reported honestly rather than as "pending"
 *                   forever.
 *
 * `pollAfterMs` is returned so the client's cadence is the server's decision:
 * it can be widened without shipping a new bundle, and it stops when the answer
 * is terminal.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // The poll budget is enforced in `verifyJoin` against the persisted count;
  // this limit only stops one page from spinning far faster than it should.
  const guard = await guardOnboarding(request, id, { limit: 40 });
  if (guard instanceof NextResponse) return guard;

  const outcome = await verifyJoin(guard.record);

  const body = {
    id: guard.record.id,
    state: outcome.state,
    status: outcome.record.status,
    completedAt: outcome.record.completedAt?.toISOString() ?? null,
    targetSsid: outcome.record.targetSsid,
    accessPointName: outcome.state === "completed" ? outcome.accessPointName : null,
    reason: outcome.state === "unavailable" ? outcome.reason : null,
    checkCount: outcome.record.checkCount,
    pollAfterMs: outcome.state === "pending" ? 5_000 : null,
  };

  return NextResponse.json(body, { headers: NO_STORE_HEADERS });
}
