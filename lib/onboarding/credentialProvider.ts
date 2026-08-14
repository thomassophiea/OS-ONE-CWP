/**
 * The seam between "how a device is provisioned" and "what credential it is
 * provisioned with".
 *
 * Everything upstream of this file — platform detection, the Apple profile
 * generator, the QR encoder, the manual-setup view, the onboarding session
 * lifecycle, the join verification — is written against `SecureNetwork` and
 * `SecureNetworkCredential` and knows nothing about Skynet. Today one provider
 * answers, by reading the WLAN off the gateway. When per-device PPSK exists, a
 * second provider mints a per-device key and returns it through the same two
 * types, and nothing above this line changes.
 *
 * The split inside the interface is the point: `describe()` returns what can be
 * shown to anyone (SSID, security mode), `issue()` returns credential material
 * and is only ever called from a server route that has already validated an
 * onboarding session.
 */

/** Security modes the provisioning layer knows how to express. */
export type SecureNetworkSecurity =
  | "wpa2-psk"
  | "wpa3-sae"
  | "wpa2-wpa3-psk"
  | "open";

/** Non-secret description of the target network. Safe to render anywhere. */
export interface SecureNetwork {
  ssid: string;
  security: SecureNetworkSecurity;
  hidden: boolean;
  /** Human label for the security mode, e.g. "WPA2 Personal". */
  securityLabel: string;
  /** Gateway service id, used to verify a station actually joined. */
  serviceId: string | null;
}

/**
 * Credential material for one provisioning act.
 *
 * `perDevice` is what makes the difference between today and PPSK legible to
 * everything downstream: a shared key must never be described to the guest as
 * "your personal key", and a per-device key can be safely revoked on its own.
 */
export interface SecureNetworkCredential {
  network: SecureNetwork;
  /** Absent for an open network. */
  passphrase: string | null;
  /** True when this credential belongs to exactly one device. */
  perDevice: boolean;
  /** When the credential stops working, if it ever does. */
  expiresAt: Date | null;
}

export interface CredentialIssueContext {
  onboardingSessionId: string;
  clientMac: string | null;
  platform: string;
}

export interface CredentialProvider {
  /** Stable identifier recorded on the onboarding session. */
  readonly id: string;
  /** Non-secret description of the network. Never touches credential material. */
  describe(): Promise<SecureNetwork>;
  /** Credential material for one provisioning act. Server-side callers only. */
  issue(context: CredentialIssueContext): Promise<SecureNetworkCredential>;
}

export class CredentialUnavailableError extends Error {
  constructor(
    message: string,
    public readonly providerId: string
  ) {
    super(message);
    this.name = "CredentialUnavailableError";
  }
}

const SECURITY_LABELS: Record<SecureNetworkSecurity, string> = {
  "wpa2-psk": "WPA2 Personal",
  "wpa3-sae": "WPA3 Personal",
  "wpa2-wpa3-psk": "WPA2/WPA3 Personal",
  open: "Open",
};

export function securityLabel(security: SecureNetworkSecurity): string {
  return SECURITY_LABELS[security];
}

/**
 * Whether a security mode can be expressed in the standard Wi-Fi QR grammar.
 *
 * `WIFI:T:WPA` covers WPA/WPA2 Personal and is what iOS and Android camera apps
 * implement. WPA3-only is not reliably handled by either, so it is excluded
 * rather than offered and quietly failing.
 */
export function qrSupports(security: SecureNetworkSecurity): boolean {
  return security === "wpa2-psk" || security === "open";
}

/**
 * Whether an Apple `com.apple.wifi.managed` payload can carry this mode.
 * `EncryptionType: WPA` is Apple's label for WPA/WPA2 Personal.
 */
export function appleProfileSupports(security: SecureNetworkSecurity): boolean {
  return security === "wpa2-psk" || security === "wpa2-wpa3-psk" || security === "open";
}
