import { NextRequest, NextResponse } from "next/server";
import { isIP } from "net";
import { prisma } from "@/lib/prisma";
import { getSafeRedirectUrl } from "@/lib/captive/safeRedirect";
import { buildSignedEcpCallbackUrl } from "@/lib/captive/signEcpCallback";
import { callEcpCallback } from "@/lib/captive/callEcpCallback";

export async function POST(request: NextRequest) {
  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  const isForm = contentType.includes("application/x-www-form-urlencoded") ||
                 contentType.includes("multipart/form-data");

  let sessionId: string | undefined;

  if (isForm) {
    try {
      const data = await request.formData();
      sessionId = data.get("sessionId")?.toString();
    } catch {
      return NextResponse.redirect(`${appBaseUrl}/portal`, 303);
    }
  } else {
    try {
      const body = await request.json();
      sessionId = body.sessionId;
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
  }

  if (!sessionId) {
    if (isForm) return NextResponse.redirect(`${appBaseUrl}/portal`, 303);
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  let session;
  try {
    session = await prisma.guestSession.findUnique({ where: { id: sessionId } });
  } catch (err) {
    console.error("DB error looking up session:", err);
    if (isForm) return NextResponse.redirect(`${appBaseUrl}/portal`, 303);
    return NextResponse.json({ error: "Session lookup failed" }, { status: 500 });
  }

  if (!session) {
    if (isForm) return NextResponse.redirect(`${appBaseUrl}/portal`, 303);
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const internalFallback =
    process.env.DEFAULT_SUCCESS_URL ??
    `${appBaseUrl}/success?session=${sessionId}`;

  const allowedDomains = (process.env.ALLOWED_REDIRECT_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  const xccIdentity = process.env.XCC_IDENTITY;
  const xccSharedSecret = process.env.XCC_SHARED_SECRET;

  // Build ECP callback URL. For private IPs, XCC_ALLOW_INSECURE_CALLBACK=true
  // must be set to bypass TLS verification (local testing only).
  let xccCallbackUrl: string | null = null;

  if (
    session.hwcIp &&
    session.sessionToken &&
    session.wlan &&
    xccIdentity &&
    xccSharedSecret
  ) {
    const hwcHostLower = session.hwcIp.toLowerCase();
    // isPrivateLiteralIp requires net.isIP() > 0 first — prevents hostname strings
    // that look like private IPs (e.g. "192.168.1.evil.com") from bypassing the allowlist.
    const isPrivateLiteralIp =
      isIP(session.hwcIp) !== 0 &&
      (/^192\.168\./.test(hwcHostLower) ||
        /^10\./.test(hwcHostLower) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(hwcHostLower));
    const allowInsecure =
      process.env.XCC_ALLOW_INSECURE_CALLBACK === "true";
    const hostAllowed =
      (allowedDomains.length > 0 &&
        allowedDomains.some(
          (d) => hwcHostLower === d || hwcHostLower.endsWith(`.${d}`)
        )) ||
      (isPrivateLiteralIp && allowInsecure);
    const portValid = !session.hwcPort || /^\d{1,5}$/.test(session.hwcPort);

    if (hostAllowed && portValid) {
      xccCallbackUrl = buildSignedEcpCallbackUrl({
        hwcIp: session.hwcIp,
        hwcPort: session.hwcPort,
        token: session.sessionToken,
        wlan: session.wlan,
        clientMac: session.clientMac ?? "guest",
        dest: session.dest,
        identity: xccIdentity,
        sharedSecret: xccSharedSecret,
      });
    }
  }

  // Make ECP auth call server-side so the captive browser never needs to
  // visit ext_approval.php directly (avoids cert errors on self-signed certs
  // and XHR restrictions in captive portal mini-browsers).
  let ecpOk = false;
  if (!session.acceptedTerms && xccCallbackUrl) {
    const ecpResult = await callEcpCallback(xccCallbackUrl);
    ecpOk = ecpResult.ok;
    console.log("[ECP] callback", ecpOk ? "OK" : "FAILED", "status:", ecpResult.status);
  }

  // After ECP auth, redirect browser to original destination or success page.
  // We do NOT send the browser to ext_approval.php — auth is already done above.
  const destUrl = session.redirectUrl ?? session.successUrl ?? null;
  const safeUrl = getSafeRedirectUrl(destUrl, internalFallback);

  const wasBlocked =
    destUrl !== null &&
    safeUrl === internalFallback &&
    destUrl !== internalFallback;

  // For already-accepted sessions, redirect idempotently.
  if (!session.acceptedTerms) {
    try {
      await prisma.guestSession.update({
        where: { id: sessionId },
        data: {
          acceptedTerms: true,
          acceptedAt: new Date(),
          status: wasBlocked ? "BLOCKED_REDIRECT" : "ACCEPTED",
        },
      });

      await prisma.auditEvent.create({
        data: {
          sessionId,
          action: wasBlocked ? "TERMS_ACCEPTED_REDIRECT_BLOCKED" : "TERMS_ACCEPTED",
          details: {
            xccCallbackUrl,
            ecpOk,
            destUrl,
            safeUrl,
            wasBlocked,
          },
        },
      });
    } catch (err) {
      console.error("DB error updating session:", err);
      if (isForm) return NextResponse.redirect(`${appBaseUrl}/portal`, 303);
      return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
    }
  }

  if (isForm) return NextResponse.redirect(safeUrl, 303);
  return NextResponse.json({ redirectUrl: safeUrl });
}
