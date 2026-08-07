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
