import imageSize from "image-size";

/**
 * Validation for the two operator-uploaded images (logo, background). Both
 * arrive as base64 in a JSON body — the internal config API is JSON-only,
 * and a second, multipart surface for two fields was not worth the added
 * shape. Same reasoning as everywhere else in this module: compute, never
 * trust the client's own claims about what it sent.
 */

export type BrandImageKind = "logo" | "background";

export interface BrandImageLimits {
  maxBytes: number;
  /** Omitted for the background — it has no dimension ceiling. */
  maxWidth?: number;
  maxHeight?: number;
}

// The logo sits inline with page text at a fixed size; the background tiles
// or covers the whole viewport and is expected to be a real photo. Different
// shapes, different budgets.
export const BRAND_IMAGE_LIMITS: Record<BrandImageKind, BrandImageLimits> = {
  logo: { maxBytes: 100_000, maxWidth: 500, maxHeight: 200 },
  background: { maxBytes: 5_000_000 },
};

// Deliberately no SVG: an <img src> can't execute embedded script, but there
// is no reason to carry that format's parser surface for a captive-portal
// upload when a raster covers every real case.
const ACCEPTED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export interface ImageValidationOk {
  ok: true;
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
}

export interface ImageValidationError {
  ok: false;
  error: string;
}

export type ImageValidationResult = ImageValidationOk | ImageValidationError;

/**
 * Decode and validate one upload against the limits for `kind`. `dataUrl`
 * accepts either a bare base64 string or a `data:<mime>;base64,<data>` URL —
 * the browser's FileReader produces the latter, and accepting it directly
 * avoids a string-slicing step duplicated at every caller.
 */
export function validateBrandImage(
  kind: BrandImageKind,
  input: { data: unknown; mimeType: unknown }
): ImageValidationResult {
  if (typeof input.data !== "string" || input.data.length === 0) {
    return { ok: false, error: "data must be a non-empty base64 string" };
  }

  const dataUrlMatch = /^data:([^;,]+);base64,([\s\S]*)$/.exec(input.data);
  const declaredMime =
    typeof input.mimeType === "string" && input.mimeType
      ? input.mimeType.toLowerCase()
      : (dataUrlMatch?.[1]?.toLowerCase() ?? "");
  const base64 = dataUrlMatch ? dataUrlMatch[2] : input.data;

  if (!ACCEPTED_MIME_TYPES.has(declaredMime)) {
    return {
      ok: false,
      error: `mimeType must be one of ${[...ACCEPTED_MIME_TYPES].join(", ")}`,
    };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return { ok: false, error: "data is not valid base64" };
  }
  if (buffer.length === 0) {
    return { ok: false, error: "data decoded to an empty file" };
  }

  const limits = BRAND_IMAGE_LIMITS[kind];
  if (buffer.length > limits.maxBytes) {
    return {
      ok: false,
      error: `Invalid image: file size must be less than ${Math.round(limits.maxBytes / 1000)}kB (got ${Math.round(buffer.length / 1000)}kB).`,
    };
  }

  let dimensions: { width: number; height: number };
  try {
    dimensions = imageSize(buffer);
  } catch {
    return { ok: false, error: "Invalid image: file is not a readable PNG, JPEG, or WebP." };
  }
  const { width, height } = dimensions;

  // The real bytes decide the format, not the declared mimeType — a
  // relabeled file is still rejected, but on the honest reason.
  if (limits.maxWidth && width > limits.maxWidth) {
    return {
      ok: false,
      error: `Invalid image: file size must be less than ${Math.round(limits.maxBytes / 1000)}kB and image dimensions must be less than width:${limits.maxWidth}, height:${limits.maxHeight}.`,
    };
  }
  if (limits.maxHeight && height > limits.maxHeight) {
    return {
      ok: false,
      error: `Invalid image: file size must be less than ${Math.round(limits.maxBytes / 1000)}kB and image dimensions must be less than width:${limits.maxWidth}, height:${limits.maxHeight}.`,
    };
  }

  return { ok: true, buffer, mimeType: declaredMime, width, height };
}
