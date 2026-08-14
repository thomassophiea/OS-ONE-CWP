"use client";

import { useCallback, useState, useTransition } from "react";
import { LOCALES, LOCALE_COOKIE_MAX_AGE } from "@/lib/i18n";

/**
 * The language selector.
 *
 * A plain `<select>` on purpose. It is the one control on the page every mobile
 * OS already renders as a native, scrollable, accessible list — a custom
 * dropdown would look tidier and be worse to use one-handed on a phone, in a
 * hurry, in a language the guest is trying to get *out* of.
 *
 * Options are labelled in their own language, because someone hunting for
 * Japanese is looking for 日本語, not for the English word "Japanese".
 *
 * The choice is written to a cookie and the page is reloaded so the server
 * re-renders in the new language. Reloading rather than swapping strings client
 * side keeps one rendering path: everything a guest reads is produced on the
 * server, including the parts of the flow that never hydrate.
 */
export default function LanguagePicker({
  current,
  label,
}: {
  current: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(current);

  const change = useCallback((next: string) => {
    setValue(next);
    // Not HttpOnly: this cookie selects a translation and carries no authority.
    // `Lax` so it survives the gateway's top-level redirect, which is exactly
    // where a language choice would otherwise be lost.
    document.cookie = `cwp_locale=${encodeURIComponent(next)}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax${
      window.location.protocol === "https:" ? "; secure" : ""
    }`;
    startTransition(() => window.location.reload());
  }, []);

  return (
    <div className="flex items-center justify-end gap-2">
      <label htmlFor="cwp-language" className="text-xs text-slate-500">
        {label}
      </label>
      <select
        id="cwp-language"
        value={value}
        disabled={pending}
        onChange={(event) => change(event.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 disabled:opacity-60"
      >
        {LOCALES.map((locale) => (
          <option key={locale.code} value={locale.code} lang={locale.code}>
            {locale.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}
