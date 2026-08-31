import { requestLocale } from "@/lib/i18n/server";
import { effectiveBranding } from "@/lib/config/portal";
import LanguagePicker from "@/app/LanguagePicker";
import PortalFooter from "@/app/PortalFooter";

export const dynamic = "force-dynamic";

/**
 * Landing page. `/portal` is the ECP entry point and requires a signed request
 * from the gateway, so sending humans there produces a confusing error — this
 * page tells them what to do instead.
 */
export default async function Home() {
  const { locale, definition, messages, offered } = await requestLocale();
  const branding = await effectiveBranding();
  return (
    <main
      className="min-h-screen bg-slate-50 flex items-center justify-center p-4"
      lang={locale}
      dir={definition.dir}
    >
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">
        <LanguagePicker current={locale} label={messages.common.languageLabel} locales={offered} />
        <div className="mt-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{messages.landing.title}</h1>
          <p className="text-sm text-slate-500">{messages.landing.body}</p>
          <PortalFooter branding={branding} portalName={messages.common.portalName} className="mt-8 text-xs" />
        </div>
      </div>
    </main>
  );
}
