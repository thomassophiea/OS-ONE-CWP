import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import {
  appBaseUrl,
  appHost,
  allowedHosts,
  ecpPath,
  sessionTtlSeconds,
  signatureSkewSeconds,
  xccIdentity,
  xccSharedSecret,
  ConfigurationError,
} from "@/lib/env";
import { verifyEcpRedirect } from "@/lib/captive/ecpSigV4";
import {
  extractSessionFields,
  validateSessionFields,
  normalizeMac,
} from "@/lib/captive/extractSessionFields";
import {
  gatewayHostAllowlist,
  isAllowedGatewayHost,
  sanitizeOriginalDestination,
} from "@/lib/captive/safeRedirect";
import { getRequestMetadata, hostIsAllowed } from "@/lib/request/getRequestMetadata";
import {
  SESSION_COOKIE,
  CSRF_COOKIE,
  signSessionCookie,
  sessionCookieOptions,
  newCsrfToken,
} from "@/lib/session/cookie";
import { audit, isUniqueViolation } from "@/lib/session/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The ECP entry point. This is the URL configured as "ECP URL" on the
 * gateway's pre-authentication role, and it is a route handler rather than a
 * page so that the *raw* query string is available: the controller signs the
 * query string byte-for-byte as it emits it, and Next's decoded `searchParams`
 * cannot be used to reconstruct it faithfully.
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  let base: string;
  let identity: string;
  let secret: string;
  try {
    base = appBaseUrl();
    identity = xccIdentity();
    secret = xccSharedSecret();
  } catch (err) {
    if (err instanceof ConfigurationError) {
      log.error("portal_misconfigured", { variable: err.variable });
      return errorRedirect(
        process.env.APP_BASE_URL ?? new URL(request.url).origin,
        "unavailable"
      );
    }
    throw err;
  }

  const meta = getRequestMetadata(request.headers);

  if (!hostIsAllowed(request.headers.get("host"), allowedHosts())) {
    log.warn("portal_host_rejected", { host: request.headers.get("host") });
    return new NextResponse("Not found", { status: 404 });
  }

  // --- 1. verify the gateway signed this redirect -------------------------
  const verdict = verifyEcpRedirect({
    rawUrl: request.url,
    expectedHost: appHost(),
    expectedPath: ecpPath(),
    identity,
    sharedSecret: secret,
    maxSkewSeconds: signatureSkewSeconds(),
  });

  const params = new URL(request.url).searchParams;
  const fields = extractSessionFields(params);

  if (!verdict.valid) {
    await audit(null, "REDIRECT_REJECTED", "warn", {
      reason: verdict.reason,
      clientMac: fields.clientMac,
      ssid: fields.ssid,
      sourceIp: meta.sourceIp,
      durationMs: Date.now() - startedAt,
    });
    return errorRedirect(base, reasonToCode(verdict.reason));
  }

  // --- 2. structural validation of the gateway parameters -----------------
  const fieldErrors = validateSessionFields(fields);
  if (fieldErrors.length > 0) {
    await audit(null, "REDIRECT_PARAMS_INVALID", "warn", {
      errors: fieldErrors,
      clientMac: fields.clientMac,
      sourceIp: meta.sourceIp,
    });
    return errorRedirect(base, "bad_request");
  }

  // --- 3. the callback host must be one we are willing to sign for --------
  const allowlist = gatewayHostAllowlist();
  if (!isAllowedGatewayHost(fields.gatewayHost, allowlist)) {
    await audit(null, "GATEWAY_HOST_NOT_ALLOWED", "warn", {
      gatewayHost: fields.gatewayHost,
      clientMac: fields.clientMac,
    });
    return errorRedirect(base, "unsupported_gateway");
  }

  // --- 4. original destination -------------------------------------------
  const destVerdict = sanitizeOriginalDestination(fields.originalDest, "");
  const csrf = newCsrfToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionTtlSeconds() * 1000);

  const data: Prisma.GuestSessionCreateInput = {
    status: destVerdict.safe || !fields.originalDest ? "STARTED" : "BLOCKED_REDIRECT",
    clientMac: fields.clientMac ? normalizeMac(fields.clientMac) : null,
    clientMacRaw: fields.clientMac,
    clientIp: null,
    sourceIp: meta.sourceIp,
    userAgent: meta.userAgent,
    gatewayHost: fields.gatewayHost,
    gatewayPort: fields.gatewayPort ?? "443",
    gatewayToken: fields.gatewayToken,
    apMac: fields.apMac,
    bssid: fields.bssid,
    apName: fields.apName,
    apSerial: fields.apSerial,
    apLocation: fields.apLocation,
    ssid: fields.ssid,
    vns: fields.vns,
    wlan: fields.wlan,
    vlan: fields.vlan,
    preAuthRole: fields.role,
    redirectSignature: verdict.signature ?? null,
    redirectSignedAt: verdict.signedAt ?? null,
    redirectExpiresAt: verdict.expiresAt ?? null,
    gatewayParams: Object.fromEntries(params) as unknown as Prisma.InputJsonObject,
    requestHeaders: meta.headers as unknown as Prisma.InputJsonObject,
    originalDest: fields.originalDest,
    sanitizedDest: destVerdict.safe ? destVerdict.value : null,
    destRejectionReason: destVerdict.safe ? null : destVerdict.reason,
    csrfTokenHash: csrf.hash,
    expiresAt,
  };

  let sessionId: string;
  try {
    const created = await prisma.guestSession.create({ data });
    sessionId = created.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      // The same signed redirect arrived twice — a browser reload or a captive
      // portal assistant retry. Reuse the original session rather than minting
      // a second one, and never let a replay re-open a completed session.
      const existing = await prisma.guestSession.findUnique({
        where: { redirectSignature: verdict.signature ?? "" },
      });
      if (!existing) {
        log.error("portal_session_create_failed", { err });
        return errorRedirect(base, "unavailable");
      }
      if (existing.status === "AUTHORIZED" || existing.status === "ACCEPTED") {
        await audit(existing.id, "REDIRECT_REPLAYED", "warn", {
          status: existing.status,
          clientMac: existing.clientMac,
        });
        return withSessionCookie(
          NextResponse.redirect(new URL("/success", base), 303),
          existing.id
        );
      }
      await audit(existing.id, "REDIRECT_REPEATED", "info", {
        clientMac: existing.clientMac,
      });
      return withSessionCookie(
        NextResponse.redirect(new URL("/portal/consent", base), 303),
        existing.id
      );
    }
    log.error("portal_session_create_failed", { err });
    return errorRedirect(base, "unavailable");
  }

  await audit(sessionId, "REDIRECT_VERIFIED", "info", {
    clientMac: data.clientMac,
    ssid: fields.ssid,
    wlan: fields.wlan,
    apSerial: fields.apSerial,
    gatewayHost: fields.gatewayHost,
    gatewayPort: fields.gatewayPort,
    destAccepted: destVerdict.safe,
    destRejectionReason: destVerdict.safe ? null : destVerdict.reason,
    sourceIp: meta.sourceIp,
    durationMs: Date.now() - startedAt,
  });

  // Redirect to the consent page rather than rendering here: the session id is
  // minted fresh on every verified redirect and handed over in a signed cookie,
  // so a pre-set cookie cannot fixate a session, and the long signed URL is
  // dropped from the address bar.
  const response = NextResponse.redirect(new URL("/portal/consent", base), 303);
  // The raw CSRF token travels in an HttpOnly cookie; only its SHA-256 is
  // stored. The consent page reads the cookie server-side and emits it as a
  // hidden field, so the POST must present both halves.
  response.cookies.set(
    CSRF_COOKIE,
    csrf.token,
    sessionCookieOptions(sessionTtlSeconds())
  );
  return withSessionCookie(response, sessionId);
}

function withSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(
    SESSION_COOKIE,
    signSessionCookie(sessionId),
    sessionCookieOptions(sessionTtlSeconds())
  );
  return response;
}

function reasonToCode(reason: string | undefined): string {
  switch (reason) {
    case "EXPIRED":
    case "NOT_YET_VALID":
      return "expired";
    case "SIGNATURE_MISMATCH":
    case "IDENTITY_MISMATCH":
    case "BAD_CREDENTIAL_SCOPE":
      return "untrusted";
    default:
      return "bad_request";
  }
}

function errorRedirect(base: string, code: string) {
  const url = new URL("/portal/error", base);
  url.searchParams.set("code", code);
  return NextResponse.redirect(url, 303);
}
