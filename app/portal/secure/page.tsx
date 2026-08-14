import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { SESSION_COOKIE, readSessionCookie } from "@/lib/session/cookie";
import { isExpired } from "@/lib/session/repository";
import { toAbsoluteDestination } from "@/lib/captive/safeRedirect";
import { appBaseUrl } from "@/lib/env";
import {
  networkCapabilities,
  secureOnboardingConfigured,
} from "@/lib/onboarding/providers/skynet";
import SecureSetup from "./SecureSetup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Secure Wi-Fi setup.
 *
 * Reached only from `/success`, and only for a guest who chose the secure
 * workflow — which means the gateway has already authorized this station and
 * the device has real internet access. That ordering is what makes everything
 * on this page possible: a profile can be downloaded, Settings can be opened,
 * and the guest can come back.
 *
 * Nothing here is a prerequisite for anything. A guest who closes this page is
 * online, and the page says so before it says anything else.
 */
export default async function SecurePage() {
  const jar = await cookies();
  const sessionId = readSessionCookie(jar.get(SESSION_COOKIE)?.value);
  if (!sessionId) redirect("/portal/error?code=no_session");

  let session;
  try {
    session = await prisma.guestSession.findUnique({ where: { id: sessionId } });
  } catch (err) {
    log.error("secure_lookup_failed", { err });
    redirect("/portal/error?code=unavailable");
  }
  if (!session) redirect("/portal/error?code=no_session");
  if (isExpired(session)) redirect("/portal/error?code=expired");

  // Secure setup is a post-authorization activity. A session that has not been
  // approved by the gateway is sent back to finish the thing that matters.
  if (session.status !== "AUTHORIZED" && session.status !== "ACCEPTED") {
    redirect("/portal/consent");
  }

  if (!secureOnboardingConfigured()) redirect("/success");

  let network;
  try {
    network = (await networkCapabilities()).network;
  } catch (err) {
    log.warn("secure_network_unavailable", { err });
    network = null;
  }

  const destination = toAbsoluteDestination(session.sanitizedDest);
  let safariUrl: string | null = null;
  try {
    // `x-safari-https://` is the scheme iOS uses to hand a URL from an embedded
    // webview to full Safari. It is what gets a guest out of the Captive
    // Network Assistant, which cannot install a configuration profile.
    safariUrl = `x-safari-${appBaseUrl()}/portal/secure`;
  } catch {
    safariUrl = null;
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-start justify-center p-4 py-8">
      <div className="w-full max-w-md space-y-4">
        {/* Said first and said plainly: the guest is already online. Secure
            setup is optional and everything below it can be abandoned. */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <span className="text-emerald-600 mt-0.5" aria-hidden="true">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-900">You&apos;re connected</p>
            <p className="text-xs text-emerald-800 mt-0.5">
              {session.ssid
                ? `You have internet access on ${session.ssid}.`
                : "You have internet access on the guest network."}
            </p>
          </div>
        </div>

        {network ? (
          <SecureSetup
            ssid={network.ssid}
            securityLabel={network.securityLabel}
            destination={destination}
            safariUrl={safariUrl}
          />
        ) : (
          <div className="rounded-2xl bg-white shadow-md p-8 text-center">
            <h1 className="text-lg font-bold text-slate-900">
              Secure Wi-Fi setup is unavailable
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              We couldn&apos;t reach the secure network&apos;s configuration. Your
              guest access is unaffected.
            </p>
            {destination && (
              <a
                className="mt-6 inline-block text-sm text-blue-600 underline break-all"
                href={destination}
              >
                Continue to the internet
              </a>
            )}
          </div>
        )}

        <p className="text-center text-xs text-slate-400">OS-ONE-CWP</p>
      </div>
    </main>
  );
}
