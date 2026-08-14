/**
 * Localisation for the guest-facing portal.
 *
 * The whole of the design is: one typed catalogue per locale, one registry
 * entry each, and negotiation that never invents an answer. Adding a language
 * is a new file plus a line in `LOCALES` — the compiler then refuses the build
 * until every key is translated, which is what stops a half-finished locale
 * shipping and silently rendering English at a guest.
 *
 * Nothing here is stored in Postgres. A locale is a rendering preference, not
 * personal data, and it lives in a cookie for exactly as long as the portal
 * visit does — see `lib/privacy/policy.ts` for why that distinction is drawn
 * deliberately rather than by accident.
 */

import { en, type Messages } from "@/lib/i18n/locales/en";
import { es } from "@/lib/i18n/locales/es";
import { fr } from "@/lib/i18n/locales/fr";
import { de } from "@/lib/i18n/locales/de";
import { pt } from "@/lib/i18n/locales/pt";
import { zhHans } from "@/lib/i18n/locales/zh-Hans";
import { ja } from "@/lib/i18n/locales/ja";
import { ko } from "@/lib/i18n/locales/ko";

export type { Messages };

export interface LocaleDefinition {
  /** BCP 47 tag. Also the `lang` attribute and the cookie value. */
  code: string;
  /** Shown in the picker, in the language itself — a guest looking for their
   *  own language is not helped by the English name of it. */
  nativeName: string;
  /** Writing direction, for the `dir` attribute. */
  dir: "ltr" | "rtl";
  messages: Messages;
}

/**
 * Supported locales, in the order the picker shows them.
 *
 * English first because it is the fallback; the rest by rough reach. To add a
 * language: create `locales/<tag>.ts` typed as `Messages`, and add a row here.
 */
export const LOCALES: readonly LocaleDefinition[] = [
  { code: "en", nativeName: "English", dir: "ltr", messages: en },
  { code: "es", nativeName: "Español", dir: "ltr", messages: es },
  { code: "fr", nativeName: "Français", dir: "ltr", messages: fr },
  { code: "de", nativeName: "Deutsch", dir: "ltr", messages: de },
  { code: "pt", nativeName: "Português", dir: "ltr", messages: pt },
  { code: "zh-Hans", nativeName: "简体中文", dir: "ltr", messages: zhHans },
  { code: "ja", nativeName: "日本語", dir: "ltr", messages: ja },
  { code: "ko", nativeName: "한국어", dir: "ltr", messages: ko },
] as const;

export const DEFAULT_LOCALE = "en";
export const LOCALE_COOKIE = "cwp_locale";

const BY_CODE = new Map(LOCALES.map((l) => [l.code.toLowerCase(), l]));

export function isSupportedLocale(code: string | null | undefined): boolean {
  return Boolean(code && BY_CODE.has(code.trim().toLowerCase()));
}

export function localeDefinition(code: string | null | undefined): LocaleDefinition {
  return BY_CODE.get((code ?? "").trim().toLowerCase()) ?? BY_CODE.get(DEFAULT_LOCALE)!;
}

export function getMessages(code: string | null | undefined): Messages {
  return localeDefinition(code).messages;
}

/**
 * Match a requested language tag to something we actually have.
 *
 * Two levels, and the second one matters more than it looks: a browser asking
 * for `pt-BR`, `fr-CA` or `es-419` gets Portuguese, French and Spanish rather
 * than falling through to English. Chinese is handled by script rather than
 * region — `zh-CN`, `zh-SG` and `zh-Hans-*` are Simplified; `zh-TW` and `zh-HK`
 * are Traditional and are *not* claimed here, because serving Simplified to a
 * Traditional reader is a worse answer than serving English.
 */
export function matchLocale(tag: string): string | null {
  const normalised = tag.trim().toLowerCase();
  if (!normalised) return null;

  const exact = BY_CODE.get(normalised);
  if (exact) return exact.code;

  if (normalised.startsWith("zh")) {
    const traditional = /\bhant\b|-tw|-hk|-mo/.test(normalised);
    return traditional ? null : "zh-Hans";
  }

  const primary = normalised.split("-")[0];
  const byPrimary = BY_CODE.get(primary);
  return byPrimary ? byPrimary.code : null;
}

/**
 * Parse an `Accept-Language` header into locale codes we support, best first.
 *
 * Quality values are honoured because they are how a browser expresses "French,
 * but English if you must" — ignoring them and taking the first tag gets that
 * backwards for anyone with more than one language configured.
 */
export function localesFromAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => /^\s*q\s*=\s*([\d.]+)\s*$/i.exec(p))
        .find(Boolean)?.[1];
      const quality = q === undefined ? 1 : Number.parseFloat(q);
      return { tag: tag.trim(), quality: Number.isFinite(quality) ? quality : 0 };
    })
    // `q=0` means "explicitly not this one", so it is a filter, not a low score.
    .filter((entry) => entry.tag && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  const out: string[] = [];
  for (const { tag } of ranked) {
    if (tag === "*") continue;
    const matched = matchLocale(tag);
    if (matched && !out.includes(matched)) out.push(matched);
  }
  return out;
}

export type LocaleSource = "selection" | "browser" | "default";

export interface LocaleResolution {
  locale: string;
  definition: LocaleDefinition;
  messages: Messages;
  /** Where the answer came from. Rendered nowhere; useful in logs and tests. */
  source: LocaleSource;
}

/**
 * Resolve the locale for a request.
 *
 * Priority is fixed and deliberate:
 *   1. what this guest chose, if they chose;
 *   2. what their browser asked for;
 *   3. English.
 *
 * Geolocation is not consulted, and is not going to be: where a device is has
 * never been a reliable statement about what its owner reads.
 */
export function resolveLocale({
  cookieValue,
  acceptLanguage,
}: {
  cookieValue?: string | null;
  acceptLanguage?: string | null;
}): LocaleResolution {
  if (isSupportedLocale(cookieValue)) {
    const definition = localeDefinition(cookieValue);
    return { locale: definition.code, definition, messages: definition.messages, source: "selection" };
  }

  const [best] = localesFromAcceptLanguage(acceptLanguage);
  if (best) {
    const definition = localeDefinition(best);
    return { locale: definition.code, definition, messages: definition.messages, source: "browser" };
  }

  const definition = localeDefinition(DEFAULT_LOCALE);
  return { locale: definition.code, definition, messages: definition.messages, source: "default" };
}

/**
 * Substitute `{name}` placeholders.
 *
 * Values are inserted verbatim. Everything that reaches this is rendered by
 * React as a text node, so escaping is React's job — doing it here as well
 * would double-escape an SSID containing an ampersand.
 */
export function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? String(params[key]) : whole
  );
}

/** How long a language choice is remembered. One day covers any portal visit. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24;

/**
 * Cookie options for the language choice.
 *
 * Readable by script, unlike the session cookies, because it carries no
 * authority — it selects a translation and nothing else. `SameSite=Lax` so it
 * survives the gateway's top-level redirect, which is the moment a guest's
 * language choice would otherwise be lost.
 */
export function localeCookieOptions(secure: boolean) {
  return {
    httpOnly: false,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
  };
}
