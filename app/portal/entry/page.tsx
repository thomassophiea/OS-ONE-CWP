import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { SESSION_COOKIE, readSessionCookie } from "@/lib/session/cookie";
import { isExpired } from "@/lib/session/repository";
import { requestLocale } from "@/lib/i18n/server";
import LanguagePicker from "@/app/LanguagePicker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where `user-portal-url` points.
 *
 * The Captive Portal API has to name a URL a client can simply open, and
 * `/portal` is not that: it is the ECP entry point and only answers a redirect
 * the access point has signed, so sending a guest there produces "this link
 * isn't valid". This page is the human-openable front door instead.
 *
 * If the browser already carries a session — the ordinary case, because the
 * gateway redirect came first — it continues wherever that session belongs. If
 * it does not, the guest gets the one instruction that actually works, rather
 * than an error about a signature they have never heard of.
 */
export default async function PortalEntryPage() {
  const jar = await cookies();
  const sessionId = readSessionCookie(jar.get(SESSION_COOKIE)?.value);
  const { locale, definition, messages } = await requestLocale();

  if (sessionId) {
    let session = null;
    try {
      session = await prisma.guestSession.findUnique({ where: { id: sessionId } });
    } catch (err) {
      log.error("entry_lookup_failed", { err });
    }

    if (session && !isExpired(session)) {
      if (session.status === "AUTHORIZED" || session.status === "ACCEPTED") {
        redirect(session.onboardingRequested ? "/portal/secure" : "/success");
      }
      redirect("/portal/consent");
    }
  }

  return (
    <main
      className="min-h-screen bg-slate-50 flex items-center justify-center p-4"
      lang={locale}
      dir={definition.dir}
    >
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">
        <LanguagePicker current={locale} label={messages.common.languageLabel} />
        <div className="mt-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{messages.entry.title}</h1>
          <p className="text-sm text-slate-600 leading-relaxed">{messages.entry.body}</p>
          <p className="mt-4 text-sm text-slate-500 leading-relaxed">{messages.entry.hint}</p>
          <p className="mt-8 text-xs text-slate-400">{messages.common.portalName}</p>
        </div>
      </div>
    </main>
  );
}
