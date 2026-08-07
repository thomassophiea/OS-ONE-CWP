import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/log";
import { authorizeInternalRequest } from "@/lib/guests/internalAuth";
import { summarize } from "@/lib/guests/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/internal/guests/summary
 *
 * Counts for the management-plane header. `tz_offset_minutes` is the caller's
 * offset from UTC so that "today" means the operator's today; without it the
 * count silently means "since UTC midnight", which is a different day for most
 * of the world for part of the day.
 */
export async function GET(request: NextRequest) {
  const auth = authorizeInternalRequest(request.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const raw = new URL(request.url).searchParams.get("tz_offset_minutes");
  let offset = 0;
  if (raw !== null) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || Math.abs(parsed) > 14 * 60) {
      return NextResponse.json(
        { error: "tz_offset_minutes must be between -840 and 840" },
        { status: 400 }
      );
    }
    offset = parsed;
  }

  try {
    return NextResponse.json({ summary: await summarize(new Date(), offset) });
  } catch (err) {
    log.error("internal_guests_summary_failed", { err });
    return NextResponse.json({ error: "Guest store unavailable" }, { status: 503 });
  }
}
