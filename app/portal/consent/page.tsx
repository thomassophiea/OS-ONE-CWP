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
import {
  networkCapabilities,
  secureOnboardingConfigured,
} from "@/lib/onboarding/providers/skynet";
import { requestLocale } from "@/lib/i18n/server";
import { configuredGuestFields } from "@/lib/guestFields/registry";
import { describeFieldError, type FieldError } from "@/lib/guestFields/validate";
import type { Messages } from "@/lib/i18n";
import LanguagePicker from "@/app/LanguagePicker";
import ConsentForm, { type RenderedField } from "./ConsentForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The consent page.
 *
 * Everything a guest reads here is server-rendered in their language, including
 * the field labels, the validation messages from a previous attempt, and the
 * privacy copy. Nothing is translated in the browser, so the flow reads
 * correctly even in the captive-portal webviews that never hydrate.
 *
 * Re-populated values after a failed validation come from the *query string* of
 * the redirect, never from storage. A guest whose email was rejected as
 * malformed should not have to retype the whole form — but the value they typed
 * has not been stored anywhere to fetch it back from, and under a storage
 * prohibition it never will be.
 */
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  const sessionId = readSessionCookie(jar.get(SESSION_COOKIE)?.value);
  const csrfToken = jar.get(CSRF_COOKIE)?.value ?? "";
  const { locale, definition, messages } = await requestLocale();

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

  // The secure option is drawn only if a secure WLAN is actually configured and
  // readable. Any failure here removes the second button and leaves the open
  // guest path exactly as it was — this lookup must never be able to break the
  // page a guest needs in order to get online.
  let secureNetwork: { ssid: string; securityLabel: string } | null = null;
  if (secureOnboardingConfigured()) {
    try {
      const { network } = await networkCapabilities();
      const key = network.security as keyof Messages["security"];
      secureNetwork = {
        ssid: network.ssid,
        securityLabel: messages.security[key] ?? network.securityLabel,
      };
    } catch (err) {
      log.warn("consent_secure_network_unavailable", { err });
    }
  }

  // Field errors and values survive a failed submission through the redirect.
  // `invalid` is a comma-separated list of `<fieldId>:<messageKey>`.
  const invalid = typeof params.invalid === "string" ? params.invalid : "";
  const errorsByField = new Map<string, FieldError>();
  for (const pair of invalid.split(",").filter(Boolean)) {
    const [fieldId, messageKey] = pair.split(":");
    if (fieldId && messageKey) {
      errorsByField.set(fieldId, {
        fieldId,
        messageKey: messageKey as FieldError["messageKey"],
      });
    }
  }

  const fields: RenderedField[] = configuredGuestFields().map((field) => {
    const error = errorsByField.get(field.id) ?? null;
    const submitted = params[`v_${field.id}`];
    return {
      id: field.id,
      type: field.type,
      required: field.required,
      maxLength: field.maxLength,
      autoComplete: field.autoComplete,
      label: messages.fields[field.messageKey].label,
      placeholder: messages.fields[field.messageKey].placeholder,
      error: error ? describeFieldError(error, field, messages) : null,
      value: typeof submitted === "string" ? submitted.slice(0, field.maxLength) : "",
    };
  });

  return (
    <main
      className="min-h-screen bg-slate-50 flex items-center justify-center p-4"
      lang={locale}
      dir={definition.dir}
    >
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">
        <LanguagePicker current={locale} label={messages.common.languageLabel} />

        <header className="mb-6 mt-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900">{messages.consent.title}</h1>
          <p className="mt-2 text-sm text-slate-500">{messages.consent.subtitle}</p>
        </header>

        {/* Only what a guest can act on. The access point name, its serial and
            the site name are infrastructure identifiers that tell the guest
            nothing and tell a passer-by something — they stay in the session
            record and the admin view. */}
        <dl className="mb-6 rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200 text-sm">
          <Row label={messages.consent.networkLabel} value={session.ssid} />
          <Row
            label={messages.consent.deviceLabel}
            value={session.clientMac ? normalizeMac(session.clientMac) : null}
          />
        </dl>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 mb-6 text-sm text-slate-700 max-h-40 overflow-y-auto leading-relaxed">
          {messages.consent.terms}
        </div>

        {!session.sanitizedDest && session.destRejectionReason && (
          <p className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            {messages.consent.destinationLost}
          </p>
        )}

        <ConsentForm
          csrfToken={csrfToken}
          challenge={consentChallenge(session.id)}
          messages={{
            common: messages.common,
            consent: messages.consent,
            privacy: messages.privacy,
            fields: messages.fields,
            secureOffer: messages.secureOffer,
          }}
          secureNetwork={secureNetwork}
          fields={fields}
        />

        <p className="mt-6 text-center text-xs text-slate-400">{messages.common.portalName}</p>
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
