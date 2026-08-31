import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * The sponsorship approval token.
 *
 * 32 bytes of CSPRNG output, base64url — 256 bits of entropy, the same budget
 * as the CSRF and hand-off tokens elsewhere in the portal. The raw token
 * exists in exactly two places: the emailed review URL and the decision form's
 * hidden field. Storage and logs only ever see the SHA-256.
 *
 * Deliberately *not* single-use at the read layer: the review page may be
 * opened many times (a mail scanner will open it first). What is single-use is
 * the PENDING → decided transition, enforced as an atomic conditional update
 * in the service — replaying the token after a decision can only re-render the
 * outcome, never change it.
 */

/** base64url of 32 bytes is 43 characters, unpadded. */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function newSponsorshipToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashSponsorshipToken(token) };
}

export function hashSponsorshipToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Structural check before any database round trip. Everything that fails this
 * is indistinguishable garbage and gets the same generic answer, which is what
 * keeps the lookup free of enumeration signal.
 */
export function isWellFormedToken(token: string | null | undefined): token is string {
  return typeof token === "string" && TOKEN_RE.test(token);
}

/** Timing-safe comparison of two hex hashes. */
export function tokenHashMatches(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
