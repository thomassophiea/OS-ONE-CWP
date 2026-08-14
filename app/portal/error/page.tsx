import { requestLocale } from "@/lib/i18n/server";
import LanguagePicker from "@/app/LanguagePicker";
import type { Messages } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * Deliberately generic, operator-friendly errors. The specific failure reason
 * is recorded in the audit table and the structured log; the guest sees only
 * enough to know whether retrying will help — and sees it in their own
 * language, because an error nobody can read is an error nobody can act on.
 */
export default async function PortalErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const { locale, definition, messages } = await requestLocale();

  const key = (code ?? "") as keyof Messages["errors"];
  const message = messages.errors[key] ?? messages.errors.bad_request;

  return (
    <main
      className="min-h-screen bg-slate-50 flex items-center justify-center p-4"
      lang={locale}
      dir={definition.dir}
    >
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">
        <LanguagePicker current={locale} label={messages.common.languageLabel} />
        <div className="mt-4 text-center">
          <div className="mb-4 text-amber-500" aria-hidden="true">
            <svg
              className="mx-auto h-14 w-14"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">{message.title}</h1>
          <p className="text-sm text-slate-500">{message.body}</p>
          {/* The code stays untranslated: it is what an operator is told to read
              back, and a localised one would not match the logs. */}
          <p className="mt-8 text-xs text-slate-400">
            {messages.common.portalName}
            {code ? ` · ${code}` : ""}
          </p>
        </div>
      </div>
    </main>
  );
}
