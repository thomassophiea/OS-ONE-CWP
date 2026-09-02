import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { audit } from "@/lib/session/repository";
import { invalidatePortalConfigCache } from "@/lib/config/portal";
import type { BrandImageKind } from "@/lib/config/imageUpload";

/**
 * The write half of brand-image storage, shared by the logo and background
 * routes — validation differs by kind (see `imageUpload.ts`), but "store
 * these three columns" and "clear these three columns" do not.
 */

export async function writeBrandImage(
  kind: BrandImageKind,
  image: { buffer: Buffer; mimeType: string },
  actor: string | null
): Promise<void> {
  const now = new Date();
  // Prisma's `Bytes` field wants a plain ArrayBuffer-backed Uint8Array, not
  // a Node `Buffer` (a Uint8Array subclass whose `.buffer` is typed as the
  // wider `ArrayBufferLike`, which `Uint8Array.from` narrows back).
  const bytes = Uint8Array.from(image.buffer);
  const data =
    kind === "logo"
      ? { logoData: bytes, logoMimeType: image.mimeType, logoUpdatedAt: now }
      : { backgroundData: bytes, backgroundMimeType: image.mimeType, backgroundUpdatedAt: now };

  await prisma.portalConfig.upsert({
    where: { id: "default" },
    update: { ...data, updatedBy: actor },
    create: { id: "default", ...data, updatedBy: actor },
  });
  invalidatePortalConfigCache();
  await audit(null, kind === "logo" ? "PORTAL_LOGO_UPLOADED" : "PORTAL_BACKGROUND_UPLOADED", "info", {
    actor,
    bytes: image.buffer.length,
    mimeType: image.mimeType,
  });
}

export async function clearBrandImage(kind: BrandImageKind, actor: string | null): Promise<void> {
  const data =
    kind === "logo"
      ? { logoData: null, logoMimeType: null, logoUpdatedAt: null }
      : { backgroundData: null, backgroundMimeType: null, backgroundUpdatedAt: null };

  try {
    await prisma.portalConfig.update({ where: { id: "default" }, data: { ...data, updatedBy: actor } });
  } catch (err) {
    // No row yet means there is nothing to clear — already at the default.
    // Prisma's P2025 ("record not found") is the only error that means that;
    // anything else is a real failure and should surface as one.
    if ((err as { code?: string }).code !== "P2025") {
      log.error("portal_image_clear_failed", { kind, err });
      throw err;
    }
    return;
  }
  invalidatePortalConfigCache();
  await audit(null, kind === "logo" ? "PORTAL_LOGO_RESET" : "PORTAL_BACKGROUND_RESET", "info", { actor });
}
