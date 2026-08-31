import { describe, expect, it } from "vitest";
import { validateSponsorEmail } from "@/lib/sponsorship/sponsorEmailPolicy";

const DOMAINS = ["extremenetworks.com"];

describe("validateSponsorEmail", () => {
  it("accepts a plain address at the allowed domain", () => {
    const v = validateSponsorEmail("tsophiea@extremenetworks.com", DOMAINS);
    expect(v).toEqual({
      ok: true,
      email: "tsophiea@extremenetworks.com",
      domain: "extremenetworks.com",
    });
  });

  it("matches the domain case-insensitively and normalises it", () => {
    const v = validateSponsorEmail("Thomas.Sophiea@ExtremeNetworks.COM", DOMAINS);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.email).toBe("Thomas.Sophiea@extremenetworks.com");
  });

  it("trims surrounding whitespace", () => {
    expect(validateSponsorEmail("  a@extremenetworks.com  ", DOMAINS).ok).toBe(true);
  });

  it("rejects other domains", () => {
    expect(validateSponsorEmail("employee@gmail.com", DOMAINS)).toEqual({
      ok: false,
      reason: "domain",
    });
    expect(validateSponsorEmail("employee@example.com", DOMAINS).ok).toBe(false);
  });

  it("rejects suffix-spoofed domains", () => {
    expect(
      validateSponsorEmail("attacker@extremenetworks.com.example.org", DOMAINS)
    ).toEqual({ ok: false, reason: "domain" });
    expect(validateSponsorEmail("a@extremenetworks.com.evil.io", DOMAINS).ok).toBe(false);
  });

  it("rejects prefix-spoofed domains", () => {
    expect(validateSponsorEmail("a@evilextremenetworks.com", DOMAINS).ok).toBe(false);
    expect(validateSponsorEmail("a@extremenetworks.com.co", DOMAINS).ok).toBe(false);
  });

  it("rejects a second @ smuggling the real domain into the local part", () => {
    const v = validateSponsorEmail("a@extremenetworks.com@evil.org", DOMAINS);
    expect(v.ok).toBe(false);
  });

  it("rejects Unicode lookalikes wholesale", () => {
    // Cyrillic е in the domain — renders identically to the ASCII e.
    expect(validateSponsorEmail("a@extremеnetworks.com", DOMAINS).ok).toBe(false);
    // Unicode in the local part is refused too.
    expect(validateSponsorEmail("ü@extremenetworks.com", DOMAINS).ok).toBe(false);
  });

  it("rejects header-injection characters", () => {
    expect(validateSponsorEmail("a\r\nBcc:x@y.z@extremenetworks.com", DOMAINS).ok).toBe(false);
    expect(validateSponsorEmail("a@extremenetworks.com\nX: y", DOMAINS).ok).toBe(false);
    expect(validateSponsorEmail("a b@extremenetworks.com", DOMAINS).ok).toBe(false);
  });

  it("rejects malformed addresses", () => {
    for (const bad of [
      "",
      "   ",
      "@extremenetworks.com",
      "a@",
      "plainstring",
      "a@@extremenetworks.com",
      ".a@extremenetworks.com",
      "a.@extremenetworks.com",
      "a..b@extremenetworks.com",
      "a@extremenetworks",
      "a@-extremenetworks.com",
      `${"x".repeat(300)}@extremenetworks.com`,
    ]) {
      expect(validateSponsorEmail(bad, DOMAINS).ok, bad).toBe(false);
    }
    expect(validateSponsorEmail(null, DOMAINS).ok).toBe(false);
    expect(validateSponsorEmail(undefined, DOMAINS).ok).toBe(false);
  });

  it("rejects everything when no domains are configured", () => {
    expect(validateSponsorEmail("a@extremenetworks.com", []).ok).toBe(false);
  });

  it("supports multiple allowed domains without widening the match", () => {
    const domains = ["extremenetworks.com", "partner.example"];
    expect(validateSponsorEmail("a@partner.example", domains).ok).toBe(true);
    expect(validateSponsorEmail("a@sub.partner.example", domains).ok).toBe(false);
  });

  it("narrows to an exact-address allowlist when one is configured", () => {
    const allowed = ["tsophiea@extremenetworks.com"];
    expect(validateSponsorEmail("tsophiea@extremenetworks.com", DOMAINS, allowed).ok).toBe(true);
    // Case-insensitive on the whole address: a directory is not case-sensitive.
    expect(validateSponsorEmail("TSophiea@ExtremeNetworks.com", DOMAINS, allowed).ok).toBe(true);
    expect(validateSponsorEmail("other@extremenetworks.com", DOMAINS, allowed)).toEqual({
      ok: false,
      reason: "notAllowed",
    });
    // Domain check still comes first: a wrong domain is never "notAllowed".
    expect(validateSponsorEmail("tsophiea@gmail.com", DOMAINS, allowed)).toEqual({
      ok: false,
      reason: "domain",
    });
  });

  it("an empty allowlist means any mailbox at an allowed domain", () => {
    expect(validateSponsorEmail("anyone@extremenetworks.com", DOMAINS, []).ok).toBe(true);
  });
});
