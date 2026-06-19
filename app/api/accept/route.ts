import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSafeRedirectUrl } from "@/lib/captive/safeRedirect";
import { buildSignedEcpCallbackUrl } from "@/lib/captive/signEcpCallback";

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
  // Note: token appears in the query string because that is the XCC ECP protocol requirement.
  //
  // hwcIp comes from user-controlled query params stored at session creation time.
  // We validate it against ALLOWED_REDIRECT_DOMAINS before constructing the URL.
  // If ALLOWED_REDIRECT_DOMAINS is blank or doesn't include hwcIp, we do not redirect there.
  const allowedDomains = (process.env.ALLOWED_REDIRECT_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  // Build XCC ECP callback URL signed with AWS SigV4 (shared secret from XCC config).
  // Path /ext_approval.php with mandatory params: token, wlan, username.
  // Requires XCC_IDENTITY and XCC_SHARED_SECRET env vars to match XCC portal config.
  const xccIdentity = process.env.XCC_IDENTITY;
  const xccSharedSecret = process.env.XCC_SHARED_SECRET;

  let xccCallbackUrl: string | null = null;
  type EcpProbe = {
    status: number;
    location: string | null;
    body: string;
    error?: string;
  };
  let ecpProbe: EcpProbe | null = null;
  let ecpAuthorized = false;

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

      // Call the XCC ECP endpoint server-side so we can see the response and log it.
      // A 3xx response means the controller accepted the request and authorized the MAC;
      // the client can then be sent to the success page instead of to apcp.ezcloudx.com.
      // On any failure we fall back to the client-side redirect (current behaviour).
      try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 6000);
        const r = await fetch(xccCallbackUrl, {
          method: "GET",
          redirect: "manual",
          signal: ac.signal,
        });
        clearTimeout(timer);
        let body = "";
        try {
          body = (await r.text()).slice(0, 400);
        } catch { /* ignore body read errors */ }
        ecpProbe = { status: r.status, location: r.headers.get("location"), body };
        if (r.status >= 300 && r.status < 400) {
          ecpAuthorized = true;
        }
      } catch (err) {
        ecpProbe = {
          status: 0,
          location: null,
          body: "",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  // When the server-side ECP probe authorized the client, send them to the success page.
  // Otherwise fall through to the client-side ECP redirect or session fallbacks.
  const candidateUrl =
    xccCallbackUrl ?? session.redirectUrl ?? session.successUrl ?? null;

  let safeUrl: string;
  let wasBlocked: boolean;
  if (ecpAuthorized) {
    safeUrl = internalFallback;
    wasBlocked = false;
  } else {
    safeUrl = getSafeRedirectUrl(candidateUrl, internalFallback);
    wasBlocked =
      candidateUrl !== null &&
      safeUrl === internalFallback &&
      candidateUrl !== internalFallback;
  }

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
          ecpAuthorized,
          ecpProbe,
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
