import { describe, expect, it } from "vitest";
import { describePlan, methodAllowed, planFor } from "@/lib/onboarding/methods";
import { en } from "@/lib/i18n/locales/en";
import type { SecureNetwork } from "@/lib/onboarding/credentialProvider";

const wpa2: SecureNetwork = {
  ssid: "Skynet",
  security: "wpa2-psk",
  hidden: false,
  securityLabel: "WPA2 Personal",
  serviceId: "svc-1",
};

const wpa3: SecureNetwork = { ...wpa2, security: "wpa3-sae", securityLabel: "WPA3 Personal" };

const primaryOf = (platform: Parameters<typeof planFor>[0], network = wpa2) =>
  planFor(platform, network).entries.find((entry) => entry.primary)?.id;

describe("planFor", () => {
  it("gives Apple devices the configuration profile as the primary action", () => {
    expect(primaryOf("IOS")).toBe("APPLE_PROFILE");
    expect(primaryOf("IPADOS")).toBe("APPLE_PROFILE");
    expect(primaryOf("MACOS")).toBe("APPLE_PROFILE");
  });

  it("gives Android manual setup as the primary action", () => {
    // Android has no web-installable Wi-Fi profile, and a phone cannot scan a
    // QR code shown on its own screen.
    expect(primaryOf("ANDROID")).toBe("MANUAL");
  });

  it("never makes QR the primary action on a phone", () => {
    expect(primaryOf("IOS")).not.toBe("WIFI_QR");
    expect(primaryOf("ANDROID")).not.toBe("WIFI_QR");
  });

  it("still offers QR on a phone, for another device", () => {
    expect(methodAllowed(planFor("ANDROID", wpa2), "WIFI_QR")).toBe(true);
    expect(methodAllowed(planFor("IOS", wpa2), "WIFI_QR")).toBe(true);
  });

  it("offers the Windows profile only on Windows", () => {
    expect(methodAllowed(planFor("WINDOWS", wpa2), "WINDOWS_PROFILE")).toBe(true);
    expect(methodAllowed(planFor("ANDROID", wpa2), "WINDOWS_PROFILE")).toBe(false);
    expect(methodAllowed(planFor("IOS", wpa2), "WINDOWS_PROFILE")).toBe(false);
  });

  it("always offers manual setup, on every platform", () => {
    for (const platform of ["IOS", "IPADOS", "ANDROID", "MACOS", "WINDOWS", "OTHER"] as const) {
      expect(methodAllowed(planFor(platform, wpa2), "MANUAL")).toBe(true);
    }
  });

  it("gives an unknown platform a usable plan rather than nothing", () => {
    const plan = planFor("OTHER", wpa2);
    expect(plan.unsupportedReason).toBeNull();
    expect(plan.entries.length).toBeGreaterThan(0);
  });

  it("withdraws QR and the Apple profile on a WPA3-only network", () => {
    // Neither the `WIFI:` grammar nor Apple's `EncryptionType` can express
    // WPA3-only, so offering them would be a button that quietly fails.
    const plan = planFor("IOS", wpa3);
    expect(methodAllowed(plan, "WIFI_QR")).toBe(false);
    expect(methodAllowed(plan, "APPLE_PROFILE")).toBe(false);
    expect(primaryOf("IOS", wpa3)).toBe("MANUAL");
  });

  it("labels exactly one option as primary on every platform", () => {
    for (const platform of ["IOS", "IPADOS", "ANDROID", "MACOS", "WINDOWS", "OTHER"] as const) {
      const primaries = planFor(platform, wpa2).entries.filter((o) => o.primary);
      expect(primaries).toHaveLength(1);
    }
  });

  it("calls the primary action Set Up Secure Wi-Fi whatever it resolves to", () => {
    for (const platform of ["IOS", "IPADOS", "ANDROID", "MACOS", "WINDOWS", "OTHER"] as const) {
      const primary = describePlan(planFor(platform, wpa2), en, wpa2).find((o) => o.primary);
      expect(primary?.label).toBe("Set Up Secure Wi-Fi");
    }
  });
});
