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
    rawHeaders[key] = value;
  });

  const sourceIp =
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null;

  const userAgent = headers.get("user-agent") ?? null;

  return { sourceIp, userAgent, rawHeaders };
}
