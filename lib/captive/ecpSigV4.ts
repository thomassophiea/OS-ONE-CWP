import { createHmac, createHash, timingSafeEqual } from "crypto";

/**
 * AWS SigV4 presigned-URL signing/verification as implemented by the Extreme
 * ExtremeCloud IQ Controller (XCC) External Captive Portal (ECP).
 *
 * Verified against a live AP5020 running under XCC at 192.168.100.12 on
 * 2026-08-07. The controller signs the redirect it sends to the portal, and
 * verifies the signature on the /ext_approval.php callback, using:
 *
 *   region  = "world"
 *   service = "ecp"
 *   payload = "UNSIGNED-PAYLOAD"
 *   signed headers = "host"
 *   access key id = the ECP Identity configured on the pre-auth role
 *   secret        = the ECP Shared Secret configured on the pre-auth role
 *
 * IMPORTANT: the controller signs the query string *exactly as it emits it*.
 * It does not re-encode `!`, so a canonical query string rebuilt from decoded
 * parameters will not match. Verification therefore operates on the raw query
 * string with the `X-Amz-Signature` parameter removed and every other byte
 * left untouched.
 */

export const ECP_REGION = "world";
export const ECP_SERVICE = "ecp";
const ALGORITHM = "AWS4-HMAC-SHA256";
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function signingKey(secret: string, dateStamp: string): Buffer {
  const kDate = hmac(Buffer.from(`AWS4${secret}`, "utf8"), dateStamp);
  const kRegion = hmac(kDate, ECP_REGION);
  const kService = hmac(kRegion, ECP_SERVICE);
  return hmac(kService, "aws4_request");
}

function stringToSign(
  amzDate: string,
  dateStamp: string,
  canonicalRequest: string
): string {
  return [
    ALGORITHM,
    amzDate,
    `${dateStamp}/${ECP_REGION}/${ECP_SERVICE}/aws4_request`,
    sha256Hex(canonicalRequest),
  ].join("\n");
}

function canonicalRequest(
  method: string,
  path: string,
  canonicalQueryString: string,
  host: string
): string {
  return [
    method,
    path,
    canonicalQueryString,
    `host:${host}\n`,
    "host",
    UNSIGNED_PAYLOAD,
  ].join("\n");
}

/** AWS-flavoured percent encoding: everything except A-Za-z0-9-_.~ */
export function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/** `20260807T004135Z` -> Date, or null when malformed. */
export function parseAmzDate(amzDate: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(amzDate);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  return Number.isNaN(ms) ? null : new Date(ms);
}

export type VerifyFailureReason =
  | "MISSING_SIGNATURE"
  | "MISSING_REQUIRED_PARAM"
  | "UNSUPPORTED_ALGORITHM"
  | "BAD_CREDENTIAL_SCOPE"
  | "IDENTITY_MISMATCH"
  | "MALFORMED_DATE"
  | "EXPIRED"
  | "NOT_YET_VALID"
  | "SIGNATURE_MISMATCH";

export interface VerifyResult {
  valid: boolean;
  reason?: VerifyFailureReason;
  /** Hex signature carried by the request (safe to log — it is not a secret). */
  signature?: string;
  signedAt?: Date;
  expiresAt?: Date;
}

export interface VerifyOptions {
  /** Raw request URL, exactly as received (query string must not be re-encoded). */
  rawUrl: string;
  /** Host the controller signed — take from APP_BASE_URL, never the Host header. */
  expectedHost: string;
  /** Path the controller signed — the ECP URL path, e.g. "/portal". */
  expectedPath: string;
  identity: string;
  sharedSecret: string;
  /** Clock skew tolerated in either direction. */
  maxSkewSeconds?: number;
  /** Upper bound applied to X-Amz-Expires regardless of what the request claims. */
  maxLifetimeSeconds?: number;
  now?: Date;
}

/**
 * Verify a presigned ECP redirect. Returns a structured result rather than
 * throwing so callers can record the precise failure reason for audit.
 */
