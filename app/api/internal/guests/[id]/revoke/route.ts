import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/log";
import { authorizeInternalRequest, actorFrom } from "@/lib/guests/internalAuth";
import { revokeGuest } from "@/lib/guests/repository";
import { toGuestDto } from "@/lib/guests/serialize";
import { audit } from "@/lib/session/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/guests/{id}/revoke
 *
 * Withdraw a standing authorization and close any live portal session for the
 * device. The record survives: revocation is a state, not a deletion.
 *
 * Idempotent — revoking an already-revoked guest returns the same 200, so a
 * retried request after a network failure is not an error.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = authorizeInternalRequest(request.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const actor = actorFrom(request.headers);

  try {
    const guest = await revokeGuest(id, actor);
    if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });

    await audit(null, "GUEST_REVOKED", "warn", {
      guestId: id,
      clientMac: guest.macAddress,
      actor,
    });

    return NextResponse.json({ guest: toGuestDto(guest) });
  } catch (err) {
    log.error("internal_guests_revoke_failed", { err });
    return NextResponse.json({ error: "Guest store unavailable" }, { status: 503 });
  }
}
