import type { PortalConfig } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import {
  emailTransportKind,
  sponsorAllowedDomains as envSponsorDomains,
  sponsorshipMaxPerSession as envMaxPerSession,
  sponsorshipTtlSeconds as envTtlSeconds,
} from "@/lib/env";
import {
  configuredGuestFields,
  guestFieldsFromLists,
  type ConfiguredGuestField,
} from "@/lib/guestFields/registry";
import { secureOnboardingConfigured } from "@/lib/onboarding/providers/skynet";

/**
 * The effective portal configuration: the operator-managed `PortalConfig` row
 * overlaid on the environment.
 *
 * Two properties are load-bearing:
 *
 * - **Null always falls through.** A column that was never set changes
 *   nothing, so a deployment with no row behaves exactly as env-only did, and
 *   deleting a value in AURA is "go back to the deployed default", never
 *   "turn the feature off by accident".
 * - **A config read can never take the guest flow down.** The row is read
 *   through a short in-memory cache and every failure degrades to the
 *   environment values — the same posture the ledger lookup takes.
 *
 * The email transport is deliberately *not* configurable from here: it names
 * credentials, and credentials stay in the environment.
 */

export interface EffectiveSponsorshipConfig {
  /** Whether the consent form offers sponsorship at all. */
  enabled: boolean;
  domains: string[];
  /** Exact-address allowlist; empty means any mailbox at an allowed domain. */
  addresses: string[];
  ttlSeconds: number;
  maxPerSession: number;
}

const CACHE_TTL_MS = 15_000;
let cache: { row: PortalConfig | null; fetchedAt: number } | null = null;

/** For domains and addresses, which are matched case-insensitively. */
function parseLowerList(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

/** For registry ids, whose case is significant (`fullName`). */
function parseIdList(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** The stored row, cached briefly; null when absent or unreadable. */
export async function portalConfigRow(): Promise<PortalConfig | null> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.row;
  try {
    const row = await prisma.portalConfig.findUnique({ where: { id: "default" } });
    cache = { row, fetchedAt: now };
    return row;
  } catch (err) {
    log.error("portal_config_read_failed", { err });
    // Keep whatever we had; absent that, behave as env-only.
    return cache?.row ?? null;
  }
}

/** Drop the cache — called after a write so the next read sees it. */
export function invalidatePortalConfigCache(): void {
  cache = null;
}

export async function effectiveSponsorship(): Promise<EffectiveSponsorshipConfig> {
  const row = await portalConfigRow();

  const domains =
    row?.sponsorAllowedDomains != null
      ? parseLowerList(row.sponsorAllowedDomains)
      : envSponsorDomains();
  const addresses = parseLowerList(row?.sponsorAllowedAddresses);
  const ttlSeconds =
    row?.sponsorshipTtlSeconds != null && row.sponsorshipTtlSeconds > 0
      ? row.sponsorshipTtlSeconds
      : envTtlSeconds();
  const maxPerSession =
    row?.sponsorshipMaxPerSession != null && row.sponsorshipMaxPerSession > 0
      ? row.sponsorshipMaxPerSession
      : envMaxPerSession();

  // The operator switch can force the feature off; it can never conjure it
  // without domains and a transport, because a request nobody can be emailed
  // about is a guest stranded on a waiting page.
  const configured = domains.length > 0 && emailTransportKind() !== null;
  const enabled = configured && row?.sponsorshipEnabled !== false;

  return { enabled, domains, addresses, ttlSeconds, maxPerSession };
}

export interface EffectiveSecureAccessConfig {
  /** A secure WLAN exists in the environment, so the offer is possible. */
  configured: boolean;
  /** The consent form actually offers it. */
  enabled: boolean;
}

/**
 * The operator switch follows the sponsorship rule: it can force the offer
 * off, never conjure it without a configured secure WLAN. Pure so the
 * decision is testable without a database.
 */
export function secureAccessDecision(
  configured: boolean,
  stored: boolean | null | undefined
): EffectiveSecureAccessConfig {
  return { configured, enabled: configured && stored !== false };
}

export async function effectiveSecureAccess(): Promise<EffectiveSecureAccessConfig> {
  const configured = secureOnboardingConfigured();
  if (!configured) return secureAccessDecision(configured, null);
  const row = await portalConfigRow();
  return secureAccessDecision(configured, row?.secureAccessEnabled);
}

/** The guest fields this deployment collects, operator overlay applied. */
export async function effectiveGuestFields(): Promise<ConfiguredGuestField[]> {
  const row = await portalConfigRow();
  if (row?.guestFieldsEnabled == null) return configuredGuestFields();
  return guestFieldsFromLists(
    parseIdList(row.guestFieldsEnabled),
    parseIdList(row.guestFieldsRequired)
  );
}
