import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { validateBrandImage, BRAND_IMAGE_LIMITS } from "../lib/config/imageUpload";

/**
 * A minimal, real, decodable PNG of exactly the given size — not a fixture
 * file, so a test asserting "501px wide fails" can prove it against 501px
 * and not whatever a checked-in image happens to be today.
 */
function pngOf(width: number, height: number): Buffer {
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    return table;
  })();
  const crc32 = (buf: Buffer): number => {
    let c = 0xffffffff;
    for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([len, typeAndData, crc]);
  };

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  // filter byte (0) + 3 bytes/pixel per row, one row of black pixels tiled
  const row = Buffer.alloc(1 + width * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const idat = deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function base64Png(width: number, height: number): string {
  return pngOf(width, height).toString("base64");
}

describe("validateBrandImage — logo (100 KB / 500×200)", () => {
  it("accepts a small logo within every limit", () => {
    const result = validateBrandImage("logo", {
      data: base64Png(400, 150),
      mimeType: "image/png",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.width).toBe(400);
      expect(result.height).toBe(150);
    }
  });

  it("accepts a data: URL, not just a bare base64 string", () => {
    const result = validateBrandImage("logo", {
      data: `data:image/png;base64,${base64Png(100, 100)}`,
      mimeType: undefined,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects width over 500px with the exact product-spec wording", () => {
    const result = validateBrandImage("logo", {
      data: base64Png(501, 150),
      mimeType: "image/png",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "Invalid image: file size must be less than 100kB and image dimensions must be less than width:500, height:200."
      );
    }
  });

  it("rejects height over 200px", () => {
    const result = validateBrandImage("logo", {
      data: base64Png(400, 201),
      mimeType: "image/png",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a file over 100 KB even at an acceptable resolution", () => {
    // All-zero pixel rows deflate to almost nothing regardless of declared
    // dimensions, so the reliable way to exceed the byte budget without
    // depending on compressibility is to pad a valid small PNG with
    // trailing bytes — `image-size` only reads the IHDR header, and real
    // decoders ignore anything after IEND, so this changes only the length.
    const result = validateBrandImage("logo", {
      data: Buffer.concat([pngOf(400, 150), Buffer.alloc(150_000)]).toString("base64"),
      mimeType: "image/png",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("file size must be less than 100kB");
  });

  it("rejects SVG outright — no script-carrying format accepted", () => {
    const result = validateBrandImage("logo", {
      data: Buffer.from("<svg></svg>").toString("base64"),
      mimeType: "image/svg+xml",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("mimeType must be one of");
  });

  it("rejects a mislabeled file — the real bytes decide the format", () => {
    const result = validateBrandImage("logo", {
      data: Buffer.from("not an image").toString("base64"),
      mimeType: "image/png",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects malformed base64", () => {
    const result = validateBrandImage("logo", { data: "!!!not base64!!!", mimeType: "image/png" });
    // Node's Buffer.from tolerates a lot, so this may decode to near-empty
    // bytes rather than throw — either outcome must be a rejection.
    expect(result.ok).toBe(false);
  });
});

describe("validateBrandImage — background (5 MB, no dimension ceiling)", () => {
  it("accepts a background image at a resolution the logo would fail", () => {
    const result = validateBrandImage("background", {
      data: base64Png(1920, 1080),
      mimeType: "image/jpeg",
    });
    expect(result.ok).toBe(true);
  });

  it("has no maxWidth/maxHeight in its limits", () => {
    expect(BRAND_IMAGE_LIMITS.background.maxWidth).toBeUndefined();
    expect(BRAND_IMAGE_LIMITS.background.maxHeight).toBeUndefined();
  });

  it("still rejects an oversized file", () => {
    const result = validateBrandImage("background", {
      data: Buffer.concat([pngOf(1920, 1080), Buffer.alloc(5_200_000)]).toString("base64"),
      mimeType: "image/png",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("file size must be less than 5000kB");
  });
});
