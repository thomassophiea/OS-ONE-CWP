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

// ---------------------------------------------------------------------------
// Employee sponsorship
//
// Everything below is optional. With no sponsor domains configured (or no way
// to deliver email) the portal simply does not offer the sponsorship workflow,
// and the open guest path is untouched — the same failure mode as secure
// onboarding, and for the same reason.
// ---------------------------------------------------------------------------

/**
 * Email domains an employee sponsor may belong to, lowercase, exact-match.
 *
 * A list rather than a single value so a future tenant can allow several
 * domains without a code change — but matching is always exact and ASCII-only.
 * Phase 1 configures exactly `extremenetworks.com`.
 */
export function sponsorAllowedDomains(
  env: Record<string, string | undefined> = process.env
): string[] {
  return (env.SPONSOR_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * How long a sponsor has to decide.
 *
 * Defaults to the portal session TTL (15 minutes): an approval that arrives
 * after the guest's session — and the gateway token inside it — has expired
 * cannot authorize anything, so a longer window would only manufacture the
 * "approved but never online" case. Enforced server-side on every read.
 */
export function sponsorshipTtlSeconds(): number {
  const raw = Number(process.env.SPONSORSHIP_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw : sessionTtlSeconds();
}

/** Cap on sponsorship requests one portal session may create. */
export function sponsorshipMaxPerSession(): number {
  const raw = Number(process.env.SPONSORSHIP_MAX_PER_SESSION);
  return Number.isFinite(raw) && raw > 0 ? raw : 3;
}

/** Cap on status polls per request, so an abandoned tab cannot poll forever. */
export function sponsorshipMaxStatusChecks(): number {
  const raw = Number(process.env.SPONSORSHIP_MAX_STATUS_CHECKS);
  return Number.isFinite(raw) && raw > 0 ? raw : 300;
}

export type EmailTransportKind = "resend" | "smtp" | "console";

/**
 * Which email transport is usable, or null when none is.
 *
 * Preference order when nothing is forced: Resend's HTTP API, then SMTP, then
 * (outside production) the console. Resend outranks SMTP because the primary
 * deployment target blocks outbound SMTP at the network layer — measured on
 * 2026-08-31: ports 587, 465 and 2525 to multiple providers all time out from
 * the Railway container, so HTTPS is the only lane an email can actually
 * leave through there. SMTP remains for deployments that do have an open path.
 *
 * The console transport — the rendered message written to the structured log —
 * is the development default, and in production it must be asked for by name
 * (`EMAIL_TRANSPORT=console`): the emailed URL carries the approval token, and
 * printing it into a shared log stream is a deliberate demo-environment
 * decision, never a fallback.
 */
export function emailTransportKind(): EmailTransportKind | null {
  const forced = process.env.EMAIL_TRANSPORT?.trim().toLowerCase();
  const resendConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const smtpConfigured = Boolean(
    process.env.SMTP_URL?.trim() || process.env.SMTP_HOST?.trim()
  );
  if (forced === "console") return "console";
  if (forced === "resend") return resendConfigured ? "resend" : null;
  if (forced === "smtp") return smtpConfigured ? "smtp" : null;
  if (resendConfigured) return "resend";
  if (smtpConfigured) return "smtp";
  return isProduction() ? null : "console";
}

export function resendApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}

/**
 * From address for the Resend transport. Until a sending domain is verified
 * with Resend, their free tier only accepts `onboarding@resend.dev` as the
 * sender (and only the account owner as recipient), so that is the default.
 */
export function resendFrom(): string {
  return process.env.RESEND_FROM?.trim() || "onboarding@resend.dev";
}

/** From address for portal mail. Required for SMTP; cosmetic for console. */
export function emailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || "guest-portal@localhost";
}

export function smtpUrl(): string | null {
  return process.env.SMTP_URL?.trim() || null;
}

export function smtpHost(): string | null {
  return process.env.SMTP_HOST?.trim() || null;
}

export function smtpPort(): number {
  const raw = Number(process.env.SMTP_PORT);
  return Number.isFinite(raw) && raw > 0 ? raw : 587;
}

export function smtpUser(): string | null {
  return process.env.SMTP_USER?.trim() || null;
}

export function smtpPassword(): string | null {
  return process.env.SMTP_PASSWORD || null;
}

export function smtpSecure(): boolean {
  return (process.env.SMTP_SECURE ?? "false").toLowerCase() === "true";
}

/**
 * Whether the sponsorship workflow is offered at all.
 *
 * Both halves must hold: somewhere to validate sponsors against, and a way to
 * reach them. A sponsorship option that accepts a request it can never deliver
 * would strand a guest on a waiting page for a decision nobody was asked for.
 */
export function sponsorshipConfigured(): boolean {
  return sponsorAllowedDomains().length > 0 && emailTransportKind() !== null;
}

/**
 * Shared secret for deriving CAPPORT per-client tokens from a station MAC.
 *
 * Both this portal and whatever provisions DHCP option 114 derive the same
 * token independently, so no registration step or lookup service is needed
 * between them. Absent means the per-client URI is simply not available and the
 * network-wide API route is the only one served.
 */
export function capportTokenSecret(): string | null {
  return process.env.CAPPORT_TOKEN_SECRET?.trim() || null;
}
