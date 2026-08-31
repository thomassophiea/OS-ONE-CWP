import { describe, expect, it } from "vitest";
import {
  approvalRedeemable,
  effectiveStatus,
  isDecidable,
  isTerminal,
} from "@/lib/sponsorship/state";

const NOW = new Date("2026-08-31T12:00:00Z");
const FUTURE = new Date("2026-08-31T12:15:00Z");
const PAST = new Date("2026-08-31T11:45:00Z");

describe("sponsorship state arithmetic", () => {
  it("keeps a live PENDING request pending", () => {
    expect(effectiveStatus({ status: "PENDING", expiresAt: FUTURE }, NOW)).toBe("PENDING");
    expect(isDecidable({ status: "PENDING", expiresAt: FUTURE }, NOW)).toBe(true);
  });

  it("decays PENDING past its deadline to EXPIRED", () => {
    expect(effectiveStatus({ status: "PENDING", expiresAt: PAST }, NOW)).toBe("EXPIRED");
    expect(isDecidable({ status: "PENDING", expiresAt: PAST }, NOW)).toBe(false);
  });

  it("treats the deadline itself as expired", () => {
    expect(effectiveStatus({ status: "PENDING", expiresAt: NOW }, NOW)).toBe("EXPIRED");
  });

  it("never decays a decision that was made in time", () => {
    expect(effectiveStatus({ status: "APPROVED", expiresAt: PAST }, NOW)).toBe("APPROVED");
    expect(effectiveStatus({ status: "DENIED", expiresAt: PAST }, NOW)).toBe("DENIED");
    expect(effectiveStatus({ status: "CANCELLED", expiresAt: PAST }, NOW)).toBe("CANCELLED");
  });

  it("keeps a fresh approval redeemable and expires it after the window", () => {
    const justApproved = { status: "APPROVED" as const, approvedAt: new Date("2026-08-31T11:59:00Z") };
    expect(approvalRedeemable(justApproved, 900, NOW)).toBe(true);
    const staleApproval = { status: "APPROVED" as const, approvedAt: new Date("2026-08-31T11:00:00Z") };
    expect(approvalRedeemable(staleApproval, 900, NOW)).toBe(false);
  });

  it("never treats anything but a real approval as redeemable", () => {
    expect(approvalRedeemable({ status: "PENDING", approvedAt: null }, 900, NOW)).toBe(false);
    expect(approvalRedeemable({ status: "DENIED", approvedAt: null }, 900, NOW)).toBe(false);
    // A row that claims APPROVED without an approvedAt is corrupt; refuse it.
    expect(approvalRedeemable({ status: "APPROVED", approvedAt: null }, 900, NOW)).toBe(false);
  });

  it("refuses decisions on every terminal state", () => {
    for (const status of ["APPROVED", "DENIED", "EXPIRED", "CANCELLED"] as const) {
      expect(isDecidable({ status, expiresAt: FUTURE }, NOW)).toBe(false);
      expect(isTerminal(status)).toBe(true);
    }
    expect(isTerminal("PENDING")).toBe(false);
  });
});
