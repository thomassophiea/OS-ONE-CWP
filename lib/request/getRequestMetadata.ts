// Headers that may contain credentials or session tokens — excluded from rawHeaders
// to avoid storing them in the audit DB. We still read them above for IP/UA extraction.
const SENSITIVE_HEADER_RE =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|cf-access-jwt-assertion|x-amz-security-token)$/i;

export interface RequestMetadata {
  sourceIp: string | null;
  userAgent: string | null;
  rawHeaders: Record<string, string>;
}

export function getRequestMetadata(
  headers: {
    get: (name: string) => string | null;
    forEach: (fn: (value: string, key: string) => void) => void;
  }
): RequestMetadata {
  const rawHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (!SENSITIVE_HEADER_RE.test(key)) {
      rawHeaders[key] = value;
    }
  });

  const sourceIp =
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null;

  const userAgent = headers.get("user-agent") ?? null;

  return { sourceIp, userAgent, rawHeaders };
}
