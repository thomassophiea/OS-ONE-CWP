import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/log";
import { authorizeInternalRequest, actorFrom } from "@/lib/guests/internalAuth";
import { findById, deleteGuest, revokeGuest, lastSessionsFor } from "@/lib/guests/repository";
import { toGuestDto } from "@/lib/guests/serialize";
import { audit } from "@/lib/session/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = authorizeInternalRequest(request.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  try {
    const guest = await findById(id);
    if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    const sessions = await lastSessionsFor([guest.macAddress]);
    return NextResponse.json({
      guest: toGuestDto(guest, new Date(), sessions.get(guest.macAddress) ?? null),
    });
  } catch (err) {
    log.error("internal_guests_get_failed", { err });
    return NextResponse.json({ error: "Guest store unavailable" }, { status: 503 });
  }
}

/**
 * DELETE /api/internal/guests/{id}
 *
 * Deletion is only honoured for an entry that no device has ever used — a
 * mistyped MAC, say. Anything with history is revoked instead and the response
 * says so, because quietly turning "delete" into "revoke" would leave an
 * operator believing the record was gone, and quietly deleting a real guest's
 * history would destroy the audit trail. `?force=revoke` states the intent up
 * front for callers that already know they want a revocation.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = authorizeInternalRequest(request.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const actor = actorFrom(request.headers);

  try {
    const outcome = await deleteGuest(id);

    if (outcome === "NOT_FOUND") {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    if (outcome === "DELETED") {
      await audit(null, "GUEST_DELETED", "info", { guestId: id, actor });
      return NextResponse.json({ outcome: "DELETED", guest: null });
    }

    // HAS_HISTORY — revoke instead, and report which happened.
    const guest = await revokeGuest(id, actor);
    if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });

    await audit(null, "GUEST_REVOKED", "warn", {
      guestId: id,
      clientMac: guest.macAddress,
      actor,
      viaDelete: true,
    });

    return NextResponse.json({ outcome: "REVOKED", guest: toGuestDto(guest) });
  } catch (err) {
    log.error("internal_guests_delete_failed", { err });
    return NextResponse.json({ error: "Guest store unavailable" }, { status: 503 });
  }
}
