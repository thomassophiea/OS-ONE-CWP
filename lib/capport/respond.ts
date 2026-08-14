/**
 * Shared response construction for the Captive Portal API.
 *
 * One place, because the two routes must be indistinguishable to a client apart
 * from how they identify it — same media type, same headers, same document
 * shape. RFC 8908 §8.1 fixes the media type; §5 fixes the caching.
 */

import { NextResponse } from "next/server";
import type { GuestSession } from "@prisma/client";
import { log } from "@/lib/log";
import { appBaseUrl } from "@/lib/env";
import { secureOnboardingConfigured } from "@/lib/onboarding/providers/skynet";
import {
  CAPPORT_CACHE_CONTROL,
  CAPPORT_CONTENT_TYPE,
  serializeCapportState,
  stateForSession,
  unidentifiedState,
  type CapportContext,
} from "@/lib/capport/state";
import type { CapportIdentification } from "@/lib/capport/resolve";

export function capportContext(): CapportContext {
  return {
    baseUrl: appBaseUrl(),
    // Only advertise the venue URL when there is actually something there.
    secureSetupPath: secureOnboardingConfigured() ? "/portal/secure" : null,
  };
}

export function capportResponse(
  identification: CapportIdentification,
  context: CapportContext
): NextResponse {
  const session: GuestSession | null =
    identification.how === "unidentified" ? null : identification.session;

  const state = session
    ? stateForSession(session, context)
    : unidentifiedState(context);

  // How the answer was reached is worth recording — a deployment silently
  // falling back to `unidentified` on every request looks healthy from the
  // outside and is telling every guest they are captive.
  log.info("capport_state_served", {
    identifiedBy: identification.how,
    reason: identification.how === "unidentified" ? identification.reason : null,
    sessionId: session?.id ?? null,
    clientMac: session?.clientMac ?? null,
    captive: state.captive,
  });

  return new NextResponse(JSON.stringify(serializeCapportState(state)), {
    status: 200,
    headers: {
      "content-type": CAPPORT_CONTENT_TYPE,
      "cache-control": CAPPORT_CACHE_CONTROL,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
