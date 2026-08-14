/**
 * The credential provider in use today: one shared WPA2-Personal WLAN,
 * configured on the gateway, with its passphrase read from the gateway rather
 * than copied into this application's configuration.
 *
 * Reading the live WLAN is what keeps this honest — the security mode the
 * profile generator emits is the mode the controller is actually running, so
 * rotating the key or moving to WPA3 on the gateway cannot leave the portal
 * handing out a stale credential or mislabelling the network.
 *
 * `SECURE_WLAN_PSK` is a fallback, not the source of truth. It exists so a
 * gateway outage degrades the secure workflow to "works, from last known
 * configuration" instead of "unavailable"; without it, an outage simply means
 * the secure option cannot be offered.
 */

import {
  appleProfileSupports,
  CredentialUnavailableError,
  qrSupports,
  securityLabel,
  type CredentialIssueContext,
  type CredentialProvider,
  type SecureNetwork,
  type SecureNetworkCredential,
  type SecureNetworkSecurity,
} from "@/lib/onboarding/credentialProvider";
import {
  gatewayConfigured,
  readWlan,
  type GatewayWlan,
} from "@/lib/onboarding/gatewayClient";
import {
  secureWlanServiceId,
  secureWlanSsid,
  secureWlanStaticPassphrase,
} from "@/lib/env";
import { log } from "@/lib/log";

export const SKYNET_PROVIDER_ID = "skynet-gateway";

/** Live WLAN configuration is stable; re-reading it every five minutes is ample. */
const WLAN_CACHE_MS = 5 * 60 * 1000;

interface ResolvedWlan {
  network: SecureNetwork;
  passphrase: string | null;
  from: "gateway" | "configuration";
}

let cache: { value: ResolvedWlan; expiresAt: number } | null = null;

/**
 * Map the controller's privacy element onto a security mode.
 *
 * The controller expresses privacy as exactly one of `WpaPskElement`,
 * `WpaSaeElement`, … — the element that is present *is* the mode, and its
 * `mode` field distinguishes AES-only from mixed.
 */
export function securityFromPrivacy(privacy: GatewayWlan["privacy"]): {
  security: SecureNetworkSecurity;
  passphrase: string | null;
} {
  if (!privacy || typeof privacy !== "object") {
    return { security: "open", passphrase: null };
  }
  const psk = privacy.WpaPskElement;
  if (psk) {
    // A hex-encoded 64-character key is still WPA2 Personal, and both the Apple
    // payload and the Wi-Fi QR grammar carry it verbatim, so the encoding does
    // not change anything downstream.
    const key = typeof psk.presharedKey === "string" ? psk.presharedKey : null;
    return { security: "wpa2-psk", passphrase: key };
  }
  const sae = privacy.WpaSaeElement;
  if (sae) {
    const key = typeof sae.presharedKey === "string" ? sae.presharedKey : null;
    // `mode: "mixed"` on an SAE element is WPA2/WPA3 transition mode.
    const mixed = typeof sae.mode === "string" && /mixed|transition/i.test(sae.mode);
    return { security: mixed ? "wpa2-wpa3-psk" : "wpa3-sae", passphrase: key };
  }
  return { security: "open", passphrase: null };
}

async function resolve(): Promise<ResolvedWlan> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  const serviceId = secureWlanServiceId();
  const configuredSsid = secureWlanSsid();
  const fallbackPassphrase = secureWlanStaticPassphrase();

  if (serviceId && gatewayConfigured()) {
    try {
      const wlan = await readWlan(serviceId);
      const { security, passphrase } = securityFromPrivacy(wlan.privacy);
      const value: ResolvedWlan = {
        network: {
          ssid: wlan.ssid,
          security,
          hidden: wlan.suppressSsid,
          securityLabel: securityLabel(security),
          serviceId: wlan.id,
        },
        passphrase: passphrase ?? fallbackPassphrase,
        from: "gateway",
      };
      cache = { value, expiresAt: now + WLAN_CACHE_MS };
      return value;
    } catch (err) {
      // Never fatal on its own — fall through to the configured values, which
      // is the whole reason they exist.
      log.warn("secure_wlan_gateway_read_failed", {
        serviceId,
        name: (err as Error)?.name,
      });
    }
  }

  if (!configuredSsid) {
    throw new CredentialUnavailableError(
      "the secure WLAN is not configured and the gateway could not be read",
      SKYNET_PROVIDER_ID
    );
  }

  const security: SecureNetworkSecurity = fallbackPassphrase ? "wpa2-psk" : "open";
  const value: ResolvedWlan = {
    network: {
      ssid: configuredSsid,
      security,
      hidden: false,
      securityLabel: securityLabel(security),
      serviceId,
    },
    passphrase: fallbackPassphrase,
    from: "configuration",
  };
  // Short cache on the degraded answer, so the gateway is retried soon.
  cache = { value, expiresAt: now + 30_000 };
  return value;
}

export const skynetProvider: CredentialProvider = {
  id: SKYNET_PROVIDER_ID,

  async describe(): Promise<SecureNetwork> {
    return (await resolve()).network;
  },

  async issue(context: CredentialIssueContext): Promise<SecureNetworkCredential> {
    const resolved = await resolve();
    if (resolved.network.security !== "open" && !resolved.passphrase) {
      throw new CredentialUnavailableError(
        "the secure WLAN's passphrase could not be retrieved",
        SKYNET_PROVIDER_ID
      );
    }
    // Audit the act, never the material. `context` carries the onboarding id so
    // an issuance can be tied to a session without the session record ever
    // holding a credential.
    log.info("secure_credential_issued", {
      onboardingSessionId: context.onboardingSessionId,
      provider: SKYNET_PROVIDER_ID,
      source: resolved.from,
      ssid: resolved.network.ssid,
      security: resolved.network.security,
      platform: context.platform,
    });
    return {
      network: resolved.network,
      passphrase: resolved.passphrase,
      // One shared key for the whole WLAN. This is the field a PPSK provider
      // flips, and the reason nothing downstream calls it "your" password.
      perDevice: false,
      expiresAt: null,
    };
  },
};

/** True when the secure workflow can be offered at all. */
export function secureOnboardingConfigured(): boolean {
  return Boolean(secureWlanServiceId() || secureWlanSsid());
}

/** Which provisioning mechanisms the current network configuration supports. */
export async function networkCapabilities(): Promise<{
  network: SecureNetwork;
  qr: boolean;
  appleProfile: boolean;
}> {
  const network = await skynetProvider.describe();
  return {
    network,
    qr: qrSupports(network.security),
    appleProfile: appleProfileSupports(network.security),
  };
}

/** Test seam — drops the memoised WLAN configuration. */
export function resetSecureWlanCache(): void {
  cache = null;
}
