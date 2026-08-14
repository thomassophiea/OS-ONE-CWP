import { describe, expect, it } from "vitest";
import { hashHandoffToken, handoffTokenMatches } from "@/lib/onboarding/handoff";

/**
 * The hand-off token's storage contract.
 *
 * Redemption itself is a single conditional UPDATE against a unique index, so
 * it is exercised end to end against the deployed portal rather than mocked
 * here. What is worth pinning down in a unit test is the part a future change
 * could quietly break: that only the hash is ever suitable for storage, and
 * that a near-miss token does not match.
 */
describe("hand-off token hashing", () => {
  it("is a hex SHA-256, so the raw token is never what gets stored", () => {
    const hash = hashHandoffToken("a-token-value");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("a-token-value");
  });

  it("is stable for the same token", () => {
    expect(hashHandoffToken("abc")).toBe(hashHandoffToken("abc"));
  });

  it("differs for tokens that differ by one character", () => {
    expect(hashHandoffToken("abc")).not.toBe(hashHandoffToken("abd"));
  });

  it("matches a token against its own hash", () => {
    const token = "Zm9vYmFyLXRva2Vu";
    expect(handoffTokenMatches(token, hashHandoffToken(token))).toBe(true);
  });

  it("refuses a different token", () => {
    expect(handoffTokenMatches("wrong", hashHandoffToken("right"))).toBe(false);
  });

  it("refuses a missing token or a missing hash", () => {
    expect(handoffTokenMatches(null, hashHandoffToken("x"))).toBe(false);
    expect(handoffTokenMatches("x", null)).toBe(false);
    expect(handoffTokenMatches("", "")).toBe(false);
  });
});
