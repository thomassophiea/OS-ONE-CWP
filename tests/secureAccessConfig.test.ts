import { describe, expect, it } from "vitest";
import { secureAccessDecision } from "@/lib/config/portal";

describe("secure access operator switch", () => {
  it("offers when configured and no override is stored", () => {
    expect(secureAccessDecision(true, null)).toEqual({ configured: true, enabled: true });
    expect(secureAccessDecision(true, undefined)).toEqual({ configured: true, enabled: true });
  });

  it("true is the same as null — the switch cannot add requirements", () => {
    expect(secureAccessDecision(true, true)).toEqual({ configured: true, enabled: true });
  });

  it("false forces the offer off even when configured", () => {
    expect(secureAccessDecision(true, false)).toEqual({ configured: true, enabled: false });
  });

  it("can never conjure the offer without a configured secure WLAN", () => {
    expect(secureAccessDecision(false, true)).toEqual({ configured: false, enabled: false });
    expect(secureAccessDecision(false, null)).toEqual({ configured: false, enabled: false });
  });
});
