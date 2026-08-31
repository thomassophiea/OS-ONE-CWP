import { describe, expect, it } from "vitest";
import {
  hashSponsorshipToken,
  isWellFormedToken,
  newSponsorshipToken,
  tokenHashMatches,
} from "@/lib/sponsorship/token";

describe("sponsorship tokens", () => {
  it("issues 43-char base64url tokens with a matching sha-256", () => {
    const { token, hash } = newSponsorshipToken();
    expect(isWellFormedToken(token)).toBe(true);
    expect(hash).toBe(hashSponsorshipToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never issues the same token twice", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(newSponsorshipToken().token);
    expect(seen.size).toBe(1000);
  });

  it("rejects malformed tokens before any lookup", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "short",
      "x".repeat(42),
      "x".repeat(44),
      `${"x".repeat(42)}!`,
      "../../../etc/passwd/aaaaaaaaaaaaaaaaaaaaaaaaa",
    ]) {
      expect(isWellFormedToken(bad)).toBe(false);
    }
  });

  it("compares hashes timing-safely and correctly", () => {
    const { token, hash } = newSponsorshipToken();
    expect(tokenHashMatches(hashSponsorshipToken(token), hash)).toBe(true);
    expect(tokenHashMatches(hashSponsorshipToken(newSponsorshipToken().token), hash)).toBe(false);
    expect(tokenHashMatches("deadbeef", hash)).toBe(false);
  });
});
