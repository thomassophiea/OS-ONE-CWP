/**
 * Redirect policy for the captive-portal flow.
 *
 * There are two distinct redirect decisions and they need different rules —
 * conflating them is what the original single ALLOWED_REDIRECT_DOMAINS variable
 * did wrong:
 *
 *  1. The **gateway callback host** (`hwc_ip`). This is attacker-influenced only
 *     insofar as someone can forge a redirect, and it receives a URL signed with
 *     our shared secret. It MUST be constrained to an explicit allowlist so a
 *     forged `hwc_ip` cannot make us mint a valid signature aimed at a host we
 *     do not control. See `isAllowedGatewayHost`.
 *
 *  2. The **guest's original destination** (`dest`). This is wherever the guest
 *     was browsing when they were intercepted; it is arbitrary by design, so an
 *     allowlist is meaningless. It is sanitised instead: dangerous schemes,
 *     control characters and protocol-relative forms are rejected and replaced
 *     with a safe internal fallback. See `sanitizeOriginalDestination`.
 */

const UNSAFE_SCHEME_RE =
  /^[a-z][a-z0-9+.-]*:/i;
const SAFE_SCHEMES = new Set(["http:", "https:"]);
const MAX_DEST_LENGTH = 2048;

function splitList(value: string | undefined | null): string[] {
  return (value ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Allowlist check for the ECP callback host. Entries match the host exactly or
 * as a parent domain (`ezcloudx.com` matches `apcp.ezcloudx.com`). Bare IPv4
 * literals must be listed exactly — no suffix matching, since `1.2.3.4` is not
 * a parent of `x.1.2.3.4`.
 */
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

export function isAllowedGatewayHost(
  host: string | null | undefined,
  allowlist: string[]
): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  if (!h || allowlist.length === 0) return false;
  return allowlist.some((allowed) => {
    if (h === allowed) return true;
    // `10.0.0.1` is not a parent of `evil.10.0.0.1`, so IP literals match
    // exactly and nothing else.
    if (IPV4_RE.test(allowed)) return false;
    return h.endsWith(`.${allowed}`);
  });
}

/** Reads the allowlist from env, preferring the current variable name. */
export function gatewayHostAllowlist(
  env: Record<string, string | undefined> = process.env
): string[] {
  const current = splitList(env.XCC_ALLOWED_GATEWAY_HOSTS);
  if (current.length > 0) return current;
  // Legacy name, kept so an existing deployment does not break on rollout.
  return splitList(env.ALLOWED_REDIRECT_DOMAINS);
}

export type DestinationVerdict =
  | { safe: true; value: string }
  | { safe: false; reason: DestinationRejection; fallback: string };

export type DestinationRejection =
  | "EMPTY"
  | "TOO_LONG"
  | "CONTROL_CHARACTERS"
  | "UNSAFE_SCHEME"
  | "PROTOCOL_RELATIVE"
  | "UNPARSEABLE";

/**
 * Normalise the gateway-supplied original destination into something safe to
 * hand back to the gateway (which will emit it into `window.location.href`).
 *
 * The gateway sends it without a scheme (`example.com/`), so a bare host is
 * accepted and promoted to `http://`.
 */
export function sanitizeOriginalDestination(
  input: string | null | undefined,
  fallback: string
): DestinationVerdict {
  if (!input || input.trim() === "") {
    return { safe: false, reason: "EMPTY", fallback };
  }
  if (input.length > MAX_DEST_LENGTH) {
    return { safe: false, reason: "TOO_LONG", fallback };
  }
  // Control characters (incl. tab/newline/CR) enable parser-differential
  // attacks: browsers strip them, our checks would not.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x20\x7f]/.test(input)) {
    return { safe: false, reason: "CONTROL_CHARACTERS", fallback };
  }
  // `//evil.com` is absolute to a browser.
  if (input.startsWith("//") || input.startsWith("\\\\")) {
    return { safe: false, reason: "PROTOCOL_RELATIVE", fallback };
  }

  const hasScheme = UNSAFE_SCHEME_RE.test(input);
  const candidate = hasScheme ? input : `http://${input}`;

  if (hasScheme) {
    const scheme = input.slice(0, input.indexOf(":") + 1).toLowerCase();
    if (!SAFE_SCHEMES.has(scheme)) {
      return { safe: false, reason: "UNSAFE_SCHEME", fallback };
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { safe: false, reason: "UNPARSEABLE", fallback };
  }
  if (!SAFE_SCHEMES.has(parsed.protocol)) {
    return { safe: false, reason: "UNSAFE_SCHEME", fallback };
  }
  if (!parsed.hostname) {
    return { safe: false, reason: "UNPARSEABLE", fallback };
  }

  // Hand the gateway back exactly what it gave us when it was already safe —
  // it round-trips the value into the station's browser itself.
  return { safe: true, value: input };
}

/**
 * Turn an already-sanitised destination into an absolute URL a browser can
 * navigate to. Returns null if the value cannot be made safe, so callers fall
 * back to staying on the confirmation page.
 */
export function toAbsoluteDestination(
  value: string | null | undefined
): string | null {
  const verdict = sanitizeOriginalDestination(value, "");
  if (!verdict.safe) return null;
  const raw = verdict.value;
  const candidate = UNSAFE_SCHEME_RE.test(raw) ? raw : `http://${raw}`;
  try {
    const url = new URL(candidate);
    return SAFE_SCHEMES.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Guard for redirects this application issues to its *own* pages. Only
 * same-origin absolute URLs and simple absolute paths are permitted.
 */
export function safeInternalRedirect(
  input: string | null | undefined,
  appBaseUrl: string,
  fallbackPath = "/portal/error"
): string {
  const fallback = new URL(fallbackPath, appBaseUrl).toString();
  if (!input) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x20\x7f]/.test(input)) return fallback;
  try {
    const url = new URL(input, appBaseUrl);
    const base = new URL(appBaseUrl);
    if (url.origin !== base.origin) return fallback;
    if (!SAFE_SCHEMES.has(url.protocol)) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}
