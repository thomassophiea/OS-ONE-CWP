import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALES,
  format,
  getMessages,
  localesFromAcceptLanguage,
  matchLocale,
  resolveLocale,
} from "@/lib/i18n";
import { en } from "@/lib/i18n/locales/en";

/**
 * Localisation.
 *
 * The completeness check is the one that earns its keep: it walks every
 * catalogue against English and fails on a missing key, a stray key, or a
 * placeholder that a translator dropped. TypeScript already catches missing
 * keys at build time; this catches the two things it cannot — an untranslated
 * value copied verbatim from English, and a `{ssid}` that vanished in
 * translation and would render as a sentence with a hole in it.
 */

type Node = Record<string, unknown>;

function flatten(node: Node, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else if (value && typeof value === "object") Object.assign(out, flatten(value as Node, path));
  }
  return out;
}

const ENGLISH = flatten(en as unknown as Node);
const PLACEHOLDER = /\{(\w+)\}/g;
const placeholdersIn = (value: string) => (value.match(PLACEHOLDER) ?? []).sort();

/**
 * Keys that may legitimately read the same as English.
 *
 * Two kinds, and the distinction is the point of the exemption list being short
 * and explicit rather than a blanket "close enough":
 *
 *  - **Identifiers**, which must not be translated at all: the product name and
 *    the security modes, which have to match what the guest's own device shows.
 *  - **Cognates**, where the correct translation happens to be the English
 *    word. "Session" really is Session in French; "optional" really is optional
 *    in German. Listing them individually means a *new* untranslated string
 *    still fails, which is what this check exists for.
 *
 * Field placeholders are exempt as a class because they are sample data, not
 * prose — an example email address, a room number, a person's name.
 */
const NOT_TRANSLATED = new Set([
  "common.portalName",
  "security.wpa2-psk",
  "security.wpa3-sae",
  "security.wpa2-wpa3-psk",
  "security.owe",
]);

const COGNATES = new Set(["fr:success.sessionLabel", "de:common.optional"]);

const isSampleData = (key: string) => key.endsWith(".placeholder");

describe("catalogue completeness", () => {
  it("ships eight locales with English first", () => {
    expect(LOCALES).toHaveLength(8);
    expect(LOCALES[0].code).toBe(DEFAULT_LOCALE);
  });

  it("gives every locale a native name and a direction", () => {
    for (const locale of LOCALES) {
      expect(locale.nativeName.trim()).not.toBe("");
      expect(["ltr", "rtl"]).toContain(locale.dir);
    }
  });

  for (const locale of LOCALES) {
    describe(locale.code, () => {
      const catalogue = flatten(locale.messages as unknown as Node);

      it("has exactly the English key set", () => {
        expect(Object.keys(catalogue).sort()).toEqual(Object.keys(ENGLISH).sort());
      });

      it("has no empty values", () => {
        const empty = Object.entries(catalogue).filter(([, v]) => !v.trim());
        expect(empty).toEqual([]);
      });

      it("preserves every placeholder", () => {
        // A dropped `{ssid}` renders a sentence with a hole in it, and no type
        // system can see it.
        const broken = Object.keys(ENGLISH).filter(
          (key) =>
            placeholdersIn(ENGLISH[key]).join() !== placeholdersIn(catalogue[key]).join()
        );
        expect(broken).toEqual([]);
      });

      if (locale.code !== DEFAULT_LOCALE) {
        it("is actually translated", () => {
          const untranslated = Object.keys(ENGLISH).filter(
            (key) =>
              !NOT_TRANSLATED.has(key) &&
              !isSampleData(key) &&
              !COGNATES.has(`${locale.code}:${key}`) &&
              catalogue[key] === ENGLISH[key]
          );
          expect(untranslated).toEqual([]);
        });
      }

      it("keeps device-facing identifiers in the form the device shows", () => {
        // `netsh`, the Settings path and the filename are things a guest types
        // or looks for verbatim; translating them makes the instruction wrong.
        expect(catalogue["methods.windowsFollowUp"]).toContain("netsh wlan add profile");
        expect(catalogue["methods.windowsFollowUp"]).toContain("secure-wifi.xml");
        expect(catalogue["methods.macFollowUp"]).toContain("System Settings");
      });
    });
  }
});

