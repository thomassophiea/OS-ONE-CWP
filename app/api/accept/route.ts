import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import {
  appBaseUrl,
  allowedHosts,
  approvalUrlTtlSeconds,
  xccIdentity,
  xccSharedSecret,
  ConfigurationError,
} from "@/lib/env";
import { buildEcpApprovalUrl } from "@/lib/captive/ecpSigV4";
import {
  gatewayHostAllowlist,
  isAllowedGatewayHost,
  isConnectivityProbe,
  looksLikeCaptiveAssistant,
} from "@/lib/captive/safeRedirect";
import { hostIsAllowed, getRequestMetadata } from "@/lib/request/getRequestMetadata";
import {
  SESSION_COOKIE,
  CSRF_COOKIE,
  readSessionCookie,
  csrfTokenMatches,
  consentChallengeMatches,
} from "@/lib/session/cookie";
import { audit, isExpired } from "@/lib/session/repository";
import { configuredGuestFields } from "@/lib/guestFields/registry";
import { validateGuestFields } from "@/lib/guestFields/validate";
import { auditablePolicy, policyFromConsent } from "@/lib/privacy/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Floor on how quickly consent can plausibly be given after the page renders.
 * An auto-submitting agent fires far below this; a guest ticking a box does not.
 */
const MIN_CONSENT_DWELL_MS = 400;

/**
 * Consent handler. Its sole job is to turn an accepted session into the
 * presigned `/ext_approval.php` URL that the *browser* must fetch.
 *
 * The callback cannot be made server-side: the ECP handler lives on the access
 * point serving the station (reachable only from the wireless client's link),
 * while this application runs on Railway. Handing the browser a signed URL is
 * the protocol's intended shape, not a workaround.
 */
