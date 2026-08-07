import { describe, it, expect } from "vitest";
import { parseListParams, parseCreateBody } from "@/lib/guests/requestParams";

const params = (qs: string) => new URLSearchParams(qs);

describe("parseListParams", () => {
  it("returns an empty filter for no parameters", () => {
    const result = parseListParams(params(""));
    expect(result).toEqual({ ok: true, filter: {} });
  });

  it("parses a comma-separated status list case-insensitively", () => {
    const result = parseListParams(params("status=active,revoked"));
    expect(result.ok && result.filter.status).toEqual(["ACTIVE", "REVOKED"]);
  });

  it("rejects an unknown status rather than ignoring it", () => {
    // Ignoring it would hand back the unfiltered list, which reads as "there
    // are no revoked guests" when the caller asked for exactly those.
    const result = parseListParams(params("status=connected"));
    expect(result.ok).toBe(false);
  });

  it("rejects an unparseable timestamp", () => {
    expect(parseListParams(params("start_time=yesterday")).ok).toBe(false);
  });

  it("rejects a reversed window", () => {
    const result = parseListParams(
      params("start_time=2026-08-07T00:00:00Z&end_time=2026-08-01T00:00:00Z")
    );
    expect(result.ok).toBe(false);
  });

  it("bounds the limit", () => {
    expect(parseListParams(params("limit=0")).ok).toBe(false);
    expect(parseListParams(params("limit=501")).ok).toBe(false);
    expect(parseListParams(params("limit=2.5")).ok).toBe(false);
    const ok = parseListParams(params("limit=25"));
    expect(ok.ok && ok.filter.limit).toBe(25);
  });

  it("truncates an overlong search term", () => {
    const result = parseListParams(params(`search=${"a".repeat(500)}`));
    expect(result.ok && result.filter.search!.length).toBe(128);
  });
});

describe("parseCreateBody", () => {
  const now = new Date("2026-08-07T12:00:00Z");

  it("requires a MAC address", () => {
    expect(parseCreateBody({}, now).ok).toBe(false);
    expect(parseCreateBody({ mac_address: "  " }, now).ok).toBe(false);
  });

  it("accepts snake_case and camelCase keys", () => {
    const a = parseCreateBody({ mac_address: "aa:bb:cc:dd:ee:f1" }, now);
    const b = parseCreateBody({ macAddress: "aa:bb:cc:dd:ee:f1" }, now);
    expect(a.ok && b.ok).toBe(true);
  });

  it("turns duration_minutes into an absolute expiry", () => {
    const result = parseCreateBody(
      { mac_address: "aa:bb:cc:dd:ee:f1", duration_minutes: 60 },
      now
    );
    expect(result.ok && result.value.expiresAt?.toISOString()).toBe("2026-08-07T13:00:00.000Z");
  });

  it("refuses both expiry forms at once instead of picking one", () => {
    const result = parseCreateBody(
      {
        mac_address: "aa:bb:cc:dd:ee:f1",
        duration_minutes: 60,
        expires_at: "2026-08-09T00:00:00Z",
      },
      now
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an expiry in the past", () => {
    const result = parseCreateBody(
      { mac_address: "aa:bb:cc:dd:ee:f1", expires_at: "2020-01-01T00:00:00Z" },
      now
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a non-positive or absurd duration", () => {
    for (const duration of [0, -5, 60 * 24 * 400]) {
      expect(
        parseCreateBody({ mac_address: "aa:bb:cc:dd:ee:f1", duration_minutes: duration }, now).ok
      ).toBe(false);
    }
  });

  it("normalises blank optional text to null", () => {
    const result = parseCreateBody(
      { mac_address: "aa:bb:cc:dd:ee:f1", display_name: "   ", notes: "hi" },
      now
    );
    expect(result.ok && result.value.displayName).toBeNull();
    expect(result.ok && result.value.notes).toBe("hi");
  });

  it("rejects a non-object body", () => {
    expect(parseCreateBody("aa:bb:cc:dd:ee:ff", now).ok).toBe(false);
    expect(parseCreateBody(null, now).ok).toBe(false);
  });
});
