import type { Metadata } from "next";
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
import { networkCapabilities } from "@/lib/onboarding/providers/skynet";
import { requestLocale } from "@/lib/i18n/server";
import { describeFieldError, type FieldError } from "@/lib/guestFields/validate";
import {
  effectiveAccessPolicy,
  effectiveBranding,
  effectiveGuestFields,
  effectiveLegal,
  effectiveSecureAccess,
  effectiveSponsorship,
} from "@/lib/config/portal";
import { fieldsForConsentRender } from "@/lib/sponsorship/fields";
import { latestSponsorshipForSession } from "@/lib/sponsorship/service";
import { format, type Messages } from "@/lib/i18n";
import LanguagePicker from "@/app/LanguagePicker";
import PortalLogo from "@/app/PortalLogo";
import { portalBackgroundStyle } from "@/app/portalBackground";
import SessionExpiryWarning from "@/app/portal/SessionExpiryWarning";
import ConsentForm, { type RenderedField } from "./ConsentForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await requestLocale();
  return { title: messages.consent.title };
}

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
  const { locale, definition, messages, offered } = await requestLocale();

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

  // A session that already asked for sponsorship belongs on the waiting page,
  // whatever the request's state — that page renders denied and expired too.
  // Failure here degrades to showing the form, which is the pre-sponsorship
  // behaviour and always safe.
  if (session.csrfTokenHash === null) {
    const sponsorship = await latestSponsorshipForSession(session.id).catch(() => null);
    if (sponsorship) redirect("/portal/pending");
  }

  const sponsorCfg = await effectiveSponsorship();
  const [branding, legal] = await Promise.all([effectiveBranding(), effectiveLegal()]);

  // The acceptance policy decides what the page draws. 'sponsored' with no
  // working sponsorship path would strand every guest, so it degrades to
  // terms acceptance — a guest is never left with no way on.
  let accessPolicy = await effectiveAccessPolicy();
  if (accessPolicy === "sponsored" && !sponsorCfg.enabled) accessPolicy = "terms";

  // The secure option is drawn only if a secure WLAN is actually configured,
  // readable, and not switched off by the operator. Any failure here removes
  // the second button and leaves the open guest path exactly as it was — this
  // lookup must never be able to break the page a guest needs to get online.
  // Suppressed under the sponsored policy: mode=secure self-authorizes, which
  // would sidestep the sponsor's approval.
  let secureNetwork: { ssid: string; securityLabel: string } | null = null;
  if (accessPolicy !== "sponsored" && (await effectiveSecureAccess()).enabled) {
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

  // Employee sponsorship is drawn only when configured (allowed domains plus a
  // working email transport, and not switched off by the operator). Absent,
  // the form is byte-identical to before.
  const sponsorshipOffered = sponsorCfg.enabled;
  const sponsorDomain = sponsorshipOffered ? (sponsorCfg.domains[0] ?? null) : null;
  const sponsorError = errorsByField.get("sponsorEmail") ?? null;
  const sponsorErrorText = (key: string): string => {
    if (key === "domain" && sponsorDomain) {
      return format(messages.sponsorship.validationDomain, { domain: sponsorDomain });
    }
    if (key === "notAllowed") return messages.sponsorship.validationNotAllowed;
    return messages.sponsorship.validationFormat;
  };
  const sponsorship =
    sponsorshipOffered && sponsorDomain
      ? {
          domain: sponsorDomain,
          error: sponsorError ? sponsorErrorText(sponsorError.messageKey as string) : null,
          value:
            typeof params.v_sponsorEmail === "string"
              ? params.v_sponsorEmail.slice(0, 254)
              : "",
        }
      : null;

  // Guest fields are drawn only under the 'form' policy; 'terms' is one tick
  // and a button whatever fields are configured. The sponsor path's identity
  // fields still arrive through fieldsForConsentRender's widening.
  const fields: RenderedField[] = fieldsForConsentRender(
    accessPolicy === "form" ? await effectiveGuestFields() : [],
    sponsorshipOffered
  ).map((field) => {
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
      style={portalBackgroundStyle(branding)}
      lang={locale}
      dir={definition.dir}
    >
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">
        <LanguagePicker current={locale} label={messages.common.languageLabel} locales={offered} />

        <PortalLogo branding={branding} alt={`${messages.common.portalName} logo`} />

        {session.expiresAt && (
          <SessionExpiryWarning
            expiresAt={session.expiresAt.toISOString()}
            messages={messages.sessionTiming}
          />
        )}

        <header className="mb-6 mt-4" style={{ textAlign: branding.alignment }}>
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

        {/* The operator may paste their own terms; the override is
            single-language by nature and renders as plain text. */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 mb-6 text-sm text-slate-700 max-h-40 overflow-y-auto leading-relaxed whitespace-pre-line">
          {legal.termsText ?? messages.consent.terms}
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
            sponsorship: messages.sponsorship,
          }}
          secureNetwork={secureNetwork}
          sponsorship={sponsorship}
          fields={fields}
          openPath={accessPolicy !== "sponsored"}
          brandColor={branding.color}
          privacyPolicy={legal.privacyPolicy.enabled ? { text: legal.privacyPolicy.text } : null}
          marketing={legal.marketing.enabled ? { text: legal.marketing.text } : null}
        />

        {/* Footer: null keeps the pre-existing portal-name line; true is the
            branded line; false removes the footer entirely. */}
        {branding.footer === null && (
          <p className="mt-6 text-center text-xs text-slate-600">{messages.common.portalName}</p>
        )}
        {branding.footer === true && (
          <p className="mt-6 text-center text-xs" style={{ color: branding.color }}>
            Powered by Extreme Platform ONE
          </p>
        )}
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
