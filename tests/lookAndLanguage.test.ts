import { describe, expect, it } from "vitest";
import {
  contrastAgainstWhite,
  enabledLocalesDecision,
  isAcceptableBrandColor,
} from "@/lib/config/portal";
import { LOCALES, resolveLocale } from "@/lib/i18n";

const ALL = LOCALES.map((l) => l.code);

describe("brand colour acceptance (white ink must clear 4.5:1)", () => {
  it("accepts the design swatches", () => {
    for (const hex of ["#4b449b", "#2563eb", "#0f766e", "#1d4ed8", "#374151"]) {
      expect(isAcceptableBrandColor(hex), hex).toBe(true);
    }
  });

  it("rejects colours whose white ink fails, and non-colours", () => {
    expect(isAcceptableBrandColor("#f9c56f")).toBe(false); // warning amber, 1.6:1-ish
    expect(isAcceptableBrandColor("#ffffff")).toBe(false);
    expect(isAcceptableBrandColor("blue")).toBe(false);
    expect(isAcceptableBrandColor("#fff")).toBe(false);
  });

  it("measures the known pairs", () => {
    expect(contrastAgainstWhite("#000000")).toBeCloseTo(21, 0);
    expect(contrastAgainstWhite("#ffffff")).toBeCloseTo(1, 1);
  });
});

describe("offered locale subset", () => {
  it("null or garbage offers all locales — a bad value can never empty the offer", () => {
    expect(enabledLocalesDecision(null, ALL)).toEqual(ALL);
    expect(enabledLocalesDecision("klingon,elvish", ALL)).toEqual(ALL);
  });

  it("filters to the valid subset in stored order", () => {
    expect(enabledLocalesDecision("de,ja,klingon", ALL)).toEqual(["de", "ja"]);
  });

  it("resolution ignores a cookie for a disabled locale", () => {
    const r = resolveLocale({ cookieValue: "fr", acceptLanguage: "de", enabled: ["en", "de"] });
    expect(r.locale).toBe("de");
    expect(r.source).toBe("browser");
    expect(r.offered.map((l) => l.code)).toEqual(["en", "de"]);
  });

  it("defaults to the first offered locale when English is not offered", () => {
    const r = resolveLocale({ cookieValue: null, acceptLanguage: null, enabled: ["ja", "ko"] });
    expect(r.locale).toBe("ja");
    expect(r.source).toBe("default");
  });

  it("unfiltered resolution still offers everything", () => {
    const r = resolveLocale({ cookieValue: "es", acceptLanguage: null });
    expect(r.locale).toBe("es");
    expect(r.offered).toHaveLength(ALL.length);
  });
});
