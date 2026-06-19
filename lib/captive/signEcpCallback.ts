import { createHmac, createHash } from "crypto";

function awsEncode(str: string): string {
  // AWS SigV4 requires encoding everything except: A-Za-z0-9 - _ . ~
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export interface EcpCallbackParams {
  hwcIp: string;
  hwcPort: string | null;
  token: string;
  wlan: string;
  clientMac: string;
  dest: string | null;
  identity: string;
  sharedSecret: string;
  expiresSeconds?: number;
}

export function buildSignedEcpCallbackUrl(p: EcpCallbackParams): string {
  const expiresSeconds = p.expiresSeconds ?? 60;
  const now = new Date();

  // YYYYMMDDThhmmssZ
  const amzDate = now.toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const dateShort = amzDate.slice(0, 8); // YYYYMMDD

  const portSuffix = p.hwcPort && p.hwcPort !== "443" ? `:${p.hwcPort}` : "";
  const host = `${p.hwcIp}${portSuffix}`;
  const credential = `${p.identity}/${dateShort}/world/ecp/aws4_request`;

  // All params except X-Amz-Signature, sorted by encoded key name
  const params: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", credential],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresSeconds)],
    ["X-Amz-SignedHeaders", "host"],
    ["token", p.token],
    ["username", p.clientMac],
    ["wlan", p.wlan],
  ];
  if (p.dest) params.push(["dest", p.dest]);

  params.sort(([a], [b]) => awsEncode(a).localeCompare(awsEncode(b)));

  const canonicalQS = params
    .map(([k, v]) => `${awsEncode(k)}=${awsEncode(v)}`)
    .join("&");

  const canonicalRequest = [
    "GET",
    "/ext_approval.php",
    canonicalQS,
    `host:${host}\n`,
    "host",
    sha256Hex(""), // empty body
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    `${dateShort}/world/ecp/aws4_request`,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(Buffer.from(`AWS4${p.sharedSecret}`, "utf8"), dateShort);
  const kRegion = hmacSha256(kDate, "world");
  const kService = hmacSha256(kRegion, "ecp");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");

  return `https://${host}/ext_approval.php?${canonicalQS}&X-Amz-Signature=${signature}`;
}
