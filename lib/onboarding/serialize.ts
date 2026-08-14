/**
 * The onboarding session as the page sees it.
 *
 * Everything the frontend needs to render, and nothing else. In particular
 * there is no credential field on this shape at all — the passphrase has its
 * own endpoint, its own explicit user action, and its own `no-store` response,
 * so it cannot arrive by accident in a JSON body that something else caches.
 *
 * Every human-readable string here is produced from the caller's message
 * catalogue. The API is consumed by the portal's own pages, so it answers in
 * the guest's language rather than making each page re-translate an enum.
 */

import type { OnboardingSession } from "@prisma/client";
import type { SecureNetwork } from "@/lib/onboarding/credentialProvider";
import { PLATFORM_LABELS, type Platform } from "@/lib/onboarding/platform";
import { describePlan, type MethodPlan, type OnboardingMethodOption } from "@/lib/onboarding/methods";
import type { Messages } from "@/lib/i18n";

export interface OnboardingView {
  id: string;
  status: OnboardingSession["status"];
  /** What a guest should be told this status means, in their language. */
  statusLabel: string;
  method: OnboardingSession["method"];
  platform: Platform;
  platformLabel: string;
  network: {
    ssid: string;
    /** Machine identifier — never translated, matches the profile and QR. */
    security: string;
    /** The same mode, in words, for a human. */
    securityLabel: string;
    hidden: boolean;
  };
  methods: OnboardingMethodOption[];
  expiresAt: string;
  completedAt: string | null;
  /** True once the gateway has confirmed the device on the secure WLAN. */
  verified: boolean;
}

export function toOnboardingView(
  record: OnboardingSession,
  network: SecureNetwork,
  plan: MethodPlan,
  messages: Messages
): OnboardingView {
  const platform = record.platform as Platform;
  const securityKey = network.security as keyof Messages["security"];
  return {
    id: record.id,
    status: record.status,
    statusLabel:
      messages.onboardingStatus[record.status as keyof Messages["onboardingStatus"]] ??
      record.status,
    method: record.method,
    platform,
    // Device names are proper nouns — an iPhone is an iPhone in every locale.
    platformLabel: PLATFORM_LABELS[platform] ?? PLATFORM_LABELS.OTHER,
    network: {
      ssid: network.ssid,
      security: network.security,
      securityLabel: messages.security[securityKey] ?? network.securityLabel,
      hidden: network.hidden,
    },
    methods: describePlan(plan, messages, network),
    expiresAt: record.expiresAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    verified: record.status === "COMPLETED",
  };
}
