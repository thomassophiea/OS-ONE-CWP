import { describe, expect, it } from "vitest";
import { accessPolicyDecision, isAccessPolicy } from "@/lib/config/portal";

describe("acceptance policy resolution", () => {
  it("null derives from configuration: form when fields are enabled, else terms", () => {
    expect(accessPolicyDecision(null, false)).toBe("terms");
    expect(accessPolicyDecision(null, true)).toBe("form");
    expect(accessPolicyDecision(undefined, false)).toBe("terms");
  });

  it("a stored choice always wins over the derivation", () => {
    expect(accessPolicyDecision("open", true)).toBe("open");
    expect(accessPolicyDecision("terms", true)).toBe("terms");
    expect(accessPolicyDecision("form", false)).toBe("form");
    expect(accessPolicyDecision("sponsored", false)).toBe("sponsored");
  });

  it("an unrecognised stored value falls back to the derivation", () => {
    expect(accessPolicyDecision("passphrase", false)).toBe("terms");
    expect(accessPolicyDecision("", true)).toBe("form");
  });

  it("isAccessPolicy accepts exactly the four values", () => {
    expect(isAccessPolicy("open")).toBe(true);
    expect(isAccessPolicy("terms")).toBe(true);
    expect(isAccessPolicy("form")).toBe(true);
    expect(isAccessPolicy("sponsored")).toBe(true);
    expect(isAccessPolicy("Open")).toBe(false);
    expect(isAccessPolicy(null)).toBe(false);
    expect(isAccessPolicy(1)).toBe(false);
  });
});
