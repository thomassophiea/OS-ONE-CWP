import { requestLocale } from "@/lib/i18n/server";
import LanguagePicker from "@/app/LanguagePicker";

export const dynamic = "force-dynamic";

/**
 * Landing page. `/portal` is the ECP entry point and requires a signed request
 * from the gateway, so sending humans there produces a confusing error — this
 * page tells them what to do instead.
 */
export default async function Home() {
  const { locale, definition, messages } = await requestLocale();
  return (
    <main
      className="min-h-screen bg-slate-50 flex items-center justify-center p-4"
      lang={locale}
      dir={definition.dir}
    >
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">
        <LanguagePicker current={locale} label={messages.common.languageLabel} />
        <div className="mt-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{messages.landing.title}</h1>
          <p className="text-sm text-slate-500">{messages.landing.body}</p>
          <p className="mt-8 text-xs text-slate-400">{messages.common.portalName}</p>
        </div>
      </div>
    </main>
  );
}
