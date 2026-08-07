import { describe, it, expect } from "vitest";
import { parseMacAddress, canonicalMac } from "@/lib/guests/mac";

describe("parseMacAddress", () => {
  it("normalises every format an operator might type", () => {
    for (const input of [
      "AA:BB:CC:DD:EE:F1",
      "aa-bb-cc-dd-ee-f1",
      "aabb.ccdd.eef1",
      "AABBCCDDEEF1",
      "  aa:BB-cc.dd:ee-f1  ",
    ]) {
      expect(parseMacAddress(input)).toEqual({ ok: true, value: "aa:bb:cc:dd:ee:f1" });
    }
  });

  it("rejects an empty value", () => {
    expect(parseMacAddress("")).toEqual({ ok: false, reason: "EMPTY" });
    expect(parseMacAddress(null)).toEqual({ ok: false, reason: "EMPTY" });
  });

  it("rejects anything that is not twelve hex digits", () => {
    for (const input of ["aa:bb:cc:dd:ee", "zz:bb:cc:dd:ee:ff", "aabbccddeeff00"]) {
      expect(parseMacAddress(input)).toEqual({ ok: false, reason: "MALFORMED" });
    }
  });

  it("does not strip arbitrary characters out of pasted noise", () => {
    // Stripping every non-hex character would turn this into a valid MAC.
    expect(parseMacAddress("mac is aabbccddeef1")).toEqual({
      ok: false,
      reason: "MALFORMED",
    });
  });

  it("rejects addresses no station can own", () => {
    for (const input of [
      "00:00:00:00:00:00",
      "ff:ff:ff:ff:ff:ff",
      "01:00:5e:00:00:01", // multicast
      "03:bb:cc:dd:ee:ff", // group bit set
    ]) {
      expect(parseMacAddress(input)).toEqual({ ok: false, reason: "NOT_A_STATION" });
    }
  });

  it("accepts locally administered unicast addresses (randomised client MACs)", () => {
    // Modern phones rotate into this range; refusing them would break the
    // common case.
    expect(canonicalMac("92:B8:6A:71:CE:AE")).toBe("92:b8:6a:71:ce:ae");
  });

  it("canonicalMac returns null instead of throwing", () => {
    expect(canonicalMac("nope")).toBeNull();
  });
});
