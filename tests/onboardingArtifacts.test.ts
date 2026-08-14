import { describe, expect, it } from "vitest";
import { buildAppleWifiProfile } from "@/lib/onboarding/appleProfile";
import { buildWifiUri, escapeWifiField, buildWifiQrSvg } from "@/lib/onboarding/wifiQr";
import { buildWindowsWlanProfile } from "@/lib/onboarding/windowsProfile";
import { securityFromPrivacy } from "@/lib/onboarding/providers/skynet";
import type { SecureNetworkCredential } from "@/lib/onboarding/credentialProvider";

const credential = (
  overrides: Partial<SecureNetworkCredential["network"]> = {},
  passphrase: string | null = "s3cr3t-pass"
): SecureNetworkCredential => ({
  network: {
    ssid: "Skynet",
    security: "wpa2-psk",
    hidden: false,
    securityLabel: "WPA2 Personal",
    serviceId: "svc-1",
    ...overrides,
  },
  passphrase,
  perDevice: false,
  expiresAt: null,
});

describe("securityFromPrivacy", () => {
  it("reads WPA2 Personal from a WpaPskElement", () => {
    const result = securityFromPrivacy({
      WpaPskElement: { mode: "aesOnly", presharedKey: "abc123", keyHexEncoded: false },
    });
    expect(result.security).toBe("wpa2-psk");
    expect(result.passphrase).toBe("abc123");
  });

  it("reads WPA3 from a WpaSaeElement", () => {
    const result = securityFromPrivacy({
      WpaSaeElement: { mode: "aesOnly", presharedKey: "abc123" },
    });
    expect(result.security).toBe("wpa3-sae");
  });

  it("reads a transition-mode SAE element as WPA2/WPA3", () => {
    const result = securityFromPrivacy({
      WpaSaeElement: { mode: "mixed", presharedKey: "abc123" },
    });
    expect(result.security).toBe("wpa2-wpa3-psk");
  });

  it("treats no privacy element as an open network", () => {
    expect(securityFromPrivacy(null).security).toBe("open");
    expect(securityFromPrivacy({}).security).toBe("open");
  });
});

describe("buildAppleWifiProfile", () => {
  const profile = buildAppleWifiProfile({
    credential: credential(),
    onboardingSessionId: "onb_1",
    organization: "Skynet",
  });

  it("declares the managed Wi-Fi payload type", () => {
    expect(profile).toContain("<string>com.apple.wifi.managed</string>");
  });

  it("uses WPA as the encryption type", () => {
    // Apple has no `WPA2` value; `WPA` is its label for WPA/WPA2 Personal, and
    // anything else produces a profile iOS refuses to install.
    expect(profile).toContain("<key>EncryptionType</key>\n      <string>WPA</string>");
  });

  it("carries the SSID and the passphrase", () => {
    expect(profile).toContain("<key>SSID_STR</key>\n      <string>Skynet</string>");
    expect(profile).toContain("<string>s3cr3t-pass</string>");
  });

  it("enables auto-join", () => {
    expect(profile).toContain("<key>AutoJoin</key>\n      <true/>");
  });

  it("is well-formed plist XML", () => {
    expect(profile.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(profile.trimEnd().endsWith("</plist>")).toBe(true);
  });

  it("escapes XML metacharacters in the SSID and passphrase", () => {
    const nasty = buildAppleWifiProfile({
      credential: credential({ ssid: 'A&B<C>"D"' }, "p&ss<word>"),
      onboardingSessionId: "onb_2",
      organization: "Org",
    });
    expect(nasty).not.toMatch(/<string>A&B/);
    expect(nasty).toContain("A&amp;B&lt;C&gt;&quot;D&quot;");
    expect(nasty).toContain("p&amp;ss&lt;word&gt;");
  });

  it("omits the password for an open network", () => {
    const open = buildAppleWifiProfile({
      credential: credential({ security: "open", securityLabel: "Open" }, null),
      onboardingSessionId: "onb_3",
      organization: "Org",
    });
    expect(open).toContain("<string>Open</string>");
    expect(open).not.toContain("<key>Password</key>");
  });

  it("is deterministic for the same onboarding session", () => {
    const again = buildAppleWifiProfile({
      credential: credential(),
      onboardingSessionId: "onb_1",
      organization: "Skynet",
    });
    // Same UUIDs, so a second tap replaces the profile rather than stacking one.
    expect(again).toBe(profile);
  });

  it("does not embed the onboarding session id", () => {
    expect(profile).not.toContain("onb_1");
  });
});

describe("Wi-Fi QR", () => {
  it("builds the standard WIFI: payload", () => {
    expect(buildWifiUri(credential())).toBe("WIFI:T:WPA;S:Skynet;P:s3cr3t-pass;;");
  });

  it("escapes the reserved characters", () => {
    expect(escapeWifiField('a;b,c:d"e\\f')).toBe('a\\;b\\,c\\:d\\"e\\\\f');
  });

  it("escapes reserved characters inside the SSID and passphrase", () => {
    const uri = buildWifiUri(credential({ ssid: "Guest;Net" }, "pa:ss,word"));
    expect(uri).toBe("WIFI:T:WPA;S:Guest\\;Net;P:pa\\:ss\\,word;;");
  });

  it("marks a hidden network", () => {
    expect(buildWifiUri(credential({ hidden: true }))).toContain(";H:true;");
  });

  it("uses nopass and omits the password for an open network", () => {
    const uri = buildWifiUri(credential({ security: "open" }, null));
    expect(uri).toBe("WIFI:T:nopass;S:Skynet;;");
  });

  it("renders an SVG", async () => {
    const svg = await buildWifiQrSvg(credential());
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    // The credential is encoded as modules, never as readable text.
    expect(svg).not.toContain("s3cr3t-pass");
  });
});

describe("buildWindowsWlanProfile", () => {
  const xml = buildWindowsWlanProfile(credential());

  it("names the network in both string and hex form", () => {
    expect(xml).toContain("<name>Skynet</name>");
    expect(xml).toContain(`<hex>${Buffer.from("Skynet").toString("hex").toUpperCase()}</hex>`);
  });

  it("declares WPA2PSK with AES", () => {
    expect(xml).toContain("<authentication>WPA2PSK</authentication>");
    expect(xml).toContain("<encryption>AES</encryption>");
  });

  it("carries the passphrase as importable key material", () => {
    expect(xml).toContain("<keyMaterial>s3cr3t-pass</keyMaterial>");
    expect(xml).toContain("<protected>false</protected>");
  });

  it("emits an open profile with no shared key", () => {
    const open = buildWindowsWlanProfile(credential({ security: "open" }, null));
    expect(open).toContain("<authentication>open</authentication>");
    expect(open).not.toContain("sharedKey");
  });

  it("escapes XML metacharacters", () => {
    const nasty = buildWindowsWlanProfile(credential({ ssid: "A&B" }, "p<w>"));
    expect(nasty).toContain("<name>A&amp;B</name>");
    expect(nasty).toContain("<keyMaterial>p&lt;w&gt;</keyMaterial>");
  });
});
