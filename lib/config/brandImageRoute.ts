import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/log";
import { authorizeInternalRequest, actorFrom } from "@/lib/guests/internalAuth";
import { validateBrandImage, type BrandImageKind } from "@/lib/config/imageUpload";
import { writeBrandImage, clearBrandImage } from "@/lib/config/brandImageWrite";
import { effectiveBranding } from "@/lib/config/portal";

/**
 * `PUT`/`DELETE` for one brand image (logo or background) — same trust model
 * and response shape as `/api/internal/config`, split into their own routes
 * because a base64 image payload does not belong inside that endpoint's
 * general-purpose, otherwise-small JSON body.
 */
export function createBrandImageRoute(kind: BrandImageKind) {
  async function PUT(request: NextRequest) {
    const auth = authorizeInternalRequest(request.headers);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
    }

    const result = validateBrandImage(kind, { data: body.data, mimeType: body.mimeType });
    if (!result.ok) {
      return NextResponse.json({ error: "Validation failed", details: [result.error] }, { status: 400 });
    }

    const actor = actorFrom(request.headers);
    try {
      await writeBrandImage(kind, { buffer: result.buffer, mimeType: result.mimeType }, actor);
    } catch (err) {
      log.error("brand_image_write_failed", { kind, err });
      return NextResponse.json({ error: "Unavailable" }, { status: 503 });
    }

    return NextResponse.json({
      width: result.width,
      height: result.height,
      bytes: result.buffer.length,
      branding: await effectiveBranding(),
    });
  }

  async function DELETE(request: NextRequest) {
    const auth = authorizeInternalRequest(request.headers);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const actor = actorFrom(request.headers);
    try {
      await clearBrandImage(kind, actor);
    } catch (err) {
      log.error("brand_image_clear_failed", { kind, err });
      return NextResponse.json({ error: "Unavailable" }, { status: 503 });
    }

    return NextResponse.json({ branding: await effectiveBranding() });
  }

  return { PUT, DELETE };
}
