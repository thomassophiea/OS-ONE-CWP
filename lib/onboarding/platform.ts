/**
 * Platform detection for onboarding.
 *
 * Client Hints first, user-agent second. `Sec-CH-UA-Platform` is sent by
 * Chromium browsers without being asked and is not a string the page can get
 * wrong; everything else — Safari, Firefox, every captive-portal webview — only
 * has a user-agent, so the parser stays.
 *
 * Two details matter more than the parsing:
 *
 *  1. **iPadOS lies.** Since iPadOS 13, Safari on iPad sends a desktop macOS
 *     user-agent. `maxTouchPoints > 1` on a "Mac" is the standard tell, and it
 *     is only available client-side — so the client reports it back and the
 *     server upgrades MACOS to IPADOS. Getting this wrong would offer an iPad a
 *     macOS-shaped flow, which happens to still work, so it is a correctness
 *     nicety rather than a functional gate.
 *
 *  2. **The captive assistant is not the browser.** iOS's Captive Network
 *     Assistant and Android's captive portal window are webviews with no
 *     downloads, no profile installation and no way into Settings. Detecting
 *     one changes what the page offers, not what it claims — see
 *     `looksLikeCaptiveAssistant` in `lib/captive/safeRedirect.ts`, which
 *     already encodes the signature and is reused here rather than duplicated.
 */

import { looksLikeCaptiveAssistant } from "@/lib/captive/safeRedirect";

export type Platform = "IOS" | "IPADOS" | "ANDROID" | "MACOS" | "WINDOWS" | "OTHER";

export interface PlatformVerdict {
  platform: Platform;
  /** Where the answer came from, recorded on the onboarding session. */
  source: "client-hints" | "user-agent" | "client-report" | "unknown";
  /** True when the page is rendering inside an OS captive-portal webview. */
  captiveAssistant: boolean;
}

export interface PlatformSignals {
  userAgent?: string | null;
  /** `Sec-CH-UA-Platform`, e.g. `"macOS"`. */
  chPlatform?: string | null;
  /** `Sec-CH-UA-Mobile`, `?1` or `?0`. */
  chMobile?: string | null;
  /** Reported by the page: `navigator.maxTouchPoints`. */
  maxTouchPoints?: number | null;
  /** Reported by the page: an explicit platform it worked out for itself. */
  reported?: string | null;
}

const REPORTABLE = new Set<Platform>(["IOS", "IPADOS", "ANDROID", "MACOS", "WINDOWS", "OTHER"]);

function fromClientHint(value: string | null | undefined): Platform | null {
  if (!value) return null;
  const normalised = value.replace(/^"|"$/g, "").trim().toLowerCase();
  switch (normalised) {
    case "android":
      return "ANDROID";
    case "windows":
      return "WINDOWS";
    case "macos":
      return "MACOS";
    case "ios":
      return "IOS";
    case "chrome os":
    case "chromeos":
    case "linux":
      return "OTHER";
    default:
      return null;
  }
}

function fromUserAgent(ua: string | null | undefined): Platform | null {
  if (!ua) return null;
  // Order matters: Android also matches "Linux", and iPadOS also matches "Mac".
  if (/\bAndroid\b/i.test(ua)) return "ANDROID";
  if (/\biPhone\b|\biPod\b/i.test(ua)) return "IOS";
  if (/\biPad\b/i.test(ua)) return "IPADOS";
  if (/\bWindows NT\b|\bWin64\b|\bWindows Phone\b/i.test(ua)) return "WINDOWS";
  if (/\bMac OS X\b|\bMacintosh\b/i.test(ua)) return "MACOS";
  if (/\bCrOS\b|\bLinux\b|\bX11\b/i.test(ua)) return "OTHER";
  return null;
}

export function detectPlatform(signals: PlatformSignals): PlatformVerdict {
  const captiveAssistant = looksLikeCaptiveAssistant(signals.userAgent);

  // An explicit client report wins when it is one we recognise: only the page
  // can see `navigator.maxTouchPoints` or a `navigator.userAgentData` platform.
  const reported = signals.reported?.trim().toUpperCase();
  if (reported && REPORTABLE.has(reported as Platform) && reported !== "OTHER") {
    return { platform: reported as Platform, source: "client-report", captiveAssistant };
  }

  const hinted = fromClientHint(signals.chPlatform);
  const parsed = fromUserAgent(signals.userAgent);
  let platform = hinted ?? parsed ?? "OTHER";
  let source: PlatformVerdict["source"] = hinted
    ? "client-hints"
    : parsed
      ? "user-agent"
      : "unknown";

  // iPadOS ships a macOS user-agent. A "Mac" with a touchscreen is an iPad.
  if (platform === "MACOS" && (signals.maxTouchPoints ?? 0) > 1) {
    platform = "IPADOS";
    source = "client-report";
  }

  // A Chromium hint of macOS/Windows plus `Sec-CH-UA-Mobile: ?1` is a phone
  // emulating a desktop; trust the mobile flag over the platform string.
  if (signals.chMobile === "?1" && platform === "OTHER") {
    platform = "ANDROID";
    source = "client-hints";
  }

  return { platform, source, captiveAssistant };
}

/** Reads the signals a request carries, before any client report. */
export function platformSignalsFromHeaders(headers: Headers): PlatformSignals {
  return {
    userAgent: headers.get("user-agent"),
    chPlatform: headers.get("sec-ch-ua-platform"),
    chMobile: headers.get("sec-ch-ua-mobile"),
  };
}

export function isApple(platform: Platform): boolean {
  return platform === "IOS" || platform === "IPADOS" || platform === "MACOS";
}

export function isHandheld(platform: Platform): boolean {
  return platform === "IOS" || platform === "IPADOS" || platform === "ANDROID";
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  IOS: "iPhone",
  IPADOS: "iPad",
  ANDROID: "Android",
  MACOS: "Mac",
  WINDOWS: "Windows",
  OTHER: "this device",
};
