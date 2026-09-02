import { NextRequest, NextResponse } from "next/server";
import { allowedHosts } from "@/lib/env";
import { hostIsAllowed } from "@/lib/request/getRequestMetadata";
import { portalImageBlob } from "@/lib/config/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The background image, when one is configured. Unlike the logo there is no
 * bundled default — no background image is a real, supported state (today's
 * plain page), so a 404 here is correct, not a gap: `effectiveBranding()`
 * only ever hands out this URL when a background actually exists, so a
 * guest page never has a reason to request it otherwise.
 */
export async function GET(request: NextRequest) {
  if (!hostIsAllowed(request.headers.get("host"), allowedHosts())) {
    return new NextResponse("Not found", { status: 404 });
  }

  const stored = await portalImageBlob("background");
  if (!stored) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(stored.data), {
    status: 200,
    headers: {
      "Content-Type": stored.mimeType,
      "Content-Length": String(stored.data.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
