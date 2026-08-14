/**
 * The Captive Portal API state document — RFC 8908.
 *
 * This is the standards-track replacement for "probe a well-known URL and see
 * whether you get redirected". Instead of guessing from an intercepted HTTP
 * response, a client is told where the API is (RFC 8910, DHCP option 114 /
 * DHCPv6 option 103 / RA option 37) and asks it directly.
 *
 * Two things about this file are load-bearing.
 *
 * **The document is derived from the session, never from the request.** A
 * client asking "am I captive?" must not be able to influence the answer, so
 * everything here is a pure function of a `GuestSession` row that the gateway
 * already authorized.
 *
 * **`captive: false` is a claim about network access, not about setup.** A
 * guest who is online but has not finished secure onboarding is *not* captive —
 * saying otherwise would make an operating system re-open a sign-in sheet at a
 * device that is already working. Secure setup is offered through
 * `venue-info-url`, which is exactly what RFC 8908 provides it for.
 */

import type { GuestSession } from "@prisma/client";

/** RFC 8908 §5. Anything not listed here MUST NOT appear in the document. */
export interface CapportState {
  /** Required. Whether the client is in a state of captivity. */
  captive: boolean;
  /** Where to go to get out of captivity. MUST be https. */
  "user-portal-url"?: string;
  /** Informational content the operator wants to share. */
  "venue-info-url"?: string;
  /** Whether the portal can extend the session. */
  "can-extend-session"?: boolean;
  /** Seconds before captivity is reinstated. */
  "seconds-remaining"?: number;
  /** Bytes remaining before captivity is reinstated. */
  "bytes-remaining"?: number;
}

/** RFC 8908 §8.1. */
export const CAPPORT_CONTENT_TYPE = "application/captive+json";

/**
 * RFC 8908 §5: "Captive Portal API servers SHOULD set the Cache-Control header
 * field in any responses to 'private' or a more restrictive value, such as
 * 'no-store'." A cached document is a client told it is free when it is not, or
 * captive when it is not.
 */
export const CAPPORT_CACHE_CONTROL = "private, no-store";

export interface CapportContext {
  /** Public origin of this portal, from APP_BASE_URL. */
  baseUrl: string;
  /** Where secure onboarding lives, when it is configured. */
  secureSetupPath?: string | null;
  now?: Date;
}

/**
 * The answer for a client we could not identify.
 *
 * `captive: true` is the deliberate choice, and it is the safer of two bad
 * options. If we wrongly say captive, a guest who is already online sees one
 * redundant sign-in sheet; tapping it lands on the portal, which *can* identify
 * them from their cookie and immediately confirms they are connected. If we
 * wrongly say free, a genuinely captive guest is told the network is fine, no
 * sheet opens, and they have no route to the portal at all.
 *
 * One recoverable annoyance beats one dead end.
 */
export function unidentifiedState(context: CapportContext): CapportState {
  return {
    captive: true,
    "user-portal-url": new URL("/portal/entry", context.baseUrl).toString(),
  };
}

/** The document for a session we *did* identify. */
export function stateForSession(
  session: GuestSession,
  context: CapportContext
): CapportState {
  const now = context.now ?? new Date();
  // AUTHORIZED only, not ACCEPTED. ACCEPTED means the approval URL was issued
  // and the gateway has not confirmed the role change yet; announcing
  // `captive: false` at that point claims access the network has not granted.
  const authorized = session.status === "AUTHORIZED";

  if (!authorized) {
    return {
      captive: true,
      "user-portal-url": new URL("/portal/entry", context.baseUrl).toString(),
      "can-extend-session": false,
    };
  }

  const state: CapportState = {
    captive: false,
    // Not the sign-in page. This is the "there is something else here for you"
    // slot, and secure Wi-Fi setup is precisely that: optional, post-access,
    // and not a condition of using the network.
    "can-extend-session": true,
  };

  if (context.secureSetupPath) {
    state["venue-info-url"] = new URL(context.secureSetupPath, context.baseUrl).toString();
  }

  // Only ever a real number derived from the session's own expiry, and only
  // when it is still in the future — a negative or zero value would tell a
  // client it is about to be cut off when the truth is that our record aged out.
  if (session.expiresAt) {
    const remaining = Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000);
    if (remaining > 0) state["seconds-remaining"] = remaining;
  }

  return state;
}

/**
 * Strip anything that is not a defined RFC 8908 key.
 *
 * The registry is closed: §8.2 requires new keys to be registered with IANA, so
 * an unregistered key in this document is a conformance bug rather than a
 * harmless extra. This runs on the way out so a future field added to the
 * interface cannot leak into the wire format by accident.
 */
const ALLOWED_KEYS = new Set<keyof CapportState>([
  "captive",
  "user-portal-url",
  "venue-info-url",
  "can-extend-session",
  "seconds-remaining",
  "bytes-remaining",
]);

export function serializeCapportState(state: CapportState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (ALLOWED_KEYS.has(key as keyof CapportState) && value !== undefined) {
      out[key] = value;
    }
  }
  // `captive` is the one required member; never emit a document without it.
  if (typeof out.captive !== "boolean") out.captive = true;
  return out;
}
