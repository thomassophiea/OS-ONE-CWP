import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { allowedHosts } from "@/lib/env";
import { hostIsAllowed } from "@/lib/request/getRequestMetadata";
import { portalImageBlob } from "@/lib/config/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The logo every guest page and AURA's live preview point an `<img>` at.
 * Always answers something — the operator's upload if one exists, the
 * bundled Extreme mark otherwise — so callers never need an `alt`-only
 * fallback state for "no logo configured".
 */

let bundledDefault: { data: Buffer; mimeType: string } | null | undefined;

function loadBundledDefault(): { data: Buffer; mimeType: string } | null {
  if (bundledDefault !== undefined) return bundledDefault;
  try {
    const data = readFileSync(path.join(process.cwd(), "public/branding/extreme-logo-default.png"));
    bundledDefault = { data, mimeType: "image/png" };
  } catch {
    bundledDefault = null;
  }
  return bundledDefault;
}

export async function GET(request: NextRequest) {
  if (!hostIsAllowed(request.headers.get("host"), allowedHosts())) {
    return new NextResponse("Not found", { status: 404 });
  }

  const stored = await portalImageBlob("logo");
  const image = stored ?? loadBundledDefault();
  if (!image) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(image.data), {
    status: 200,
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.data.length),
      // A version query param already busts the cache on upload/reset; the
      // response itself can be cached hard.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
