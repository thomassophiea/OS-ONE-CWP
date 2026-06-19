const UNSAFE_SCHEMES = [
  "javascript:",
  "data:",
  "file:",
  "vbscript:",
  "about:",
];

function isAllowedDomain(
  hostname: string,
  allowedDomains: string[]
): boolean {
  return allowedDomains.some(
    (allowed) =>
      hostname === allowed || hostname.endsWith(`.${allowed}`)
  );
}

export function getSafeRedirectUrl(
  inputUrl: string | null | undefined,
  fallbackUrl: string
): string {
  if (!inputUrl) return fallbackUrl;

  // Allow relative paths
  if (inputUrl.startsWith("/")) return inputUrl;

  const lower = inputUrl.toLowerCase();
  if (UNSAFE_SCHEMES.some((scheme) => lower.startsWith(scheme))) {
    return fallbackUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(inputUrl);
  } catch {
    return fallbackUrl;
  }

  const { protocol, hostname } = parsed;

  if (protocol !== "https:" && protocol !== "http:") return fallbackUrl;

  if (
    protocol === "http:" &&
    hostname !== "localhost" &&
    hostname !== "127.0.0.1"
  ) {
    return fallbackUrl;
  }

  const allowedDomainsEnv = process.env.ALLOWED_REDIRECT_DOMAINS;
  if (allowedDomainsEnv) {
    const allowedDomains = allowedDomainsEnv
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (
      allowedDomains.length > 0 &&
      !isAllowedDomain(hostname.toLowerCase(), allowedDomains)
    ) {
      return fallbackUrl;
    }
  }

  return inputUrl;
}
