import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSafeRedirectUrl } from "@/lib/captive/safeRedirect";

export async function POST(request: NextRequest) {
  let sessionId: string | undefined;

  try {
    const body = await request.json();
    sessionId = body.sessionId;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

  let session;
  try {
    session = await prisma.guestSession.findUnique({
      where: { id: sessionId },
    });
  } catch (err) {
    console.error("DB error looking up session:", err);
    return NextResponse.json(
      { error: "Session lookup failed" },
      { status: 500 }
    );
  }

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.acceptedTerms) {
    return NextResponse.json(
      { error: "Session already accepted" },
      { status: 409 }
    );
  }

  const appBaseUrl = process.env.APP_BASE_URL ?? "";
  const internalFallback =
    process.env.DEFAULT_SUCCESS_URL ??
    `${appBaseUrl}/success?session=${sessionId}`;

  // XCC ECP authorization: redirect client browser to the controller callback URL.
  // Controller validates the token, authorizes the MAC, and grants internet access.
  let xccCallbackUrl: string | null = null;
  if (session.hwcIp && session.sessionToken) {
    const port =
      session.hwcPort && session.hwcPort !== "443"
        ? `:${session.hwcPort}`
        : "";
    xccCallbackUrl = `https://${session.hwcIp}${port}/ecp/redirect?token=${encodeURIComponent(session.sessionToken)}`;
  }

  const candidateUrl =
    xccCallbackUrl ??
    session.redirectUrl ??
    session.successUrl ??
    null;

  // XCC callback URLs are server-constructed from trusted stored fields — skip safe redirect check.
  const safeUrl = xccCallbackUrl ?? getSafeRedirectUrl(candidateUrl, internalFallback);
  const wasBlocked =
    !xccCallbackUrl &&
    candidateUrl !== null &&
    safeUrl === internalFallback &&
    candidateUrl !== internalFallback;

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
          candidateUrl,
          safeUrl,
          wasBlocked,
        },
      },
    });
  } catch (err) {
    console.error("DB error updating session:", err);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ redirectUrl: safeUrl });
}
