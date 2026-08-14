import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { allowedHosts, onboardingTtlSeconds } from "@/lib/env";
import { getRequestMetadata, hostIsAllowed } from "@/lib/request/getRequestMetadata";
import { SESSION_COOKIE, readSessionCookie } from "@/lib/session/cookie";
import { isExpired } from "@/lib/session/repository";
import {
  detectPlatform,
  platformSignalsFromHeaders,
  type Platform,
} from "@/lib/onboarding/platform";
import { planFor } from "@/lib/onboarding/methods";
import { networkCapabilities, secureOnboardingConfigured } from "@/lib/onboarding/providers/skynet";
import { createOnboarding } from "@/lib/onboarding/service";
import { toOnboardingView } from "@/lib/onboarding/serialize";
import {
  NO_STORE_HEADERS,
  jsonError,
  rateLimit,
} from "@/lib/onboarding/routeGuards";
import { ONBOARDING_COOKIE, onboardingCookieOptions } from "@/lib/onboarding/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start a secure-onboarding session.
 *
 * Two preconditions, both non-negotiable:
 *
 *  1. The caller holds a portal session cookie for a session the gateway has
 *     already authorized. Secure onboarding is something a guest does *after*
 *     they are online — the artifacts have to be downloadable, and the guest
 *     has to be able to reach Settings and come back.
 *  2. That session asked for the secure workflow. A guest who took the open
 *     path never reaches here and never causes a row to exist.
 *
 * The response body carries the network's *description* and the method plan.
 * It never carries credential material; that has its own endpoint.
 */
export async function POST(request: NextRequest) {
  if (!hostIsAllowed(request.headers.get("host"), allowedHosts())) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!secureOnboardingConfigured()) {
    return jsonError(
      503,
      "secure_onboarding_unavailable",
      "Secure Wi-Fi setup is not available on this network."
    );
  }

  const sessionId = readSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (!sessionId) {
    return jsonError(401, "no_session", "Your guest session has ended. Reconnect to start again.");
  }

  if (!rateLimit(`create:${sessionId}`, 10)) {
    return jsonError(429, "rate_limited", "Too many requests. Wait a moment and try again.");
  }

  let session;
  try {
    session = await prisma.guestSession.findUnique({ where: { id: sessionId } });
  } catch (err) {
    log.error("onboarding_create_session_lookup_failed", { err });
    return jsonError(503, "unavailable", "Secure setup is temporarily unavailable.");
  }
  if (!session || isExpired(session)) {
    return jsonError(401, "no_session", "Your guest session has ended. Reconnect to start again.");
  }

  // The gateway confirms authorization by sending the browser to /success,
  // which stamps AUTHORIZED. ACCEPTED is allowed too: the approval URL has been
  // issued and the station is being moved, and refusing here would lose a guest
  // to a race they cannot see.
  if (session.status !== "AUTHORIZED" && session.status !== "ACCEPTED") {
    return jsonError(
      409,
      "not_authorized",
      "Finish connecting to the guest network before setting up secure Wi-Fi."
    );
  }

  let body: { platform?: string; maxTouchPoints?: number } = {};
  try {
    const raw = await request.text();
    if (raw) body = JSON.parse(raw);
  } catch {
    // A malformed body is not fatal — header-based detection still works.
    body = {};
  }

  const verdict = detectPlatform({
    ...platformSignalsFromHeaders(request.headers),
    reported: typeof body.platform === "string" ? body.platform : null,
    maxTouchPoints: typeof body.maxTouchPoints === "number" ? body.maxTouchPoints : null,
  });

  let capabilities;
  try {
    capabilities = await networkCapabilities();
  } catch (err) {
    log.warn("onboarding_network_unavailable", { name: (err as Error)?.name });
    return jsonError(
      503,
      "secure_network_unavailable",
      "The secure network's details could not be read. Please try again shortly."
    );
  }

  const plan = planFor(verdict.platform, capabilities.network);
  if (plan.unsupportedReason) {
    return jsonError(
      422,
      "unsupported_platform",
      "Secure Wi-Fi setup is not supported on this device. You can still use the guest network."
    );
  }

  const meta = getRequestMetadata(request.headers);
  let created;
  try {
    created = await createOnboarding({
      session,
      platform: verdict.platform as Platform,
      platformSource: verdict.source,
      network: capabilities.network,
      sourceIp: meta.sourceIp,
      userAgent: meta.userAgent,
    });
  } catch (err) {
    log.error("onboarding_create_failed", { err });
    return jsonError(503, "unavailable", "Secure setup is temporarily unavailable.");
  }

  const response = NextResponse.json(
    {
      onboarding: toOnboardingView(created.record, capabilities.network, plan),
      captiveAssistant: verdict.captiveAssistant,
    },
    { status: 201, headers: NO_STORE_HEADERS }
  );
  response.cookies.set(
    ONBOARDING_COOKIE,
    created.token,
    onboardingCookieOptions(onboardingTtlSeconds())
  );
  return response;
}
