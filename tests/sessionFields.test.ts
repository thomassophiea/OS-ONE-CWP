import { describe, it, expect } from "vitest";
import {
  extractSessionFields,
  validateSessionFields,
  normalizeMac,
} from "@/lib/captive/extractSessionFields";

/** Exactly the parameter set observed on the wire from the XCC. */
const LIVE_QUERY = new URLSearchParams({
  "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
  ap: "AP5020-PVT-03MESHROOT",
  aploc: "PrimarySite",
  apmac: "1849f86c1c00",
  bssid: "1849f86c1c24",
  dest: "example.com/",
  hwc_ip: "apcp.ezcloudx.com",
  hwc_port: "80",
  mac: "66dffd68ba25",
  role: "Unregistered role for AURA-CWP",
  sn: "CV012408S-C0078",
  ssid: "AURA-CWP",
  token: "gUM7bD7k0bWu4IvfH0Pq4w!!",
  vlan: "0",
  vns: "AURA-CWP",
  wlan: "8",
});

describe("extractSessionFields", () => {
  it("maps every parameter the gateway actually sends", () => {
    expect(extractSessionFields(LIVE_QUERY)).toEqual({
      clientMac: "66dffd68ba25",
      apMac: "1849f86c1c00",
      bssid: "1849f86c1c24",
      apName: "AP5020-PVT-03MESHROOT",
      apSerial: "CV012408S-C0078",
      apLocation: "PrimarySite",
      ssid: "AURA-CWP",
      vns: "AURA-CWP",
      wlan: "8",
      vlan: "0",
      role: "Unregistered role for AURA-CWP",
      gatewayToken: "gUM7bD7k0bWu4IvfH0Pq4w!!",
      gatewayHost: "apcp.ezcloudx.com",
      gatewayPort: "80",
      originalDest: "example.com/",
    });
  });

  it("keeps apmac and bssid distinct", () => {
    const f = extractSessionFields(LIVE_QUERY);
    expect(f.apMac).not.toBe(f.bssid);
  });

  it("returns nulls rather than empty strings", () => {
    const f = extractSessionFields(new URLSearchParams({ mac: "", ssid: "  " }));
    expect(f.clientMac).toBeNull();
    expect(f.ssid).toBeNull();
  });
});

describe("validateSessionFields", () => {
  const valid = extractSessionFields(LIVE_QUERY);

  it("passes a real redirect", () => {
    expect(validateSessionFields(valid)).toEqual([]);
  });

  it.each(["clientMac", "wlan", "gatewayToken", "gatewayHost"] as const)(
    "flags missing %s",
    (field) => {
      const errors = validateSessionFields({ ...valid, [field]: null });
      expect(errors).toContainEqual({ field, problem: "MISSING" });
    }
  );

  it("rejects a malformed MAC", () => {
    expect(validateSessionFields({ ...valid, clientMac: "not-a-mac" })).toContainEqual({
      field: "clientMac",
      problem: "MALFORMED",
    });
  });

  it("accepts a colon-delimited MAC", () => {
    expect(
      validateSessionFields({ ...valid, clientMac: "66:df:fd:68:ba:25" })
    ).toEqual([]);
  });

  it("rejects a non-numeric WLAN index", () => {
    expect(validateSessionFields({ ...valid, wlan: "8; DROP TABLE" })).toContainEqual({
      field: "wlan",
      problem: "MALFORMED",
    });
  });

  it("rejects a gateway host carrying a scheme or path", () => {
    for (const host of ["http://apcp.ezcloudx.com", "apcp.ezcloudx.com/x", "a@b.com"]) {
      expect(validateSessionFields({ ...valid, gatewayHost: host })).toContainEqual({
        field: "gatewayHost",
        problem: "MALFORMED",
      });
    }
  });

  it("rejects a non-numeric gateway port", () => {
    expect(validateSessionFields({ ...valid, gatewayPort: "80x" })).toContainEqual({
      field: "gatewayPort",
      problem: "MALFORMED",
    });
  });

  it("rejects a token that could break out of the query string", () => {
    for (const token of ["abc&admin=1", "abc def", "a?b", "a#b"]) {
      expect(validateSessionFields({ ...valid, gatewayToken: token })).toContainEqual({
        field: "gatewayToken",
        problem: "MALFORMED",
      });
    }
  });

  it("rejects an absurdly long token", () => {
    expect(
      validateSessionFields({ ...valid, gatewayToken: "a".repeat(500) })
    ).toContainEqual({ field: "gatewayToken", problem: "MALFORMED" });
  });
});

describe("normalizeMac", () => {
  it("adds separators to the gateway's bare form", () => {
    expect(normalizeMac("66dffd68ba25")).toBe("66:df:fd:68:ba:25");
  });
  it("normalises case and separator style", () => {
    expect(normalizeMac("66-DF-FD-68-BA-25")).toBe("66:df:fd:68:ba:25");
  });
  it("leaves an unrecognisable value alone (lower-cased)", () => {
    expect(normalizeMac("NOT-A-MAC")).toBe("not-a-mac");
  });
});
