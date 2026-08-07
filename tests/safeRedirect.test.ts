import { describe, it, expect } from "vitest";
import {
  isAllowedGatewayHost,
  gatewayHostAllowlist,
  sanitizeOriginalDestination,
  toAbsoluteDestination,
  safeInternalRedirect,
} from "@/lib/captive/safeRedirect";

const FALLBACK = "https://portal.example/portal/error";

describe("isAllowedGatewayHost", () => {
  const list = ["ezcloudx.com", "192.168.100.12"];

  it("accepts an exact match", () => {
    expect(isAllowedGatewayHost("192.168.100.12", list)).toBe(true);
  });
  it("accepts a subdomain of a listed domain", () => {
    expect(isAllowedGatewayHost("apcp.ezcloudx.com", list)).toBe(true);
  });
  it("is case-insensitive", () => {
    expect(isAllowedGatewayHost("APCP.EzCloudX.CoM", list)).toBe(true);
  });
  it("rejects a lookalike suffix", () => {
    expect(isAllowedGatewayHost("evilezcloudx.com", list)).toBe(false);
  });
  it("rejects a host that merely contains the domain", () => {
    expect(isAllowedGatewayHost("ezcloudx.com.evil.example", list)).toBe(false);
  });
  it("does not treat an IP literal as a parent domain", () => {
    expect(isAllowedGatewayHost("evil.192.168.100.12", list)).toBe(false);
  });
  it("rejects everything when the allowlist is empty", () => {
    expect(isAllowedGatewayHost("apcp.ezcloudx.com", [])).toBe(false);
  });
  it("rejects null and empty input", () => {
    expect(isAllowedGatewayHost(null, list)).toBe(false);
    expect(isAllowedGatewayHost("  ", list)).toBe(false);
  });
});

describe("gatewayHostAllowlist", () => {
  it("prefers the current variable name", () => {
    expect(
      gatewayHostAllowlist({
        XCC_ALLOWED_GATEWAY_HOSTS: "a.example, b.example",
        ALLOWED_REDIRECT_DOMAINS: "legacy.example",
      })
    ).toEqual(["a.example", "b.example"]);
  });
  it("falls back to the legacy variable", () => {
    expect(
      gatewayHostAllowlist({
        ALLOWED_REDIRECT_DOMAINS: "legacy.example",
      })
    ).toEqual(["legacy.example"]);
  });
  it("is empty when neither is set", () => {
    expect(gatewayHostAllowlist({})).toEqual([]);
  });
});

describe("sanitizeOriginalDestination", () => {
  it("accepts the scheme-less form the gateway actually sends", () => {
    expect(sanitizeOriginalDestination("example.com/", FALLBACK)).toEqual({
      safe: true,
      value: "example.com/",
    });
  });
  it("accepts an absolute https URL", () => {
    expect(sanitizeOriginalDestination("https://example.com/a?b=1", FALLBACK)).toEqual({
      safe: true,
      value: "https://example.com/a?b=1",
    });
  });
  it("accepts an absolute http URL", () => {
    expect(sanitizeOriginalDestination("http://neverssl.com/", FALLBACK).safe).toBe(true);
  });

  it.each([
    ["javascript:alert(1)", "UNSAFE_SCHEME"],
    ["JaVaScRiPt:alert(1)", "UNSAFE_SCHEME"],
    ["data:text/html,<script>alert(1)</script>", "UNSAFE_SCHEME"],
    ["file:///etc/passwd", "UNSAFE_SCHEME"],
    ["vbscript:msgbox(1)", "UNSAFE_SCHEME"],
    ["ftp://example.com/x", "UNSAFE_SCHEME"],
    ["//evil.example/x", "PROTOCOL_RELATIVE"],
    ["\\\\evil.example\\x", "PROTOCOL_RELATIVE"],
  ])("rejects %s", (input, reason) => {
    const verdict = sanitizeOriginalDestination(input, FALLBACK);
    expect(verdict).toMatchObject({ safe: false, reason, fallback: FALLBACK });
  });

  it("rejects embedded control characters used for parser differentials", () => {
    expect(
      sanitizeOriginalDestination("java\tscript:alert(1)", FALLBACK)
    ).toMatchObject({ safe: false, reason: "CONTROL_CHARACTERS" });
    expect(sanitizeOriginalDestination("/\n/evil.example", FALLBACK)).toMatchObject({
      safe: false,
      reason: "CONTROL_CHARACTERS",
    });
  });

  it("rejects an empty or absent destination", () => {
    expect(sanitizeOriginalDestination(null, FALLBACK).safe).toBe(false);
    expect(sanitizeOriginalDestination("   ", FALLBACK)).toMatchObject({
      safe: false,
      reason: "EMPTY",
    });
  });

  it("rejects an over-long destination", () => {
    expect(
      sanitizeOriginalDestination(`example.com/${"a".repeat(3000)}`, FALLBACK)
    ).toMatchObject({ safe: false, reason: "TOO_LONG" });
  });
});

describe("toAbsoluteDestination", () => {
  it("promotes the gateway's scheme-less form to http", () => {
    expect(toAbsoluteDestination("neverssl.com/")).toBe("http://neverssl.com/");
  });
  it("leaves an absolute URL alone", () => {
    expect(toAbsoluteDestination("https://example.com/x")).toBe("https://example.com/x");
  });
  it("returns null for anything unsafe", () => {
    expect(toAbsoluteDestination("javascript:alert(1)")).toBeNull();
    expect(toAbsoluteDestination(null)).toBeNull();
  });
});

describe("safeInternalRedirect", () => {
  const base = "https://portal.example";
  it("keeps a same-origin path", () => {
    expect(safeInternalRedirect("/success", base)).toBe("https://portal.example/success");
  });
  it("refuses another origin", () => {
    expect(safeInternalRedirect("https://evil.example/x", base)).toBe(
      "https://portal.example/portal/error"
    );
  });
  it("refuses a protocol-relative URL", () => {
    expect(safeInternalRedirect("//evil.example/x", base)).toBe(
      "https://portal.example/portal/error"
    );
  });
  it("refuses a javascript URL", () => {
    expect(safeInternalRedirect("javascript:alert(1)", base)).toBe(
      "https://portal.example/portal/error"
    );
  });
});
