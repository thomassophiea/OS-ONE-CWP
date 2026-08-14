/**
 * The onboarding session as the page sees it.
 *
 * Everything the frontend needs to render, and nothing else. In particular
 * there is no credential field on this shape at all — the passphrase has its
 * own endpoint, its own explicit user action, and its own `no-store` response,
 * so it cannot arrive by accident in a JSON body that something else caches.
 */

import type { OnboardingSession } from "@prisma/client";
import type { SecureNetwork } from "@/lib/onboarding/credentialProvider";
import { PLATFORM_LABELS, type Platform } from "@/lib/onboarding/platform";
import type { MethodPlan } from "@/lib/onboarding/methods";

export interface OnboardingView {
  id: string;
  status: OnboardingSession["status"];
  /** What a guest should be told this status means. */
  statusLabel: string;
  method: OnboardingSession["method"];
  platform: Platform;
  platformLabel: string;
  network: {
    ssid: string;
    security: string;
    securityLabel: string;
    hidden: boolean;
  };
  methods: MethodPlan["options"];
  expiresAt: string;
  completedAt: string | null;
  /** True once the gateway has confirmed the device on the secure WLAN. */
  verified: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  OFFERED: "Secure setup available",
  STARTED: "Ready to set up",
  PROFILE_DOWNLOADED: "Wi-Fi setup downloaded",
  QR_DISPLAYED: "QR code shown",
  MANUAL_SETUP_VIEWED: "Setup details shown",
  COMPLETED: "Connected to the secure network",
  FAILED: "Secure setup could not be completed",
  EXPIRED: "Secure setup session ended",
};

export function toOnboardingView(
  record: OnboardingSession,
  network: SecureNetwork,
  plan: MethodPlan
): OnboardingView {
  const platform = record.platform as Platform;
  return {
    id: record.id,
    status: record.status,
    statusLabel: STATUS_LABELS[record.status] ?? record.status,
    method: record.method,
    platform,
    platformLabel: PLATFORM_LABELS[platform] ?? PLATFORM_LABELS.OTHER,
    network: {
      ssid: network.ssid,
      security: network.security,
      securityLabel: network.securityLabel,
      hidden: network.hidden,
    },
    methods: plan.options,
    expiresAt: record.expiresAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    verified: record.status === "COMPLETED",
  };
}
