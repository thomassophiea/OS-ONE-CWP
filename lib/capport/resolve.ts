/**
 * Working out *which* client is asking.
 *
 * This is the whole difficulty of serving RFC 8908 from off-network. In the
 * ordinary deployment the API server sits at the client's L3 edge and reads the
 * source address — RFC 8908 §4: "If the identifier used by the Captive Portal
 * system is the client's set of IP addresses, the system needs to ensure that
 * the same IP addresses are visible to both the API server and the enforcement
 * device."
 *
 * That does not hold here. This portal runs on Railway; every guest at the site
 * arrives through the same NAT, so the source address identifies the *site*,
 * not the station. The RFC's own answer to that is the next sentence of §4:
 * "If the API server needs information about the client identity that is not
 * otherwise visible to it, the URI provided to the client during provisioning
 * SHOULD be distinct per client."
 *
 * So identification is attempted in descending order of certainty, and the
 * moment it stops being certain it stops guessing.
 */

import type { GuestSession } from "@prisma/client";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { capportTokenSecret } from "@/lib/env";

export type CapportIdentification =
  | { how: "per-client-uri"; session: GuestSession }
  | { how: "session-cookie"; session: GuestSession }
  | { how: "source-address"; session: GuestSession }
  | { how: "unidentified"; reason: "no-token" | "unknown-token" | "ambiguous-address" };

export function hashCapportToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * The per-client token for a station, derived from its MAC.
 *
 * Derived rather than random, and that is the whole point. DHCP happens before
 * the guest ever reaches the portal, so a randomly-minted per-session token
 * could not be in the URI the network already handed out. An HMAC of the MAC
 * can be computed independently by both sides from information they each
 * already have, with no registration step, no lookup service, and no ordering
 * requirement between them.
 *
 * HMAC rather than a plain hash so the token is not enumerable: without the
 * secret, knowing a MAC does not let anyone ask about that device.
 *
 * Returns null when no secret is configured — the per-client URI is then
 * unavailable, which is a missing capability rather than a failure.
 */
export function capportTokenForMac(macAddress: string | null | undefined): string | null {
  const secret = capportTokenSecret();
  if (!secret || !macAddress) return null;
  return createHmac("sha256", secret)
    .update(macAddress.trim().toLowerCase(), "utf8")
    .digest("base64url")
    .slice(0, 43);
}

export function capportTokenMatches(
  token: string | null | undefined,
  storedHash: string | null | undefined
): boolean {
  if (!token || !storedHash) return false;
  const a = Buffer.from(hashCapportToken(token), "utf8");
  const b = Buffer.from(storedHash, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * RFC 8908 §4's per-client URI. The most certain identification available.
 *
 * The most *recent* session for the device, not a unique one. The token is
 * derived from the MAC and is therefore stable across visits — which is the
 * property that makes DHCP provisioning possible at all — so a device that
 * reconnects has several sessions carrying it. The current one is the only
 * honest answer to "am I captive right now?".
 */
export async function bySessionToken(token: string): Promise<GuestSession | null> {
  if (!token) return null;
  try {
    return await prisma.guestSession.findFirst({
      where: { capportTokenHash: hashCapportToken(token) },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    log.error("capport_token_lookup_failed", { err });
    return null;
  }
}

/**
 * Source-address identification, applied honestly.
 *
 * Correct only when exactly one live session carries this address. Behind a
 * site NAT that is true for a single guest and false for a busy lobby, and the
 * difference is not something to average over — two candidates means the answer
 * is unknown, not "probably the newest one". Reporting `ambiguous-address` and
 * falling back is the only honest outcome.
 */
export async function bySourceAddress(
  sourceIp: string | null,
  now = new Date()
): Promise<{ session: GuestSession | null; ambiguous: boolean }> {
  if (!sourceIp) return { session: null, ambiguous: false };
  try {
    const candidates = await prisma.guestSession.findMany({
      where: {
        sourceIp,
        expiresAt: { gt: now },
        status: { in: ["STARTED", "ACCEPTED", "AUTHORIZED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 2,
    });
    if (candidates.length === 1) return { session: candidates[0], ambiguous: false };
    return { session: null, ambiguous: candidates.length > 1 };
  } catch (err) {
    log.error("capport_address_lookup_failed", { err });
    return { session: null, ambiguous: false };
  }
}
