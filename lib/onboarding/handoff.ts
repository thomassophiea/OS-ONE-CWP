/**
 * Carrying a portal session out of the OS captive-portal window.
 *
 * The problem, measured on macOS on 2026-08-14: the Captive Network Assistant
 * and Safari are separate applications with separate cookie stores. Handing a
 * guest from one to the other with a plain link sends them to a page that
 * cannot see their session cookie, so a session that is seconds old and fully
 * AUTHORIZED renders as "Your session has ended". Verified directly — the same
 * URL returns 200 with the assistant's cookie and `no_session` from any other
 * jar. iOS behaves the same way.
 *
 * A cookie cannot cross that boundary, so something in the URL has to. This is
 * that something: a single-use, short-lived, opaque token that re-establishes
 * the session cookie in whichever browser redeems it, and is then dropped from
 * the address bar by an immediate redirect.
 *
 * What it deliberately is **not**: it is not the onboarding token, and it grants
 * no access to any credential-bearing endpoint. Redeeming it restores exactly
 * one thing — the portal session cookie for a session the gateway has already
 * authorized. The onboarding session, and its own HttpOnly token, are then
 * minted fresh in the new browser through the ordinary path.
 *
 * Why the exposure is acceptable, stated plainly rather than assumed: the token
 * appears only in a link rendered on the guest's own screen, it is valid for
 * ten minutes, it works exactly once, and what it ultimately leads to is a
 * shared Wi-Fi passphrase that every other guest in the building also has. The
 * redemption is audited with its source address so a redemption from somewhere
 * unexpected is visible afterwards.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { GuestSession } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { audit } from "@/lib/session/repository";

/**
 * Ten minutes. The guest is standing at the device with the link on screen —
 * this is a walk-across-the-room window, not a session lifetime.
 */
export const HANDOFF_TTL_SECONDS = 600;

export function hashHandoffToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Mint the hand-off token for a session.
 *
 * A fresh token on every render, which is the only option available: the raw
 * token is never stored, so an existing one cannot be re-emitted. That is
 * harmless here because the only thing that re-renders this page is the guest
 * reloading it, and the link they are looking at is replaced at the same
 * moment.
 *
 * Returns null if a token cannot be issued, so the caller renders the page
 * without a hand-off link rather than failing outright.
 */
export async function issueHandoffToken(session: GuestSession): Promise<string | null> {
  // Only for a session the gateway has already approved. There is nothing to
  // hand over before that, and the guest should be finishing the open flow.
  if (session.status !== "AUTHORIZED" && session.status !== "ACCEPTED") return null;

  const token = randomBytes(32).toString("base64url");
  const now = new Date();

  try {
    await prisma.guestSession.update({
      where: { id: session.id },
      data: {
        handoffTokenHash: hashHandoffToken(token),
        handoffExpiresAt: new Date(now.getTime() + HANDOFF_TTL_SECONDS * 1000),
        handoffUsedAt: null,
        handoffUsedIp: null,
      },
    });
  } catch (err) {
    log.error("handoff_issue_failed", { sessionId: session.id, err });
    return null;
  }

  return token;
}

export type HandoffRedemption =
  | { ok: true; session: GuestSession }
  | { ok: false; reason: "missing" | "unknown" | "used" | "expired" | "unavailable" };

/**
 * Redeem a hand-off token, exactly once.
 *
 * The burn is a single conditional `updateMany` rather than a read followed by
 * a write: two tabs redeeming the same link at the same moment would otherwise
 * both pass the read. The unique index on `handoffTokenHash` is what makes the
 * `where` select at most one row.
 */
export async function redeemHandoffToken(
  token: string | null | undefined,
  sourceIp: string | null,
  sessionTtlSeconds: number
): Promise<HandoffRedemption> {
  if (!token) return { ok: false, reason: "missing" };

  const hash = hashHandoffToken(token);
  const now = new Date();

  try {
    const burnt = await prisma.guestSession.updateMany({
      where: {
        handoffTokenHash: hash,
        handoffUsedAt: null,
        handoffExpiresAt: { gt: now },
      },
      data: {
        handoffUsedAt: now,
        handoffUsedIp: sourceIp,
        // Restart the session clock. A guest who read the instructions for a
        // few minutes before tapping the link would otherwise arrive in the new
        // browser and be told their session had ended — which is the exact
        // failure this whole mechanism exists to remove, arriving by a
        // different door.
        expiresAt: new Date(now.getTime() + sessionTtlSeconds * 1000),
      },
    });

    if (burnt.count === 0) {
      // Distinguish the reasons for the audit trail only — the guest is shown
      // one message either way.
      const existing = await prisma.guestSession.findUnique({
        where: { handoffTokenHash: hash },
        select: { id: true, handoffUsedAt: true, handoffExpiresAt: true },
      });
      if (!existing) return { ok: false, reason: "unknown" };
      if (existing.handoffUsedAt) {
        await audit(existing.id, "HANDOFF_REPLAYED", "warn", { sourceIp });
        return { ok: false, reason: "used" };
      }
      return { ok: false, reason: "expired" };
    }

    const session = await prisma.guestSession.findUnique({
      where: { handoffTokenHash: hash },
    });
    if (!session) return { ok: false, reason: "unavailable" };

    await audit(session.id, "HANDOFF_REDEEMED", "info", {
      clientMac: session.clientMac,
      ssid: session.ssid,
      sourceIp,
      // Recorded so a redemption from an unexpected address is visible after
      // the fact. Never the token itself.
      matchedSourceIp: sourceIp !== null && sourceIp === session.sourceIp,
    });

    return { ok: true, session };
  } catch (err) {
    log.error("handoff_redeem_failed", { err });
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Constant-time comparison helper, exported for tests.
 *
 * Redemption itself matches on the stored hash through a unique index, so the
 * database does the lookup; this exists so the hashing contract is testable.
 */
export function handoffTokenMatches(
  token: string | null | undefined,
  storedHash: string | null | undefined
): boolean {
  if (!token || !storedHash) return false;
  const a = Buffer.from(hashHandoffToken(token), "utf8");
  const b = Buffer.from(storedHash, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
