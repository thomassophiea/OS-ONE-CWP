/**
 * What "Set Up Secure Wi-Fi" resolves to, per platform.
 *
 * The user-facing action is the same everywhere; the mechanism behind it is
 * not, and the differences are real rather than cosmetic:
 *
 * | Platform | Primary                    | Why |
 * |----------|----------------------------|-----|
 * | iPhone   | Apple configuration profile | The only mechanism iOS has for installing a Wi-Fi network from a web page. |
 * | iPad     | Apple configuration profile | Same. |
 * | Mac      | Apple configuration profile | Same, installed from Settings > Privacy & Security > Profiles. |
 * | Android  | Manual                      | Android has **no** web-installable Wi-Fi profile. Its native mechanism is the camera scanning a Wi-Fi QR, which a phone cannot point at its own screen. |
 * | Windows  | Manual                      | Windows can import a WLAN profile, but only via `netsh` from a downloaded file — offered as a secondary, never as the primary. |
 * | Other    | Manual                      | Always available, never wrong. |
 *
 * QR is offered wherever the security mode supports it, but it is only ever
 * *primary* on a device that is plausibly being used to onboard a **different**
 * device — a desktop or a tablet. Making QR primary on a phone is the trap this
 * table exists to avoid: the guest ends up trying to scan their own screen.
 */

import type { Platform } from "@/lib/onboarding/platform";
import type { SecureNetwork } from "@/lib/onboarding/credentialProvider";
import { appleProfileSupports, qrSupports } from "@/lib/onboarding/credentialProvider";

export type MethodId = "APPLE_PROFILE" | "WIFI_QR" | "MANUAL" | "WINDOWS_PROFILE";

export interface OnboardingMethodOption {
  id: MethodId;
  /** Button text. The primary option always reads "Set Up Secure Wi-Fi". */
  label: string;
  /** One line under the button. */
  description: string;
  /** True for the single recommended action on this platform. */
  primary: boolean;
  /** Follow-on instruction shown once the artifact has been handed over. */
  followUp: string | null;
}

export interface MethodPlan {
  platform: Platform;
  options: OnboardingMethodOption[];
  /**
   * Set when nothing can be provisioned for this platform and network
   * combination. The page shows this instead of a broken button.
   */
  unsupportedReason: string | null;
}

const APPLE_FOLLOW_UP =
  "Wi-Fi setup downloaded. Open Settings and follow the prompts to finish connecting securely.";
const MAC_FOLLOW_UP =
  "Wi-Fi setup downloaded. Open System Settings > General > VPN & Device Management and install the downloaded profile.";
const WINDOWS_FOLLOW_UP =
  "Profile downloaded. Open a Command Prompt in your Downloads folder and run: netsh wlan add profile filename=\"secure-wifi.xml\"";

function appleOption(network: SecureNetwork, platform: Platform, primary: boolean): OnboardingMethodOption {
  return {
    id: "APPLE_PROFILE",
    label: primary ? "Set Up Secure Wi-Fi" : "Install Wi-Fi Profile",
    description: `Adds ${network.ssid} to this ${platform === "MACOS" ? "Mac" : "device"} and connects automatically from now on.`,
    primary,
    followUp: platform === "MACOS" ? MAC_FOLLOW_UP : APPLE_FOLLOW_UP,
  };
}

function qrOption(network: SecureNetwork, primary: boolean): OnboardingMethodOption {
  return {
    id: "WIFI_QR",
    label: primary ? "Set Up Secure Wi-Fi" : "Show QR Code",
    description: primary
      ? `Scan with the device you want to connect to ${network.ssid}.`
      : "Scan from another phone or tablet to join.",
    primary,
    followUp: null,
  };
}

function manualOption(network: SecureNetwork, primary: boolean): OnboardingMethodOption {
  return {
    id: "MANUAL",
    label: primary ? "Set Up Secure Wi-Fi" : "Manual Setup",
    description: primary
      ? `Shows the details for joining ${network.ssid} from your Wi-Fi settings.`
      : "Show the network name and password to enter yourself.",
    primary,
    followUp: `Open Wi-Fi settings, choose ${network.ssid}, and enter the password shown.`,
  };
}

function windowsProfileOption(): OnboardingMethodOption {
  return {
    id: "WINDOWS_PROFILE",
    label: "Download Windows Profile",
    description: "A WLAN profile you can import with a single command.",
    primary: false,
    followUp: WINDOWS_FOLLOW_UP,
  };
}

export function planFor(platform: Platform, network: SecureNetwork): MethodPlan {
  const canApple = appleProfileSupports(network.security);
  const canQr = qrSupports(network.security);
  const options: OnboardingMethodOption[] = [];

  switch (platform) {
    case "IOS":
    case "IPADOS":
      if (canApple) options.push(appleOption(network, platform, true));
      // On an iPad the QR is genuinely useful — it is a plausible second screen
      // — so it is offered ahead of manual entry. On an iPhone it is not, and
      // is listed last.
      if (canQr && platform === "IPADOS") options.push(qrOption(network, !canApple));
      options.push(manualOption(network, !canApple && !(canQr && platform === "IPADOS")));
      if (canQr && platform === "IOS") options.push(qrOption(network, false));
      break;

    case "ANDROID":
      // No web-installable profile exists for Android. Manual entry is the
      // mechanism that actually works on the device in the guest's hand.
      options.push(manualOption(network, true));
      if (canQr) options.push(qrOption(network, false));
      break;

    case "MACOS":
      if (canApple) options.push(appleOption(network, platform, true));
      if (canQr) options.push(qrOption(network, !canApple));
      options.push(manualOption(network, !canApple && !canQr));
      break;

    case "WINDOWS":
      options.push(manualOption(network, true));
      options.push(windowsProfileOption());
      if (canQr) options.push(qrOption(network, false));
      break;

    default:
      options.push(manualOption(network, true));
      if (canQr) options.push(qrOption(network, false));
      break;
  }

  const unsupportedReason = options.length === 0 ? "no supported setup method" : null;
  return { platform, options, unsupportedReason };
}

export function methodAllowed(plan: MethodPlan, method: MethodId): boolean {
  return plan.options.some((option) => option.id === method);
}
