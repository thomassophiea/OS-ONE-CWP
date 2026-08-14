/**
 * Onboarding bearer tokens.
 *
 * The onboarding id is in the URL of every provisioning endpoint, so it is not
 * a secret and cannot be the thing that authorises the download. The token is:
 * 32 random bytes, held only in an HttpOnly cookie, stored only as a SHA-256,
 * and compared in constant time.
 *
 * This mirrors the CSRF token in `lib/session/cookie.ts` deliberately — same
 * shape, same storage discipline — because a second, differently-shaped secret
 * in the same application is a second thing to get wrong.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { isProduction } from "@/lib/env";

export const ONBOARDING_COOKIE = "cwp_onboarding";

export function newOnboardingToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashOnboardingToken(token) };
}

export function hashOnboardingToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function onboardingTokenMatches(
  token: string | null | undefined,
  storedHash: string | null | undefined
): boolean {
  if (!token || !storedHash) return false;
  const a = Buffer.from(hashOnboardingToken(token), "utf8");
  const b = Buffer.from(storedHash, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Cookie options for the onboarding token.
 *
 * `SameSite=Lax` matches the portal session cookie. It has to survive the
 * top-level navigation the gateway issues after authorization, and every
 * request that presents it is either a same-site fetch from the onboarding page
 * or a top-level GET the guest initiated by tapping a download link.
 */
export function onboardingCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
