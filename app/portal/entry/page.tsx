import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { SESSION_COOKIE, readSessionCookie } from "@/lib/session/cookie";
import { isExpired } from "@/lib/session/repository";

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
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Guest Wi-Fi</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          To get online, open any web page in your browser. You&apos;ll be brought
          straight back here to accept the terms.
        </p>
        <p className="mt-4 text-sm text-slate-500 leading-relaxed">
          If nothing happens, disconnect from the Wi-Fi network and reconnect.
        </p>
        <p className="mt-8 text-xs text-slate-400">OS-ONE-CWP</p>
      </div>
    </main>
  );
}
