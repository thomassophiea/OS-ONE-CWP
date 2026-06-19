import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSafeRedirectUrl } from "@/lib/captive/safeRedirect";
import { buildSignedEcpCallbackUrl } from "@/lib/captive/signEcpCallback";

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

  // Build XCC ECP callback URL signed with AWS SigV4.
  // hwcIp comes from user-controlled query params stored at session creation;
  // validated against ALLOWED_REDIRECT_DOMAINS before use.
  const allowedDomains = (process.env.ALLOWED_REDIRECT_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  const xccIdentity = process.env.XCC_IDENTITY;
  const xccSharedSecret = process.env.XCC_SHARED_SECRET;

  let xccCallbackUrl: string | null = null;

  if (
    session.hwcIp &&
    session.sessionToken &&
    session.wlan &&
    xccIdentity &&
    xccSharedSecret &&
    allowedDomains.length > 0
  ) {
    const hwcHostLower = session.hwcIp.toLowerCase();
    const hostAllowed = allowedDomains.some(
      (d) => hwcHostLower === d || hwcHostLower.endsWith(`.${d}`)
    );
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

  // Prefer XCC ECP callback, then XCC-supplied redirect_url, then success page.
  const candidateUrl =
    xccCallbackUrl ?? session.redirectUrl ?? session.successUrl ?? null;

  const safeUrl = getSafeRedirectUrl(candidateUrl, internalFallback);
  const wasBlocked =
    candidateUrl !== null &&
    safeUrl === internalFallback &&
    candidateUrl !== internalFallback;

  // For already-accepted sessions, send them to the same destination (idempotent).
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
          details: { candidateUrl, safeUrl, wasBlocked },
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
