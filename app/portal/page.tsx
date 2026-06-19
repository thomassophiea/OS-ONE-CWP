import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractSessionFields } from "@/lib/captive/extractSessionFields";
import { getRequestMetadata } from "@/lib/request/getRequestMetadata";
import AcceptButton from "./AcceptButton";

export const dynamic = "force-dynamic";

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const headersList = await headers();
  const meta = getRequestMetadata(headersList);
  const fields = extractSessionFields(params);

  let sessionId: string | null = null;
  let createError: string | null = null;

  try {
    const session = await prisma.guestSession.create({
      data: {
        clientMac: fields.clientMac,
        apMac: fields.apMac,
        ssid: fields.ssid,
        wlan: fields.wlan,
        vlan: fields.vlan,
        site: fields.site,
        controller: fields.controller,
        nasId: fields.nasId,
        sessionToken: fields.sessionToken,
        controllerSessionId: fields.controllerSessionId,
        userIp: fields.userIp,
        sourceIp: meta.sourceIp,
        userAgent: meta.userAgent,
        redirectUrl: fields.redirectUrl,
        successUrl: fields.successUrl,
        rawQuery: params as unknown as Prisma.InputJsonObject,
        rawHeaders: meta.rawHeaders as unknown as Prisma.InputJsonObject,
      },
    });

    await prisma.auditEvent.create({
      data: {
        sessionId: session.id,
        action: "SESSION_CREATED",
        details: {
          clientMac: fields.clientMac,
          ssid: fields.ssid,
          sourceIp: meta.sourceIp,
        },
      },
    });

    sessionId = session.id;
  } catch (err) {
    console.error("Failed to create guest session:", err);
    createError = "Unable to initialize your session. Please try again.";
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome to Guest Wi-Fi
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Please review and accept the Terms and Conditions to continue.
          </p>
        </div>

        {fields.ssid && (
          <div className="mb-2 text-sm text-gray-600">
            <span className="font-medium">Network:</span> {fields.ssid}
          </div>
        )}
        {fields.clientMac && (
          <div className="mb-4 text-sm text-gray-600">
            <span className="font-medium">Device:</span> {fields.clientMac}
          </div>
        )}

        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-6 text-sm text-gray-700 max-h-40 overflow-y-auto leading-relaxed">
          By using this guest wireless network, you agree to use the service
          responsibly and comply with all applicable policies. Access may be
          monitored and logged for security and operational purposes.
        </div>

        {createError ? (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {createError}
          </div>
        ) : (
          <AcceptButton sessionId={sessionId!} />
        )}

        <p className="mt-6 text-center text-xs text-gray-400">OS-ONE-CWP</p>
      </div>
    </main>
  );
}