export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let base: string;
  try {
    base = appBaseUrl();
  } catch {
    base = new URL(request.url).origin;
  }

  if (!hostIsAllowed(request.headers.get("host"), allowedHosts())) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Cross-origin form posts are refused outright; the consent form is served
  // from this origin.
  const origin = request.headers.get("origin");
  if (origin && origin !== base) {
    await audit(null, "ACCEPT_CROSS_ORIGIN", "warn", { origin });
    return fail(base, "csrf");
  }

  const jar = request.cookies;
  const sessionId = readSessionCookie(jar.get(SESSION_COOKIE)?.value);
  if (!sessionId) {
    await audit(null, "ACCEPT_NO_SESSION", "warn", {});
    return fail(base, "no_session");
  }

  let submittedCsrf: string | null = null;
  let agreed = false;
  let interaction: string | null = null;
  let dwellMs = 0;
  // Which of the two workflows the guest chose. Anything other than an explicit
  // "secure" is the open path, so a missing, unknown or forged value degrades to
  // the behaviour that existed before this field did.
  let secureRequested = false;
  // The storage prohibition, as submitted. Read here and decided here — the
  // browser can hide inputs or omit this field entirely, so what the *server*
  // records is what every later component reads.
  let doNotStore = false;
  const rawFields: Record<string, string | undefined> = {};
  try {
    const form = await request.formData();
    submittedCsrf = form.get("csrfToken")?.toString() ?? null;
    agreed = form.get("agree")?.toString() === "yes";
    interaction = form.get("interaction")?.toString() ?? null;
    dwellMs = Number(form.get("dwellMs")?.toString() ?? "0");
    secureRequested = form.get("mode")?.toString() === "secure";
    doNotStore = form.get("doNotStorePersonalData")?.toString() === "yes";
    // Only the configured fields are read off the form. An extra input a client
    // invents is never looked at, so it cannot become a stored value.
    for (const field of configuredGuestFields()) {
      rawFields[field.id] = form.get(field.id)?.toString();
    }
  } catch {
    return fail(base, "bad_request");
  }

  const policy = policyFromConsent(doNotStore);

  let session;
  try {
    session = await prisma.guestSession.findUnique({ where: { id: sessionId } });
  } catch (err) {
    log.error("accept_lookup_failed", { err });
    return fail(base, "unavailable");
  }
  if (!session) {
    await audit(null, "ACCEPT_SESSION_NOT_FOUND", "warn", { sessionId });
    return fail(base, "no_session");
  }

  // A resubmission of a session that already completed — double-click, or the
  // browser re-posting on back-navigation. The signed session cookie already
  // proves ownership, and the CSRF token was burnt on first use, so check this
  // before treating the missing token as an attack.
  if (session.status === "ACCEPTED" || session.status === "AUTHORIZED") {
    await audit(session.id, "ACCEPT_DUPLICATE", "info", {
      status: session.status,
    });
    return NextResponse.redirect(new URL("/success", base), 303);
  }

  // The token must match both the server-side hash and the HttpOnly cookie,
  // so neither a stolen form field nor a stolen cookie alone is sufficient.
  const cookieCsrf = jar.get(CSRF_COOKIE)?.value ?? null;
  if (
    !csrfTokenMatches(submittedCsrf, session.csrfTokenHash) ||
    !cookieCsrf ||
    cookieCsrf !== submittedCsrf
  ) {
    await audit(session.id, "ACCEPT_CSRF_REJECTED", "warn", {
      clientMac: session.clientMac,
    });
    return fail(base, "csrf");
  }

  // Whether an operating-system captive assistant is driving this, rather than a
  // person. It is *not* refused — the one-tap flow inside the assistant window
  // is the experience we want — but it is recorded, because it is the difference
  // between a guest accepting the terms and their laptop accepting for them.
  const viaOsAssistant =
    isConnectivityProbe(session.originalDest) ||
    looksLikeCaptiveAssistant(request.headers.get("user-agent"));

  // Consent must still be deliberate for anything that is not a real browser
  // driving the page: a bare form POST cannot satisfy these.
  if (!agreed) {
    await audit(session.id, "ACCEPT_NOT_AGREED", "warn", {
      clientMac: session.clientMac,
      userAgent: request.headers.get("user-agent"),
    });
    return fail(base, "consent");
  }
  if (!consentChallengeMatches(interaction, session.id)) {
    await audit(session.id, "ACCEPT_NO_INTERACTION", "warn", {
      clientMac: session.clientMac,
      userAgent: request.headers.get("user-agent"),
    });
    return fail(base, "consent");
  }
  if (!Number.isFinite(dwellMs) || dwellMs < MIN_CONSENT_DWELL_MS) {
    await audit(session.id, "ACCEPT_TOO_FAST", "warn", {
      clientMac: session.clientMac,
      dwellMs,
      userAgent: request.headers.get("user-agent"),
    });
    return fail(base, "consent");
  }

  // Validation runs server-side against the registry. A guest who typed a
  // malformed email is sent back with the message in their own language and
  // their other answers intact — carried in the redirect, never in storage.
  const configured = configuredGuestFields();
  const validation = validateGuestFields(configured, rawFields);
  if (validation.errors.length > 0) {
    await audit(session.id, "ACCEPT_FIELDS_INVALID", "warn", {
      clientMac: session.clientMac,
      // Which fields failed and why — never what was in them.
      invalidFields: validation.errors.map((e) => `${e.fieldId}:${e.messageKey}`),
      ...auditablePolicy(policy),
    });
    return failValidation(base, validation.errors, validation.values, policy.personalDataAllowed);
  }

  if (isExpired(session)) {
    await prisma.guestSession
      .update({ where: { id: session.id }, data: { status: "EXPIRED" } })
      .catch(() => undefined);
    await audit(session.id, "ACCEPT_SESSION_EXPIRED", "warn", {
      clientMac: session.clientMac,
    });
    return fail(base, "expired");
  }

  if (
    !session.gatewayHost ||
    !session.gatewayToken ||
    !session.wlan ||
    !session.clientMacRaw
  ) {
    await audit(session.id, "ACCEPT_SESSION_INCOMPLETE", "error", {
      hasHost: Boolean(session.gatewayHost),
      hasToken: Boolean(session.gatewayToken),
      hasWlan: Boolean(session.wlan),
      hasMac: Boolean(session.clientMacRaw),
    });
    return fail(base, "authorization_failed");
  }

  // Re-check the allowlist at signing time: the stored value could only have
  // come from a verified redirect, but configuration may have changed since.
  if (!isAllowedGatewayHost(session.gatewayHost, gatewayHostAllowlist())) {
    await audit(session.id, "ACCEPT_GATEWAY_HOST_NOT_ALLOWED", "warn", {
      gatewayHost: session.gatewayHost,
    });
    return fail(base, "unsupported_gateway");
  }

  let identity: string;
  let secret: string;
  try {
    identity = xccIdentity();
    secret = xccSharedSecret();
  } catch (err) {
    if (err instanceof ConfigurationError) {
      log.error("accept_misconfigured", { variable: err.variable });
      return fail(base, "unavailable");
    }
    throw err;
  }

  // Hand the gateway our own confirmation page as the post-approval
  // destination, rather than the guest's original URL. The gateway only emits
  // this redirect when it has actually authorized the station, so the browser
  // arriving at /success is our evidence that the authorization succeeded — a
  // refusal leaves the browser on the gateway's own error page instead. The
  // guest's real destination is forwarded from there.
  const confirmUrl = new URL("/success", base);
  confirmUrl.searchParams.set("s", session.id);

  const approvalUrl = buildEcpApprovalUrl({
    gatewayHost: session.gatewayHost,
    gatewayPort: session.gatewayPort ?? "443",
    token: session.gatewayToken,
    username: session.clientMacRaw,
    wlan: session.wlan,
    dest: confirmUrl.toString(),
    identity,
    sharedSecret: secret,
    expiresSeconds: approvalUrlTtlSeconds(),
  });

  const meta = getRequestMetadata(request.headers);
  const now = new Date();

  try {
    await prisma.guestSession.update({
      where: { id: session.id },
      data: {
        status: "ACCEPTED",
        acceptedTerms: true,
        acceptedAt: now,
        // The prohibition, recorded once and read by everything downstream.
        personalDataAllowed: policy.personalDataAllowed,
        privacyChoiceAt: now,
        // The enforcement itself: when persistence is refused, the column is
        // set to null rather than written and cleaned up later. The values the
        // guest typed exist only in this request's memory and are discarded
        // with it — they are never in Postgres, a WAL segment, or a replica.
        guestFields:
          policy.personalDataAllowed && Object.keys(validation.values).length > 0
            ? validation.values
            : Prisma.DbNull,
        // Recorded here, acted on at /success. The authorization itself — the
        // signed approval URL above, the gateway callback, the role change —
        // is identical either way, which is what keeps the secure option from
        // being able to regress getting online.
        onboardingRequested: secureRequested,
        authorizationAttemptedAt: now,
        authorizationResult: "APPROVAL_URL_ISSUED",
        // Burn the CSRF token so the form cannot be replayed.
        csrfTokenHash: null,
        sourceIp: meta.sourceIp ?? session.sourceIp,
      },
    });
  } catch (err) {
    log.error("accept_update_failed", { err });
    return fail(base, "unavailable");
  }

  await audit(session.id, "AUTHORIZATION_ISSUED", "info", {
    clientMac: session.clientMac,
    gatewayHost: session.gatewayHost,
    gatewayPort: session.gatewayPort,
    wlan: session.wlan,
    // The URL carries a signature; record only its non-secret shape.
    approvalScheme: session.gatewayPort === "80" ? "http" : "https",
    destForwarded: Boolean(session.sanitizedDest),
    workflow: secureRequested ? "secure" : "open",
    ...auditablePolicy(policy),
    // How many values were kept, never which or what. Zero under a prohibition
    // is the assertion that matters, and it is checkable from the audit trail.
    guestFieldsStored: policy.personalDataAllowed ? Object.keys(validation.values).length : 0,
    viaOsAssistant,
    durationMs: Date.now() - startedAt,
  });

  const response = NextResponse.redirect(approvalUrl, 303);
  response.cookies.delete(CSRF_COOKIE);
  return response;
}

function fail(base: string, code: string) {
  const url = new URL("/portal/error", base);
  url.searchParams.set("code", code);
  return NextResponse.redirect(url, 303);
}

/**
 * Send the guest back to the form with their answers and the reasons.
 *
 * Values ride in the query string of a redirect the guest's own browser
 * follows — they are not written anywhere, which is what lets this work
 * identically under a storage prohibition.
 *
 * Under a prohibition they are omitted entirely: a URL ends up in history and
 * in the address bar, and "do not store my personal data" is a poor fit with
 * putting it there. The cost is retyping; the alternative is honouring the
 * prohibition everywhere except the one place a guest can see.
 */
function failValidation(
  base: string,
  errors: { fieldId: string; messageKey: string }[],
  values: Record<string, string>,
  mayEcho: boolean
) {
  const url = new URL("/portal/consent", base);
  url.searchParams.set("invalid", errors.map((e) => `${e.fieldId}:${e.messageKey}`).join(","));
  if (mayEcho) {
    for (const [id, value] of Object.entries(values)) url.searchParams.set(`v_${id}`, value);
  }
  return NextResponse.redirect(url, 303);
}
