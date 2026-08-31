import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type LocaleResolution } from "@/lib/i18n";
import { effectiveEnabledLocales } from "@/lib/config/portal";

/**
 * The locale for the request being rendered.
 *
 * One helper so every page resolves it the same way — cookie first, then
 * `Accept-Language`, then English — filtered to the locales this deployment
 * offers. A page that read only the cookie would silently ignore a guest's
 * browser preference on their very first request, which is the one request
 * where it matters most.
 */
export async function requestLocale(): Promise<LocaleResolution> {
  const [jar, hdrs, enabled] = await Promise.all([
    cookies(),
    headers(),
    effectiveEnabledLocales(),
  ]);
  return resolveLocale({
    cookieValue: jar.get(LOCALE_COOKIE)?.value,
    acceptLanguage: hdrs.get("accept-language"),
    enabled,
  });
}

import type { NextRequest } from "next/server";
import { LOCALE_COOKIE as COOKIE } from "@/lib/i18n";
import { resolveLocale as resolve } from "@/lib/i18n";

/**
 * The locale for a route handler.
 *
 * Route handlers hold the request directly, so they read the cookie and header
 * off it rather than through `next/headers`. Same priority, same fallback, same
 * offered subset — the point is that an API error and the page that renders it
 * never disagree about what language the guest is reading.
 */
export async function routeLocale(request: NextRequest): Promise<LocaleResolution> {
  const enabled = await effectiveEnabledLocales();
  return resolve({
    cookieValue: request.cookies.get(COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
    enabled,
  });
}
