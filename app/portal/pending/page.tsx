import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { SESSION_COOKIE, readSessionCookie } from "@/lib/session/cookie";
import { isExpired } from "@/lib/session/repository";
import { effectiveSponsorship } from "@/lib/config/portal";
import { effectiveStatus } from "@/lib/sponsorship/state";
import { latestSponsorshipForSession } from "@/lib/sponsorship/service";
import { requestLocale } from "@/lib/i18n/server";
import LanguagePicker from "@/app/LanguagePicker";
import PendingStatus, { type PendingInitialState } from "./PendingStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The waiting room.
 *
 * Server-rendered with the request's real current state, so a guest who
 * reloads — or whose captive webview re-opens the page — always sees the
 * truth even before the first poll fires. The client component only keeps
 * the page current from there.
 */
export default async function PendingPage() {
  const jar = await cookies();
  const { locale, definition, messages } = await requestLocale();
  const sessionId = readSessionCookie(jar.get(SESSION_COOKIE)?.value);

  if (!sessionId) redirect("/portal/error?code=no_session");

  let session;
  let sponsorship;
  try {
    session = await prisma.guestSession.findUnique({ where: { id: sessionId } });
    sponsorship = await latestSponsorshipForSession(sessionId);
  } catch (err) {
    log.error("pending_lookup_failed", { err });
    redirect("/portal/error?code=unavailable");
  }

  if (!session) redirect("/portal/error?code=no_session");
  // Nothing to wait for: the guest has not submitted a sponsorship request.
  if (!sponsorship) redirect("/portal/consent");
  if (session.status === "AUTHORIZED") redirect("/success");

  const status = effectiveStatus(sponsorship);
  let initialState: PendingInitialState;
  if (status === "PENDING") {
    initialState = isExpired(session) ? "session_expired" : "pending";
  } else if (status === "APPROVED") {
    initialState = isExpired(session) ? "session_expired" : "approved_waiting";
  } else if (status === "DENIED") {
    initialState = "denied";
  } else {
    initialState = "expired";
  }

  return (
    <main
      className="min-h-screen bg-slate-50 flex items-center justify-center p-4"
      lang={locale}
      dir={definition.dir}
    >
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">
        <LanguagePicker current={locale} label={messages.common.languageLabel} />

        <PendingStatus
          initialState={initialState}
          sponsorEmail={sponsorship.sponsorEmail}
          ttlMinutes={Math.max(1, Math.round((await effectiveSponsorship()).ttlSeconds / 60))}
          messages={{ common: messages.common, sponsorship: messages.sponsorship }}
          networkLabel={messages.consent.networkLabel}
          ssid={session.ssid}
        />

        <p className="mt-6 text-center text-xs text-slate-400">{messages.common.portalName}</p>
      </div>
    </main>
  );
}
