/**
 * What "Set Up Secure Wi-Fi" resolves to, per platform.
 *
 * The user-facing action is the same everywhere. What it resolves to is not,
 * and pretending otherwise is how a guest ends up tapping something that does
 * nothing:
 *
 * | Platform | Primary                     | Why |
 * |----------|-----------------------------|-----|
 * | iPhone   | Apple configuration profile | The only mechanism iOS has for installing a Wi-Fi network from a web page. |
 * | iPad     | Apple configuration profile | Same. |
 * | Mac      | Apple configuration profile | Same, installed from System Settings. |
 * | Android  | Manual                      | Android has **no** web-installable Wi-Fi profile. Its native mechanism is the camera scanning a Wi-Fi QR, which a phone cannot point at its own screen. |
 * | Windows  | Manual                      | Windows can import a WLAN profile, but only via `netsh` from a downloaded file — one command from the guest, so secondary. |
 * | Other    | Manual                      | Always available, never wrong. |
 *
 * **QR is never primary on a phone.** It is offered, labelled for a *different*
 * device, because the trap this table exists to avoid is leaving a guest trying
 * to scan their own screen.
 *
 * Copy lives in the catalogues, not here. This module decides *which* method a
 * platform gets; `describeMethod` turns that decision into the guest's own
 * language. Keeping the two apart is what stops a new platform branch shipping
 * with one hard-coded English string in it.
 */

import type { Platform } from "@/lib/onboarding/platform";
import type { SecureNetwork } from "@/lib/onboarding/credentialProvider";
import { appleProfileSupports, qrSupports } from "@/lib/onboarding/credentialProvider";
import { format, type Messages } from "@/lib/i18n";

export type MethodId = "APPLE_PROFILE" | "WIFI_QR" | "MANUAL" | "WINDOWS_PROFILE";

/** A method as chosen — keys, not sentences. */
export interface OnboardingMethodPlanEntry {
  id: MethodId;
  primary: boolean;
  labelKey: keyof Messages["methods"];
  descriptionKey: keyof Messages["methods"];
  followUpKey: keyof Messages["methods"] | null;
}

/** A method as rendered, in one guest's language. */
export interface OnboardingMethodOption {
  id: MethodId;
  label: string;
  description: string;
  primary: boolean;
  followUp: string | null;
}

export interface MethodPlan {
  platform: Platform;
  entries: OnboardingMethodPlanEntry[];
  unsupportedReason: string | null;
}

function apple(platform: Platform, primary: boolean): OnboardingMethodPlanEntry {
  return {
    id: "APPLE_PROFILE",
    primary,
    labelKey: primary ? "setUpSecureWifi" : "installProfile",
    descriptionKey: platform === "MACOS" ? "appleDescriptionMac" : "appleDescription",
    followUpKey: platform === "MACOS" ? "macFollowUp" : "appleFollowUp",
  };
}

function qr(primary: boolean): OnboardingMethodPlanEntry {
  return {
    id: "WIFI_QR",
    primary,
    labelKey: primary ? "setUpSecureWifi" : "showQr",
    descriptionKey: primary ? "qrDescriptionPrimary" : "qrDescriptionSecondary",
    followUpKey: null,
  };
}

function manual(primary: boolean): OnboardingMethodPlanEntry {
  return {
    id: "MANUAL",
    primary,
    labelKey: primary ? "setUpSecureWifi" : "manualSetup",
    descriptionKey: primary ? "manualDescriptionPrimary" : "manualDescriptionSecondary",
    followUpKey: "manualFollowUp",
  };
}

function windowsProfile(): OnboardingMethodPlanEntry {
  return {
    id: "WINDOWS_PROFILE",
    primary: false,
    labelKey: "downloadWindowsProfile",
    descriptionKey: "windowsDescription",
    followUpKey: "windowsFollowUp",
  };
}

export function planFor(platform: Platform, network: SecureNetwork): MethodPlan {
  const canApple = appleProfileSupports(network.security);
  const canQr = qrSupports(network.security);
  const entries: OnboardingMethodPlanEntry[] = [];

  switch (platform) {
    case "IOS":
    case "IPADOS":
      if (canApple) entries.push(apple(platform, true));
      // On an iPad the QR is genuinely useful — it is a plausible second screen
      // — so it ranks above manual entry. On an iPhone it is not, and is last.
      if (canQr && platform === "IPADOS") entries.push(qr(!canApple));
      entries.push(manual(!canApple && !(canQr && platform === "IPADOS")));
      if (canQr && platform === "IOS") entries.push(qr(false));
      break;

    case "ANDROID":
      // No web-installable profile exists for Android. Manual entry is the
      // mechanism that actually works on the device in the guest's hand.
      entries.push(manual(true));
      if (canQr) entries.push(qr(false));
      break;

    case "MACOS":
      if (canApple) entries.push(apple(platform, true));
      if (canQr) entries.push(qr(!canApple));
      entries.push(manual(!canApple && !canQr));
      break;

    case "WINDOWS":
      entries.push(manual(true));
      entries.push(windowsProfile());
      if (canQr) entries.push(qr(false));
      break;

    default:
      entries.push(manual(true));
      if (canQr) entries.push(qr(false));
      break;
  }

  return {
    platform,
    entries,
    unsupportedReason: entries.length === 0 ? "no supported setup method" : null,
  };
}

export function methodAllowed(plan: MethodPlan, method: MethodId): boolean {
  return plan.entries.some((entry) => entry.id === method);
}

/** Render one planned method in the guest's language. */
export function describeMethod(
  entry: OnboardingMethodPlanEntry,
  messages: Messages,
  network: SecureNetwork
): OnboardingMethodOption {
  const params = { ssid: network.ssid };
  return {
    id: entry.id,
    primary: entry.primary,
    label: format(messages.methods[entry.labelKey], params),
    description: format(messages.methods[entry.descriptionKey], params),
    followUp: entry.followUpKey ? format(messages.methods[entry.followUpKey], params) : null,
  };
}

export function describePlan(
  plan: MethodPlan,
  messages: Messages,
  network: SecureNetwork
): OnboardingMethodOption[] {
  return plan.entries.map((entry) => describeMethod(entry, messages, network));
}
