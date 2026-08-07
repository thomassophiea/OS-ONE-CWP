import { trustProxy } from "@/lib/env";

/**
 * Headers that may carry credentials or session material. They are read for
 * IP/UA extraction but never persisted, so the audit table cannot become a
 * secondary credential store.
 */
const SENSITIVE_HEADER_RE =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|cf-access-jwt-assertion|x-amz-security-token)$/i;

export interface RequestMetadata {
  /** Address of the guest's browser as best we can determine it. */
  sourceIp: string | null;
  userAgent: string | null;
  headers: Record<string, string>;
}

type HeaderBag = {
  get: (name: string) => string | null;
  forEach: (fn: (value: string, key: string) => void) => void;
};

export function getRequestMetadata(headers: HeaderBag): RequestMetadata {
  const recorded: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (!SENSITIVE_HEADER_RE.test(key)) recorded[key] = value;
  });

  let sourceIp: string | null = null;
  if (trustProxy()) {
    // Railway terminates TLS and appends the real client address; take the
    // left-most entry, which is the value that proxy set.
    const forwarded = headers.get("x-forwarded-for");
    sourceIp =
      forwarded?.split(",")[0]?.trim() ||
      headers.get("x-real-ip") ||
      headers.get("cf-connecting-ip") ||
      null;
  }

  return {
    sourceIp,
    userAgent: headers.get("user-agent"),
    headers: recorded,
  };
}

/** Rejects requests whose Host header is not one we serve. */
export function hostIsAllowed(
  hostHeader: string | null,
  allowed: string[]
): boolean {
  if (allowed.length === 0) return true;
  if (!hostHeader) return false;
  return allowed.includes(hostHeader.trim().toLowerCase());
}
