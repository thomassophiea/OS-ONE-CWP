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
import { LOCALES } from "@/lib/i18n";

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

/** How guests get on. One choice; it decides whether a page is drawn at all. */
export type PortalAccessPolicy = "open" | "terms" | "form" | "sponsored";

const ACCESS_POLICIES: readonly PortalAccessPolicy[] = ["open", "terms", "form", "sponsored"];

export function isAccessPolicy(value: unknown): value is PortalAccessPolicy {
  return typeof value === "string" && (ACCESS_POLICIES as readonly string[]).includes(value);
}

/**
 * Resolve the stored policy against the deployment. Null derives from what is
 * configured — 'form' when guest fields are enabled, otherwise 'terms' — so a
 * deployment that never chose reproduces pre-existing behaviour exactly.
 * Pure, so the resolution is testable without a database.
 */
export function accessPolicyDecision(
  stored: string | null | undefined,
  fieldsConfigured: boolean
): PortalAccessPolicy {
  if (isAccessPolicy(stored)) return stored;
  return fieldsConfigured ? "form" : "terms";
}

export async function effectiveAccessPolicy(): Promise<PortalAccessPolicy> {
  const [row, fields] = await Promise.all([portalConfigRow(), effectiveGuestFields()]);
  return accessPolicyDecision(row?.accessPolicy, fields.length > 0);
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

// ---------------------------------------------------------------------------
// Look

/** The portal's pre-existing primary colour (Tailwind blue-600). */
export const DEFAULT_BRAND_COLOR = "#2563eb";

export type BrandAlignment = "left" | "center" | "right";

export interface EffectiveBranding {
  color: string;
  alignment: BrandAlignment;
  /**
   * null = the pre-existing portal-name footer line; true = "Powered by
   * Extreme Platform ONE"; false = no footer line at all.
   */
  footer: boolean | null;
}

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

/** WCAG relative luminance of a #rrggbb colour. */
function relativeLuminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio of a colour against white — the ink on the primary button. */
export function contrastAgainstWhite(hex: string): number {
  const l = relativeLuminance(hex);
  return (1 + 0.05) / (l + 0.05);
}

/**
 * A brand colour is acceptable when it parses and its white ink clears
 * WCAG AA (4.5:1). Checked on write and again on read, so a value that
 * predates a rule change degrades to the default instead of shipping
 * unreadable buttons.
 */
export function isAcceptableBrandColor(value: string): boolean {
  return HEX_COLOR_RE.test(value) && contrastAgainstWhite(value) >= 4.5;
}

export async function effectiveBranding(): Promise<EffectiveBranding> {
  const row = await portalConfigRow();
  const color =
    row?.brandColor && isAcceptableBrandColor(row.brandColor)
      ? row.brandColor.toLowerCase()
      : DEFAULT_BRAND_COLOR;
  const alignment: BrandAlignment =
    row?.brandAlignment === "left" || row?.brandAlignment === "right"
      ? row.brandAlignment
      : "center";
  return { color, alignment, footer: row?.brandFooterEnabled ?? null };
}

// ---------------------------------------------------------------------------
// Legal & privacy

/**
 * Defaults for the optional legal documents, from the golden design. They are
 * deliberately not in the i18n catalogues: an operator who switches a
 * document on is expected to paste their own text, and these ship as working
 * copy until they do.
 */
export const DEFAULT_PRIVACY_POLICY_TEXT =
  "We collect only what this portal asks for, use it to give you access, and keep it no longer than the retention period set for this network. We never sell it.";
export const DEFAULT_MARKETING_TEXT =
  "If you opt in, we may email you occasional updates about this venue. You can withdraw consent at any time, and access to the network is never conditional on it.";

export interface EffectiveLegal {
  /** Override for the consent terms; null = the localized default. */
  termsText: string | null;
  privacyPolicy: { enabled: boolean; text: string };
  marketing: { enabled: boolean; text: string };
}

export async function effectiveLegal(): Promise<EffectiveLegal> {
  const row = await portalConfigRow();
  return {
    termsText: row?.termsText?.trim() ? row.termsText : null,
    privacyPolicy: {
      enabled: row?.privacyPolicyEnabled === true,
      text: row?.privacyPolicyText?.trim() ? row.privacyPolicyText : DEFAULT_PRIVACY_POLICY_TEXT,
    },
    marketing: {
      enabled: row?.marketingEnabled === true,
      text: row?.marketingText?.trim() ? row.marketingText : DEFAULT_MARKETING_TEXT,
    },
  };
}

// ---------------------------------------------------------------------------
// Languages

/**
 * The locale codes offered to guests, validated against the shipped set.
 * Null or an entirely-invalid list means all of them — a bad value can
 * narrow the offer, never empty it.
 */
export function enabledLocalesDecision(
  stored: string | null | undefined,
  all: readonly string[]
): string[] {
  const wanted = parseIdList(stored).filter((code) => all.includes(code));
  return wanted.length > 0 ? wanted : [...all];
}

export async function effectiveEnabledLocales(): Promise<string[]> {
  const row = await portalConfigRow();
  return enabledLocalesDecision(
    row?.localesEnabled,
    LOCALES.map((l) => l.code)
  );
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
