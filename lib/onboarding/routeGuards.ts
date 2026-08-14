/**
 * Shared entry checks for the onboarding API.
 *
 * Every provisioning route answers the same three questions before it does
 * anything — is this host one we serve, does the caller hold the onboarding
 * token, and have they asked too often — so they are answered in one place.
 *
 * Error bodies are deliberately thin. A guest can act on "expired"; a guest
 * cannot act on the difference between "no such onboarding" and "wrong token",
 * and telling them the difference is how id enumeration becomes cheap.
 */

import { NextRequest, NextResponse } from "next/server";
import type { OnboardingSession } from "@prisma/client";
import { allowedHosts } from "@/lib/env";
import { hostIsAllowed } from "@/lib/request/getRequestMetadata";
import { ONBOARDING_COOKIE } from "@/lib/onboarding/token";
import { authorizeOnboarding } from "@/lib/onboarding/service";

/** Headers for anything whose body is, or reveals, credential material. */
export const NO_STORE_HEADERS = {
  "cache-control": "no-store, no-cache, must-revalidate, private",
  pragma: "no-cache",
  expires: "0",
  // A provisioning artifact is never a page and must never be framed or sniffed
  // into being one.
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
} as const;

export function jsonError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: NO_STORE_HEADERS }
  );
}

// ---------------------------------------------------------------------------
// Rate limiting
//
// In-memory and per-instance. That is the right size for this: the thing being
// limited is one guest's phone re-requesting its own provisioning artifact, and
// a shared store would add a dependency to the exact path that has to keep
// working when things are degraded.
// ---------------------------------------------------------------------------

const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    // Opportunistic sweep; the map is bounded by concurrent guests, not by time.
    if (buckets.size > 5_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export interface GuardedOnboarding {
  record: OnboardingSession;
}

/**
 * Resolve and authorise the onboarding session named in the path.
 *
 * Returns a `NextResponse` when the request must be refused, so callers read
 * as `const guard = await guardOnboarding(...); if (guard instanceof NextResponse) return guard;`
 */
export async function guardOnboarding(
  request: NextRequest,
  id: string,
  { limit = 30 }: { limit?: number } = {}
): Promise<GuardedOnboarding | NextResponse> {
  if (!hostIsAllowed(request.headers.get("host"), allowedHosts())) {
    return new NextResponse("Not found", { status: 404 });
  }

  const token = request.cookies.get(ONBOARDING_COOKIE)?.value ?? null;
  if (!token) {
    return jsonError(401, "no_onboarding_session", "This secure setup session has ended.");
  }

  if (!rateLimit(`${id}:${request.nextUrl.pathname}`, limit)) {
    return jsonError(429, "rate_limited", "Too many requests. Wait a moment and try again.");
  }

  const record = await authorizeOnboarding(id, token);
  if (!record) {
    return jsonError(
      404,
      "onboarding_unavailable",
      "This secure setup session has expired. Reconnect to the guest network to start again."
    );
  }

  return { record };
}
