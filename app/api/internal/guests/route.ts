import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/log";
import { authorizeInternalRequest, actorFrom } from "@/lib/guests/internalAuth";
import { parseListParams, parseCreateBody } from "@/lib/guests/requestParams";
import { parseMacAddress, MAC_PARSE_MESSAGES } from "@/lib/guests/mac";
import { listGuests, createGuest } from "@/lib/guests/repository";
import { toGuestDto } from "@/lib/guests/serialize";
import { audit } from "@/lib/session/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/internal/guests — the guest collection. */
export async function GET(request: NextRequest) {
  const auth = authorizeInternalRequest(request.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = parseListParams(new URL(request.url).searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const now = new Date();
    const { guests, nextCursor, total } = await listGuests(parsed.filter, now);
    return NextResponse.json({
      guests: guests.map((guest) => toGuestDto(guest, now)),
      nextCursor,
      total,
    });
  } catch (err) {
    log.error("internal_guests_list_failed", { err });
    return NextResponse.json({ error: "Guest store unavailable" }, { status: 503 });
  }
}

/**
 * POST /api/internal/guests — grant a standing authorization to a MAC.
 *
 * This does not touch the gateway. The portal is what authorizes a station, and
 * it consults this record on every redirect; AURA separately moves an
 * already-associated station into the authenticated role. Splitting it that way
 * keeps this service the owner of *policy* and the gateway the owner of *state*.
 */
export async function POST(request: NextRequest) {
  const auth = authorizeInternalRequest(request.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A JSON object body is required" }, { status: 400 });
  }

  const parsed = parseCreateBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const mac = parseMacAddress(parsed.value.macAddress);
  if (!mac.ok) {
    return NextResponse.json({ error: MAC_PARSE_MESSAGES[mac.reason] }, { status: 400 });
  }

  try {
    const result = await createGuest({
      ...parsed.value,
      macAddress: mac.value,
      source: "MANUAL",
      createdBy: actorFrom(request.headers),
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: "This MAC address is already authorized.",
          code: "DUPLICATE_ACTIVE",
          guest: toGuestDto(result.guest),
        },
        { status: 409 }
      );
    }

    await audit(null, "GUEST_MANUALLY_AUTHORIZED", "info", {
      clientMac: mac.value,
      expiresAt: parsed.value.expiresAt?.toISOString() ?? null,
      reactivated: result.reactivated,
      actor: actorFrom(request.headers),
    });

    return NextResponse.json({ guest: toGuestDto(result.guest) }, { status: 201 });
  } catch (err) {
    log.error("internal_guests_create_failed", { err });
    return NextResponse.json({ error: "Guest store unavailable" }, { status: 503 });
  }
}
