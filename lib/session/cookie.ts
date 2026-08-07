import { createHmac, timingSafeEqual, randomBytes, createHash } from "crypto";
import { isProduction, sessionSecret } from "@/lib/env";

export const SESSION_COOKIE = "cwp_session";
export const CSRF_COOKIE = "cwp_csrf";

/**
 * Cookie value format: `<sessionId>.<base64url HMAC-SHA256(sessionId)>`.
 *
 * The session itself lives in Postgres; the cookie only binds a browser to a
 * row. Signing it means a client cannot walk other guests' session ids.
 */
export function signSessionCookie(sessionId: string): string {
  const mac = createHmac("sha256", sessionSecret())
    .update(sessionId, "utf8")
    .digest("base64url");
  return `${sessionId}.${mac}`;
}

export function readSessionCookie(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const sessionId = value.slice(0, dot);
  const provided = value.slice(dot + 1);
  const expected = createHmac("sha256", sessionSecret())
    .update(sessionId, "utf8")
    .digest("base64url");
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return sessionId;
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    // Secure in production only, so a local http:// dev run still works.
    secure: isProduction(),
    // Lax, not Strict: the guest arrives via a top-level GET navigation issued
    // by the access point, and the cookie has to survive that cross-site hop.
    // The only state-changing request (POST /api/accept) is same-site and is
    // additionally CSRF-token protected.
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/**
 * Per-session value the consent form must echo back to prove the browser ran
 * our script in response to a real user gesture.
 *
 * Deterministic from the session id, so it needs no extra storage. It is not a
 * secret and not a substitute for the CSRF token — it exists solely so that a
 * client which POSTs the form without executing the page cannot consent.
 */
export function consentChallenge(sessionId: string): string {
  return createHmac("sha256", sessionSecret())
    .update(`${sessionId}|consent`, "utf8")
    .digest("base64url")
    .slice(0, 32);
}

export function consentChallengeMatches(
  provided: string | null | undefined,
  sessionId: string
): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(consentChallenge(sessionId), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Fresh CSRF token; only its SHA-256 is persisted. */
export function newCsrfToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashCsrfToken(token) };
}

export function hashCsrfToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function csrfTokenMatches(
  token: string | null | undefined,
  storedHash: string | null | undefined
): boolean {
  if (!token || !storedHash) return false;
  const a = Buffer.from(hashCsrfToken(token), "utf8");
  const b = Buffer.from(storedHash, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
