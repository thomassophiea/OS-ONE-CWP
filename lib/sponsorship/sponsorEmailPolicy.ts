/**
 * Who may be named as a sponsor.
 *
 * This is an authorization rule, not an address-format nicety, so it is
 * deliberately stricter than the guest-field email validation: the sponsor's
 * address is the thing that decides *who gets asked to grant network access*,
 * and every relaxation here widens that set.
 *
 * Rules, all enforced server-side:
 *
 * - ASCII only. `extremenetworks.com` spelled with a Cyrillic `е` is a
 *   different domain that renders identically; internationalised addresses are
 *   refused wholesale rather than normalised, because Phase 1's allowed
 *   domains are plain ASCII and a lookalike must never pass.
 * - Exact domain match, case-insensitive, after the *last* `@`. A suffix or
 *   prefix match would admit `extremenetworks.com.example.org`.
 * - No control characters, whitespace, or `%`-tricks anywhere — the address
 *   is later placed into an email envelope, and CR/LF is how header
 *   injection happens.
 */

/**
 * Local part: the pragmatic ASCII subset real corporate addresses use.
 * Quoted local parts (`"a b"@…`) are RFC-legal and refused anyway — no
 * employee directory issues them, and they exist here only as attack surface.
 */
const LOCAL_PART_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]{1,64}$/;

/** DNS label: letters, digits, hyphens; no leading/trailing hyphen. */
const DNS_LABEL_RE = /^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

export type SponsorEmailVerdict =
  | { ok: true; email: string; domain: string }
  | { ok: false; reason: "format" | "domain" | "notAllowed" };

/** True when every code point is printable ASCII. */
function isPrintableAscii(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x21 || c > 0x7e) return false;
  }
  return true;
}

/**
 * Structural validity of a domain someone proposes to *configure* as an
 * allowed sponsor domain — exported for the internal config API, so what the
 * operator can save is exactly what a submitted address can match.
 */
export function isAcceptableSponsorDomain(domain: string): boolean {
  if (!isPrintableAscii(domain)) return false;
  if (domain.length < 3 || domain.length > 253) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  return labels.every((label) => DNS_LABEL_RE.test(label));
}

/**
 * Validate a submitted sponsor address against the allowed domains.
 *
 * Returns the normalised (trimmed, domain-lowercased) address on success —
 * that normalised form is what gets stored and what the email is sent to, so
 * no later component re-derives it differently.
 */
export function validateSponsorEmail(
  raw: string | null | undefined,
  allowedDomains: readonly string[],
  /**
   * Optional exact-address allowlist (lowercase). Empty means any mailbox at
   * an allowed domain; non-empty narrows sponsorship to exactly these people.
   */
  allowedAddresses: readonly string[] = []
): SponsorEmailVerdict {
  const value = (raw ?? "").trim();

  if (!value || value.length > 254) return { ok: false, reason: "format" };
  // Whitespace and control characters never survive `isPrintableAscii`, which
  // also rejects the Unicode range where the homoglyphs live.
  if (!isPrintableAscii(value)) return { ok: false, reason: "format" };

  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return { ok: false, reason: "format" };

  const localPart = value.slice(0, at);
  const domain = value.slice(at + 1).toLowerCase();

  // A second `@` in the local part is legal only when quoted; refuse it.
  if (localPart.includes("@")) return { ok: false, reason: "format" };
  if (!LOCAL_PART_RE.test(localPart)) return { ok: false, reason: "format" };
  if (localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes(".."))
    return { ok: false, reason: "format" };
  if (!isAcceptableSponsorDomain(domain)) return { ok: false, reason: "format" };

  // Exact match only. `endsWith` would admit `evil-extremenetworks.com`;
  // matching before the last `@` is what stops `a@extremenetworks.com@evil.org`.
  if (!allowedDomains.includes(domain)) return { ok: false, reason: "domain" };

  const email = `${localPart}@${domain}`;
  // Address allowlists compare case-insensitively: RFC 5321 makes local-part
  // case significant in theory, but no corporate directory does, and a policy
  // a sponsor can dodge by re-casing their own name is not a policy.
  if (allowedAddresses.length > 0 && !allowedAddresses.includes(email.toLowerCase())) {
    return { ok: false, reason: "notAllowed" };
  }

  return { ok: true, email, domain };
}