describe("matching a requested language", () => {
  it("matches exactly", () => {
    expect(matchLocale("fr")).toBe("fr");
  });

  it("matches a region to its base language", () => {
    // pt-BR must get Portuguese, not fall through to English.
    expect(matchLocale("pt-BR")).toBe("pt");
    expect(matchLocale("fr-CA")).toBe("fr");
    expect(matchLocale("es-419")).toBe("es");
    expect(matchLocale("de-AT")).toBe("de");
  });

  it("maps Simplified Chinese by script and region", () => {
    expect(matchLocale("zh-CN")).toBe("zh-Hans");
    expect(matchLocale("zh-Hans-CN")).toBe("zh-Hans");
    expect(matchLocale("zh-SG")).toBe("zh-Hans");
  });

  it("refuses to serve Simplified to a Traditional reader", () => {
    // A worse answer than English, so it is not given.
    expect(matchLocale("zh-TW")).toBeNull();
    expect(matchLocale("zh-HK")).toBeNull();
    expect(matchLocale("zh-Hant")).toBeNull();
  });

  it("returns null for a language we do not have", () => {
    expect(matchLocale("sv")).toBeNull();
    expect(matchLocale("")).toBeNull();
  });
});

describe("Accept-Language", () => {
  it("honours quality values rather than taking the first tag", () => {
    expect(localesFromAcceptLanguage("en;q=0.3, ja;q=0.9, fr;q=0.7")).toEqual(["ja", "fr", "en"]);
  });

  it("defaults a tag with no q to the highest priority", () => {
    expect(localesFromAcceptLanguage("ko, en;q=0.5")[0]).toBe("ko");
  });

  it("treats q=0 as a refusal, not a low score", () => {
    expect(localesFromAcceptLanguage("de;q=0, es;q=0.5")).toEqual(["es"]);
  });

  it("skips languages we do not have", () => {
    expect(localesFromAcceptLanguage("sv-SE, da, ko")).toEqual(["ko"]);
  });

  it("survives a malformed header", () => {
    expect(localesFromAcceptLanguage("")).toEqual([]);
    expect(localesFromAcceptLanguage(null)).toEqual([]);
    expect(localesFromAcceptLanguage(";;;")).toEqual([]);
  });

  it("does not duplicate a language reached by two tags", () => {
    expect(localesFromAcceptLanguage("pt-BR, pt-PT, pt")).toEqual(["pt"]);
  });
});

describe("resolution priority", () => {
  it("puts a previous choice above the browser's preference", () => {
    const resolved = resolveLocale({ cookieValue: "ja", acceptLanguage: "fr-FR,fr;q=0.9" });
    expect(resolved.locale).toBe("ja");
    expect(resolved.source).toBe("selection");
  });

  it("uses the browser when there is no previous choice", () => {
    const resolved = resolveLocale({ acceptLanguage: "de-DE,de;q=0.9,en;q=0.5" });
    expect(resolved.locale).toBe("de");
    expect(resolved.source).toBe("browser");
  });

  it("ignores a cookie naming a language we do not have", () => {
    const resolved = resolveLocale({ cookieValue: "sv", acceptLanguage: "es" });
    expect(resolved.locale).toBe("es");
  });

  it("falls back to English for an unknown locale", () => {
    const resolved = resolveLocale({ acceptLanguage: "sv-SE,da;q=0.8" });
    expect(resolved.locale).toBe("en");
    expect(resolved.source).toBe("default");
  });

  it("falls back to English with no signals at all", () => {
    expect(resolveLocale({}).locale).toBe("en");
  });
});

describe("placeholder substitution", () => {
  it("fills a named placeholder", () => {
    expect(format("Join {ssid} now", { ssid: "Skynet" })).toBe("Join Skynet now");
  });

  it("fills the same placeholder more than once", () => {
    expect(format("{a} and {a}", { a: "x" })).toBe("x and x");
  });

  it("leaves an unknown placeholder visible rather than printing undefined", () => {
    expect(format("Join {ssid}", {})).toBe("Join {ssid}");
  });

  it("works with every catalogue", () => {
    for (const locale of LOCALES) {
      const rendered = format(getMessages(locale.code).qr.title, { ssid: "Skynet" });
      expect(rendered).toContain("Skynet");
      expect(rendered).not.toContain("{ssid}");
    }
  });
});