export function verifyEcpRedirect(opts: VerifyOptions): VerifyResult {
  const {
    rawUrl,
    expectedHost,
    expectedPath,
    identity,
    sharedSecret,
    maxSkewSeconds = 300,
    maxLifetimeSeconds = 900,
    now = new Date(),
  } = opts;

  const queryStart = rawUrl.indexOf("?");
  const rawQuery = queryStart === -1 ? "" : rawUrl.slice(queryStart + 1);
  if (!rawQuery) return { valid: false, reason: "MISSING_SIGNATURE" };

  // Preserve byte-for-byte ordering and encoding; drop only X-Amz-Signature.
  const pairs = rawQuery.split("&");
  const kept: string[] = [];
  let signature: string | undefined;
  for (const pair of pairs) {
    if (pair.startsWith("X-Amz-Signature=")) {
      signature = pair.slice("X-Amz-Signature=".length);
    } else {
      kept.push(pair);
    }
  }
  if (!signature) return { valid: false, reason: "MISSING_SIGNATURE" };

  const params = new URLSearchParams(rawQuery);
  const algorithm = params.get("X-Amz-Algorithm");
  const credential = params.get("X-Amz-Credential");
  const amzDate = params.get("X-Amz-Date");
  const expiresRaw = params.get("X-Amz-Expires");

  if (!algorithm || !credential || !amzDate || !expiresRaw) {
    return { valid: false, reason: "MISSING_REQUIRED_PARAM" };
  }
  if (algorithm !== ALGORITHM) {
    return { valid: false, reason: "UNSUPPORTED_ALGORITHM" };
  }

  const signedAt = parseAmzDate(amzDate);
  if (!signedAt) return { valid: false, reason: "MALFORMED_DATE" };
  const dateStamp = amzDate.slice(0, 8);

  // credential = <identity>/<YYYYMMDD>/world/ecp/aws4_request
  const credParts = credential.split("/");
  if (
    credParts.length !== 5 ||
    credParts[2] !== ECP_REGION ||
    credParts[3] !== ECP_SERVICE ||
    credParts[4] !== "aws4_request"
  ) {
    return { valid: false, reason: "BAD_CREDENTIAL_SCOPE" };
  }
  if (credParts[1] !== dateStamp) {
    return { valid: false, reason: "BAD_CREDENTIAL_SCOPE" };
  }
  if (credParts[0] !== identity) {
    return { valid: false, reason: "IDENTITY_MISMATCH" };
  }

  const claimedLifetime = Number(expiresRaw);
  if (!Number.isFinite(claimedLifetime) || claimedLifetime <= 0) {
    return { valid: false, reason: "MISSING_REQUIRED_PARAM" };
  }
  const lifetime = Math.min(claimedLifetime, maxLifetimeSeconds);
  const expiresAt = new Date(signedAt.getTime() + lifetime * 1000);

  if (now.getTime() > expiresAt.getTime() + maxSkewSeconds * 1000) {
    return { valid: false, reason: "EXPIRED", signature, signedAt, expiresAt };
  }
  if (now.getTime() < signedAt.getTime() - maxSkewSeconds * 1000) {
    return { valid: false, reason: "NOT_YET_VALID", signature, signedAt, expiresAt };
  }

  const creq = canonicalRequest("GET", expectedPath, kept.join("&"), expectedHost);
  const expected = hmac(
    signingKey(sharedSecret, dateStamp),
    stringToSign(amzDate, dateStamp, creq)
  ).toString("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.toLowerCase(), "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return {
      valid: false,
      reason: "SIGNATURE_MISMATCH",
      signature,
      signedAt,
      expiresAt,
    };
  }

  return { valid: true, signature, signedAt, expiresAt };
}

export interface ApprovalUrlParams {
  /** hwc_ip from the gateway redirect. */
  gatewayHost: string;
  /** hwc_port from the gateway redirect ("80" or "443"). */
  gatewayPort: string;
  /** Opaque station token issued by the gateway. */
  token: string;
  /** Station MAC, as the gateway spelled it (12 lowercase hex, no separators). */
  username: string;
  /** WLAN index from the gateway redirect. */
  wlan: string;
  /** Original destination, verbatim from the gateway redirect. */
  dest?: string | null;
  identity: string;
  sharedSecret: string;
  expiresSeconds?: number;
  now?: Date;
}

/**
 * Build the presigned `/ext_approval.php` URL the captive browser must fetch
 * to move the station into its authenticated role.
 *
 * The scheme follows the port the gateway advertised: port 80 means the
 * controller's "Use HTTPS connection" option is off and the AP serves the ECP
 * handler over plain HTTP on the local link.
 */
export function buildEcpApprovalUrl(p: ApprovalUrlParams): string {
  const now = p.now ?? new Date();
  const amzDate = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const dateStamp = amzDate.slice(0, 8);

  const scheme = p.gatewayPort === "80" ? "http" : "https";
  const defaultPort = scheme === "http" ? "80" : "443";
  const host =
    p.gatewayPort && p.gatewayPort !== defaultPort
      ? `${p.gatewayHost}:${p.gatewayPort}`
      : p.gatewayHost;

  const entries: [string, string][] = [
    ["X-Amz-Algorithm", ALGORITHM],
    [
      "X-Amz-Credential",
      `${p.identity}/${dateStamp}/${ECP_REGION}/${ECP_SERVICE}/aws4_request`,
    ],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(p.expiresSeconds ?? 60)],
    ["X-Amz-SignedHeaders", "host"],
    ["token", p.token],
    ["username", p.username],
    ["wlan", p.wlan],
  ];
  if (p.dest) entries.push(["dest", p.dest]);

  // Byte-order sort on the *encoded* key names, per SigV4.
  entries.sort(([a], [b]) => {
    const ea = awsEncode(a);
    const eb = awsEncode(b);
    return ea < eb ? -1 : ea > eb ? 1 : 0;
  });

  const canonicalQueryString = entries
    .map(([k, v]) => `${awsEncode(k)}=${awsEncode(v)}`)
    .join("&");

  const creq = canonicalRequest(
    "GET",
    "/ext_approval.php",
    canonicalQueryString,
    host
  );
  const signature = hmac(
    signingKey(p.sharedSecret, dateStamp),
    stringToSign(amzDate, dateStamp, creq)
  ).toString("hex");

  return `${scheme}://${host}/ext_approval.php?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}
