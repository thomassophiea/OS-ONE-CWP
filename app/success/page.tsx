import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { SESSION_COOKIE, readSessionCookie } from "@/lib/session/cookie";
import { audit } from "@/lib/session/repository";
import { normalizeMac } from "@/lib/captive/extractSessionFields";
import { recordAuthorizedGuest } from "@/lib/guests/repository";
import { toAbsoluteDestination } from "@/lib/captive/safeRedirect";
import ForwardToDestination from "./ForwardToDestination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Post-authorization confirmation.
 *
 * The gateway sends the station here only after it has moved it into the
 * authenticated role, so reaching this page *is* the authorization receipt.
 * The session is stamped AUTHORIZED here, then the guest is forwarded to the
 * page they were originally trying to open.
 */
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  const jar = await cookies();
  const cookieSessionId = readSessionCookie(jar.get(SESSION_COOKIE)?.value);

  // The id in the URL is echoed back to us by the gateway, so it is never
  // trusted on its own — the signed cookie is what selects the session.
  const sessionId = cookieSessionId;

  let session = null;
  if (sessionId) {
    try {
      session = await prisma.guestSession.findUnique({ where: { id: sessionId } });
    } catch (err) {
      log.error("success_lookup_failed", { err });
    }
  }

  if (s && cookieSessionId && s !== cookieSessionId) {
    await audit(cookieSessionId, "SUCCESS_SESSION_MISMATCH", "warn", {
      claimed: s,
    });
  }

  if (session && session.status === "ACCEPTED") {
    try {
      session = await prisma.guestSession.update({
        where: { id: session.id },
        data: {
          status: "AUTHORIZED",
          authorizedAt: new Date(),
          authorizationResult: "GATEWAY_CONFIRMED",
          failureReason: null,
        },
      });
      await audit(session.id, "AUTHORIZATION_CONFIRMED", "info", {
        clientMac: session.clientMac,
        ssid: session.ssid,
        gatewayHost: session.gatewayHost,
      });

      // The gateway has confirmed the grant, so the standing ledger AURA
      // manages catches up here rather than at consent time — an approval URL
      // that was issued but never fetched is not an authorized guest.
      if (session.clientMac) {
        await recordAuthorizedGuest({
          macAddress: session.clientMac,
          ssid: session.ssid,
          wlan: session.wlan,
          gatewayHost: session.gatewayHost,
          apName: session.apName,
          apSerial: session.apSerial,
          sessionId: session.id,
        }).catch((err) => log.error("success_guest_record_failed", { err }));
      }
    } catch (err) {
      log.error("success_update_failed", { err });
    }
  }

  // The one place the two workflows diverge. The guest is online either way and
  // by exactly the same mechanism; a guest who asked for secure setup is handed
  // to it instead of being forwarded to the page they were originally opening.
  //
  // Deliberately after the AUTHORIZED stamp and the ledger write, so choosing
  // the secure path cannot cost a guest the record of their authorization.
  if (
    session &&
    session.onboardingRequested &&
    (session.status === "AUTHORIZED" || session.status === "ACCEPTED")
  ) {
    redirect("/portal/secure");
  }

  const destination = toAbsoluteDestination(session?.sanitizedDest);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8 text-center">
        <div className="mb-4 text-emerald-500" aria-hidden="true">
          <svg
            className="mx-auto h-16 w-16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">You&apos;re connected</h1>
        <p className="text-slate-500 text-sm mb-6">
          {destination
            ? "Taking you back to where you left off…"
            : "Your device now has network access."}
        </p>

        {session && (
          <dl className="text-left rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200 text-sm">
            <Row label="Network" value={session.ssid} />
            <Row
              label="Device"
              value={session.clientMac ? normalizeMac(session.clientMac) : null}
            />
            <Row
              label="Authorized"
              value={session.authorizedAt?.toISOString() ?? null}
            />
            <Row label="Session" value={session.id} mono />
          </dl>
        )}

        {destination && <ForwardToDestination url={destination} />}

        <p className="mt-6 text-xs text-slate-400">OS-ONE-CWP</p>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 px-4 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={`text-slate-900 text-right break-all ${
          mono ? "font-mono text-xs" : "font-medium"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
