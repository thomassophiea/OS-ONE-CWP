import { timingSafeEqual } from "crypto";

/**
 * The admin views expose station MACs, IP addresses and gateway tokens, so they
 * are disabled unless ADMIN_TOKEN is configured, and the token is compared in
 * constant time.
 */
export function adminTokenIsValid(provided: string | null | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) return false;
  if (!provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function adminEnabled(): boolean {
  return Boolean(process.env.ADMIN_TOKEN?.trim());
}
