/**
 * Central, typed access to runtime configuration.
 *
 * Nothing here is read at module-evaluation time, because `next build`
 * evaluates every module without the production environment present.
 */

export const isProduction = () => process.env.NODE_ENV === "production";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new ConfigurationError(name);
  }
  return value.trim();
}

export class ConfigurationError extends Error {
  constructor(public readonly variable: string) {
    super(`Missing required configuration: ${variable}`);
    this.name = "ConfigurationError";
  }
}

/** Public origin of this deployment, without a trailing slash. */
export function appBaseUrl(fallbackOrigin?: string): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (fallbackOrigin) return fallbackOrigin.replace(/\/+$/, "");
  throw new ConfigurationError("APP_BASE_URL");
}

/**
 * Host the gateway signs the ECP redirect against. Always derived from
 * APP_BASE_URL — never from the Host header, which a client controls.
 */
export function appHost(): string {
  return new URL(appBaseUrl()).host;
}

/** Path component of the configured ECP URL (what the gateway signed). */
export function ecpPath(): string {
  return process.env.ECP_PATH?.trim() || "/portal";
}

export function xccIdentity(): string {
  return required("XCC_IDENTITY");
}

export function xccSharedSecret(): string {
  return required("XCC_SHARED_SECRET");
}

export function sessionSecret(): string {
  return required("SESSION_SECRET");
}

/** Seconds a portal session may stay open before it must be restarted. */
export function sessionTtlSeconds(): number {
  const raw = Number(process.env.PORTAL_SESSION_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw : 900;
}

/** Lifetime we request on the presigned approval URL handed to the browser. */
export function approvalUrlTtlSeconds(): number {
  const raw = Number(process.env.ECP_APPROVAL_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw : 60;
}

/** Clock skew tolerated when verifying the gateway's redirect signature. */
export function signatureSkewSeconds(): number {
  const raw = Number(process.env.ECP_SIGNATURE_SKEW_SECONDS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 300;
}

/**
 * Hosts permitted in the `Host` header. Requests for anything else are
 * refused so a host-header injection cannot influence generated links.
 */
export function allowedHosts(): string[] {
  const configured = (process.env.ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (configured.length > 0) return configured;
  try {
    return [appHost().toLowerCase()];
  } catch {
    return [];
  }
}

/** Set when Railway (or any single trusted proxy) terminates TLS in front of us. */
export function trustProxy(): boolean {
  return (process.env.TRUST_PROXY ?? "true").toLowerCase() !== "false";
}

// ---------------------------------------------------------------------------
// Secure guest onboarding
//
// Everything below is optional. When the secure-network configuration is
// absent the portal simply does not offer the secure workflow, and the open
// guest path is untouched — that is the failure mode this feature must have.
// ---------------------------------------------------------------------------

/** SSID of the secure WLAN guests can optionally move to. */
export function secureWlanSsid(): string | null {
  return process.env.SECURE_WLAN_SSID?.trim() || null;
}

/**
 * Gateway service id of the secure WLAN.
 *
 * Two jobs: it is where the credential provider reads the live WLAN
 * configuration from, and it is what a station's `serviceId` is compared
 * against to decide that the device really did join.
 */
export function secureWlanServiceId(): string | null {
  return process.env.SECURE_WLAN_SERVICE_ID?.trim() || null;
}

/**
 * Static passphrase fallback for the secure WLAN.
 *
 * The gateway is the source of truth and is read first; this exists so that a
 * gateway outage degrades the secure workflow to "still works" rather than
 * "unavailable". Never rendered into a page or a log.
 */
export function secureWlanStaticPassphrase(): string | null {
  return process.env.SECURE_WLAN_PSK?.trim() || null;
}

/** Base URL of the management API proxy used to read gateway state. */
export function gatewayApiBaseUrl(): string | null {
  const raw = process.env.GATEWAY_API_BASE_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

/** Controller the proxy should be pointed at (`X-Controller-URL`). */
export function gatewayControllerUrl(): string | null {
  return process.env.GATEWAY_CONTROLLER_URL?.trim() || null;
}

export function gatewayUsername(): string | null {
  return process.env.GATEWAY_USERNAME?.trim() || null;
}

export function gatewayPassword(): string | null {
  return process.env.GATEWAY_PASSWORD?.trim() || null;
}

/** How long a secure-onboarding session stays usable. */
export function onboardingTtlSeconds(): number {
  const raw = Number(process.env.ONBOARDING_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw : 1800;
}

/**
 * Cap on gateway join-verification polls per onboarding session. Bounded so a
 * page left open on a locked phone cannot turn into a permanent poller.
 */
export function onboardingMaxChecks(): number {
  const raw = Number(process.env.ONBOARDING_MAX_CHECKS);
  return Number.isFinite(raw) && raw > 0 ? raw : 60;
}
