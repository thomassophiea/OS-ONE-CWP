/**
 * Apple configuration profile (`.mobileconfig`) for one Wi-Fi network.
 *
 * The payload is `com.apple.wifi.managed`. `EncryptionType: WPA` is Apple's
 * label for WPA **and** WPA2 Personal — there is no `WPA2` value, and using one
 * produces a profile iOS refuses to install.
 *
 * **The profile is unsigned.** Signing needs a code-signing identity trusted by
 * the device, and no such identity exists in this environment; inventing a PKI
 * to remove a warning would be more risk than the warning is worth. The
 * consequence is real and is documented rather than hidden: iOS shows the
 * profile as "Unverified" in red on the install screen. It installs and works.
 *
 * Nothing here is cached and nothing is written to disk. The passphrase enters
 * this module as an argument and leaves it inside the response body.
 */

import { createHash } from "crypto";
import type { SecureNetworkCredential } from "@/lib/onboarding/credentialProvider";

/**
 * XML text escaping.
 *
 * An SSID or passphrase containing `&` or `<` would otherwise produce a profile
 * that fails to parse — which iOS reports as a generic "profile could not be
 * installed", giving the guest nothing to act on.
 */
function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Stable per-network payload identifier.
 *
 * Derived from the SSID so that re-running setup replaces the existing profile
 * instead of stacking duplicates in Settings. Derived by hash rather than from
 * the SSID directly so an SSID with characters that are illegal in a reverse-DNS
 * identifier cannot produce an invalid profile.
 */
function identifierFor(ssid: string): string {
  return createHash("sha256").update(ssid, "utf8").digest("hex").slice(0, 16);
}

/**
 * Profile UUIDs.
 *
 * Deterministic per (network, onboarding session): a guest who taps twice gets
 * the same UUID and iOS treats the second download as the same profile, while
 * two different guests never collide.
 */
function uuidFrom(seed: string): string {
  const hex = createHash("sha256").update(seed, "utf8").digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ]
    .join("-")
    .toUpperCase();
}

export interface AppleProfileOptions {
  credential: SecureNetworkCredential;
  /** Onboarding session id — seeds the UUIDs, never appears in the profile. */
  onboardingSessionId: string;
  /** Shown on the install screen. */
  organization: string;
}

export function buildAppleWifiProfile({
  credential,
  onboardingSessionId,
  organization,
}: AppleProfileOptions): string {
  const { network, passphrase } = credential;
  const slug = identifierFor(network.ssid);
  const payloadUuid = uuidFrom(`${onboardingSessionId}|wifi|${network.ssid}`);
  const profileUuid = uuidFrom(`${onboardingSessionId}|profile|${network.ssid}`);

  // `Open` is Apple's value for an unencrypted network; `WPA` covers WPA and
  // WPA2 Personal. WPA3-only has no distinct value and is filtered out before
  // this function is reached.
  const encryptionType = network.security === "open" ? "Open" : "WPA";

  const passwordEntry =
    passphrase && network.security !== "open"
      ? `      <key>Password</key>\n      <string>${xml(passphrase)}</string>\n`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.wifi.managed</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadIdentifier</key>
      <string>net.aura.cwp.wifi.${slug}</string>
      <key>PayloadUUID</key>
      <string>${payloadUuid}</string>
      <key>PayloadDisplayName</key>
      <string>Wi-Fi (${xml(network.ssid)})</string>
      <key>SSID_STR</key>
      <string>${xml(network.ssid)}</string>
      <key>HIDDEN_NETWORK</key>
      <${network.hidden ? "true" : "false"}/>
      <key>AutoJoin</key>
      <true/>
      <key>EncryptionType</key>
      <string>${encryptionType}</string>
${passwordEntry}      <key>ProxyType</key>
      <string>None</string>
    </dict>
  </array>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
  <key>PayloadIdentifier</key>
  <string>net.aura.cwp.profile.${slug}</string>
  <key>PayloadUUID</key>
  <string>${profileUuid}</string>
  <key>PayloadDisplayName</key>
  <string>${xml(network.ssid)} Secure Wi-Fi</string>
  <key>PayloadOrganization</key>
  <string>${xml(organization)}</string>
  <key>PayloadDescription</key>
  <string>Connects this device to the ${xml(network.ssid)} secure wireless network.</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
</dict>
</plist>
`;
}

/** Apple's content type. Anything else and iOS downloads the file as text. */
export const APPLE_PROFILE_CONTENT_TYPE = "application/x-apple-aspen-config";

/**
 * Filename for the download.
 *
 * Deliberately not derived from the SSID: the filename is visible in the
 * browser's download list and in Settings, and it does not need to name the
 * network to be useful.
 */
export const APPLE_PROFILE_FILENAME = "secure-wifi.mobileconfig";
