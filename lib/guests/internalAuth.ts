import { timingSafeEqual } from "crypto";

/**
 * Authentication for the service-to-service guest API.
 *
 * This surface exposes station MACs and lets a caller grant or withdraw network
 * access, so it is disabled outright unless `INTERNAL_API_TOKEN` is configured —
 * a missing token must never mean "open". The comparison is constant time, and
 * a short token is refused so a placeholder value cannot be brute-forced.
 */

const MIN_TOKEN_LENGTH = 24;

export function internalApiEnabled(): boolean {
  const token = process.env.INTERNAL_API_TOKEN?.trim();
  return Boolean(token && token.length >= MIN_TOKEN_LENGTH);
}

export function internalTokenIsValid(provided: string | null | undefined): boolean {
  if (!internalApiEnabled()) return false;
  const expected = process.env.INTERNAL_API_TOKEN!.trim();
  if (!provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Pull the bearer token out of an Authorization header. */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function authorizeInternalRequest(headers: Headers): {
  ok: boolean;
  status: number;
  error?: string;
} {
  if (!internalApiEnabled()) {
    return { ok: false, status: 404, error: "Not found" };
  }
  if (!internalTokenIsValid(bearerToken(headers.get("authorization")))) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true, status: 200 };
}

/** Identity recorded in `createdBy` / `revokedBy`, when the caller supplies one. */
export function actorFrom(headers: Headers): string | null {
  const actor = headers.get("x-actor")?.trim();
  if (!actor) return null;
  // Bounded and stripped of control characters: it lands in the audit trail.
  return actor.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 128) || null;
}
