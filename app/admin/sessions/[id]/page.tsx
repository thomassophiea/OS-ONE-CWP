import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await prisma.guestSession.findUnique({
    where: { id },
    include: { auditEvents: { orderBy: { createdAt: "asc" } } },
  });

  if (!session) notFound();

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Link
            href="/admin/sessions"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to sessions
          </Link>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          Session Detail
        </h1>
        <p className="font-mono text-xs text-gray-500 mb-6 break-all">
          {session.id}
        </p>

        <div className="space-y-4">
          <Section title="Parsed Fields">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status" value={session.status} />
              <Field label="Client MAC" value={session.clientMac} />
              <Field label="AP MAC" value={session.apMac} />
              <Field label="SSID" value={session.ssid} />
              <Field label="WLAN" value={session.wlan} />
              <Field label="VLAN" value={session.vlan} />
              <Field label="Site" value={session.site} />
              <Field label="Controller" value={session.controller} />
              <Field label="NAS ID" value={session.nasId} />
              <Field label="Session Token" value={session.sessionToken} />
              <Field
                label="Controller Session ID"
                value={session.controllerSessionId}
              />
              <Field label="User IP" value={session.userIp} />
              <Field label="Source IP" value={session.sourceIp} />
              <Field label="Redirect URL" value={session.redirectUrl} />
              <Field label="Success URL" value={session.successUrl} />
              <Field
                label="Accepted Terms"
                value={session.acceptedTerms ? "Yes" : "No"}
              />
              <Field
                label="Accepted At"
                value={session.acceptedAt?.toISOString() ?? null}
              />
              <Field
                label="Created At"
                value={session.createdAt.toISOString()}
              />
              <Field
                label="Updated At"
                value={session.updatedAt.toISOString()}
              />
            </div>
          </Section>

          <Section title="User Agent">
            <pre className="text-xs bg-gray-900 text-green-300 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-words">
              {session.userAgent ?? "(none)"}
            </pre>
          </Section>

          <Section title="Raw Query Parameters">
            <pre className="text-xs bg-gray-900 text-green-300 rounded-lg p-4 overflow-x-auto">
              {JSON.stringify(session.rawQuery, null, 2)}
            </pre>
          </Section>

          <Section title="Raw Headers">
            <pre className="text-xs bg-gray-900 text-green-300 rounded-lg p-4 overflow-x-auto max-h-80">
              {JSON.stringify(session.rawHeaders, null, 2)}
            </pre>
          </Section>

          <Section title={`Audit Events (${session.auditEvents.length})`}>
            {session.auditEvents.length === 0 ? (
              <p className="text-sm text-gray-400">No audit events</p>
            ) : (
              <div className="space-y-2">
                {session.auditEvents.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-lg bg-gray-50 border border-gray-200 p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-semibold text-gray-800">
                        {e.action}
                      </span>
                      <span className="text-xs text-gray-400">
                        {e.createdAt.toISOString()}
                      </span>
                    </div>
                    {e.details && (
                      <pre className="text-xs text-gray-600 overflow-x-auto">
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h2 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-mono text-gray-900 break-all">
        {value ?? "—"}
      </p>
    </div>
  );
}
