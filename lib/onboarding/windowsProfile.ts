/**
 * Windows WLAN profile XML.
 *
 * Windows has no equivalent of an Apple configuration profile: nothing a web
 * page hands a browser can add a Wi-Fi network by itself. What Windows does
 * have is `netsh wlan add profile`, which imports exactly this document. That
 * is a real mechanism, not a workaround — it is how enterprise Wi-Fi is
 * deployed by script — but it needs one command from the guest, so it is
 * offered as a secondary option behind manual setup rather than as the primary.
 *
 * `keyMaterial` is emitted in plaintext with `protected: false`, which is what
 * `netsh` expects on import; Windows encrypts it into the profile store on
 * arrival. The file is served with `no-store` and is as sensitive as the
 * passphrase itself.
 */

import type { SecureNetworkCredential } from "@/lib/onboarding/credentialProvider";

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** SSIDs are carried as hex alongside the string form, as `netsh` exports them. */
function hex(value: string): string {
  return Buffer.from(value, "utf8").toString("hex").toUpperCase();
}

export function buildWindowsWlanProfile(credential: SecureNetworkCredential): string {
  const { network, passphrase } = credential;
  const open = network.security === "open" || !passphrase;

  const security = open
    ? `      <authEncryption>
        <authentication>open</authentication>
        <encryption>none</encryption>
        <useOneX>false</useOneX>
      </authEncryption>`
    : `      <authEncryption>
        <authentication>WPA2PSK</authentication>
        <encryption>AES</encryption>
        <useOneX>false</useOneX>
      </authEncryption>
      <sharedKey>
        <keyType>passPhrase</keyType>
        <protected>false</protected>
        <keyMaterial>${xml(passphrase!)}</keyMaterial>
      </sharedKey>`;

  return `<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>${xml(network.ssid)}</name>
  <SSIDConfig>
    <SSID>
      <hex>${hex(network.ssid)}</hex>
      <name>${xml(network.ssid)}</name>
    </SSID>
    <nonBroadcast>${network.hidden ? "true" : "false"}</nonBroadcast>
  </SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>auto</connectionMode>
  <MSM>
    <security>
${security}
    </security>
  </MSM>
</WLANProfile>
`;
}

export const WINDOWS_PROFILE_CONTENT_TYPE = "application/xml";
export const WINDOWS_PROFILE_FILENAME = "secure-wifi.xml";
