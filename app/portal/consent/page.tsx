import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import {
  SESSION_COOKIE,
  CSRF_COOKIE,
  readSessionCookie,
  consentChallenge,
} from "@/lib/session/cookie";
import { isExpired } from "@/lib/session/repository";
import { normalizeMac } from "@/lib/captive/extractSessionFields";
import ConsentForm from "./ConsentForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ConsentPage() {
  const jar = await cookies();
  const sessionId = readSessionCookie(jar.get(SESSION_COOKIE)?.value);
  const csrfToken = jar.get(CSRF_COOKIE)?.value ?? "";

  if (!sessionId) redirect("/portal/error?code=no_session");

  let session;
  try {
    session = await prisma.guestSession.findUnique({ where: { id: sessionId } });
  } catch (err) {
    log.error("consent_lookup_failed", { err });
    redirect("/portal/error?code=unavailable");
  }

  if (!session) redirect("/portal/error?code=no_session");
  if (isExpired(session)) redirect("/portal/error?code=expired");
  if (session.status === "AUTHORIZED" || session.status === "ACCEPTED") {
    redirect("/success");
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Guest Wi-Fi Access</h1>
          <p className="mt-2 text-sm text-slate-500">
            Review and accept the terms of use to get online.
          </p>
        </header>

        {/* Only what a guest can act on. The access point name, its serial and
            the site name are infrastructure identifiers that tell the guest
            nothing and tell a passer-by something — they stay in the session
            record and the admin view. */}
        <dl className="mb-6 rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200 text-sm">
          <Row label="Network" value={session.ssid} />
          <Row
            label="Device"
            value={session.clientMac ? normalizeMac(session.clientMac) : null}
          />
        </dl>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 mb-6 text-sm text-slate-700 max-h-40 overflow-y-auto leading-relaxed">
          By using this guest wireless network you agree to use the service
          lawfully and responsibly. Traffic may be monitored and logged for
          security and operational purposes. Access is provided without warranty
          and may be withdrawn at any time.
        </div>

        {!session.sanitizedDest && session.destRejectionReason && (
          <p className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            We could not safely restore the page you were visiting, so you will
            be returned here after connecting.
          </p>
        )}

        <ConsentForm
          csrfToken={csrfToken}
          challenge={consentChallenge(session.id)}
        />

        <p className="mt-6 text-center text-xs text-slate-400">OS-ONE-CWP</p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 px-4 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900 font-medium text-right break-all">{value}</dd>
    </div>
  );
}
