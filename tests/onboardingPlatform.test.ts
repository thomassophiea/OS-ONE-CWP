import { describe, expect, it } from "vitest";
import { detectPlatform } from "@/lib/onboarding/platform";

/**
 * Real user-agent strings, not invented ones. The cases that matter are the
 * ones where the obvious parse is wrong: iPadOS claiming to be a Mac, and the
 * captive-portal webviews, which are the browsers this feature has to behave
 * differently inside.
 */
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const WINDOWS_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";
const IOS_CAPTIVE_ASSISTANT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const MACOS_CAPTIVE_ASSISTANT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)";

describe("detectPlatform", () => {
  it("identifies an iPhone from its user-agent", () => {
    const verdict = detectPlatform({ userAgent: IPHONE_SAFARI });
    expect(verdict.platform).toBe("IOS");
    expect(verdict.captiveAssistant).toBe(false);
  });

  it("identifies Android from its user-agent, not as Linux", () => {
    expect(detectPlatform({ userAgent: ANDROID_CHROME }).platform).toBe("ANDROID");
  });

  it("prefers the client hint over the user-agent", () => {
    const verdict = detectPlatform({
      userAgent: ANDROID_CHROME,
      chPlatform: '"Windows"',
    });
    expect(verdict.platform).toBe("WINDOWS");
    expect(verdict.source).toBe("client-hints");
  });

  it("identifies Windows", () => {
    expect(detectPlatform({ userAgent: WINDOWS_EDGE }).platform).toBe("WINDOWS");
  });

  it("treats a Mac user-agent without touch as macOS", () => {
    const verdict = detectPlatform({ userAgent: MAC_SAFARI, maxTouchPoints: 0 });
    expect(verdict.platform).toBe("MACOS");
  });

  it("treats a Mac user-agent with touch points as an iPad", () => {
    // iPadOS 13+ sends a desktop macOS user-agent; touch points are the tell.
    const verdict = detectPlatform({ userAgent: IPAD_SAFARI, maxTouchPoints: 5 });
    expect(verdict.platform).toBe("IPADOS");
    expect(verdict.source).toBe("client-report");
  });

  it("honours an explicit client report", () => {
    const verdict = detectPlatform({ userAgent: MAC_SAFARI, reported: "IPADOS" });
    expect(verdict.platform).toBe("IPADOS");
    expect(verdict.source).toBe("client-report");
  });

  it("ignores a client report it does not recognise", () => {
    const verdict = detectPlatform({ userAgent: ANDROID_CHROME, reported: "PWNED" });
    expect(verdict.platform).toBe("ANDROID");
  });

  it("flags the iOS captive network assistant", () => {
    const verdict = detectPlatform({ userAgent: IOS_CAPTIVE_ASSISTANT });
    expect(verdict.platform).toBe("IOS");
    expect(verdict.captiveAssistant).toBe(true);
  });

  it("flags the macOS captive network assistant", () => {
    expect(detectPlatform({ userAgent: MACOS_CAPTIVE_ASSISTANT }).captiveAssistant).toBe(true);
  });

  it("falls back to OTHER rather than guessing", () => {
    const verdict = detectPlatform({ userAgent: "curl/8.4.0" });
    expect(verdict.platform).toBe("OTHER");
    expect(verdict.source).toBe("unknown");
  });

  it("survives no signals at all", () => {
    expect(detectPlatform({}).platform).toBe("OTHER");
  });
});
