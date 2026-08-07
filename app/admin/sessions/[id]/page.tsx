import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminTokenIsValid } from "@/lib/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const [{ id }, { k }] = await Promise.all([params, searchParams]);
  if (!adminTokenIsValid(k)) notFound();

  const session = await prisma.guestSession.findUnique({
    where: { id },
    include: { auditEvents: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) notFound();

  const rows: [string, string | null][] = [
    ["Status", session.status],
    ["Client MAC", session.clientMac],
    ["Client MAC (raw)", session.clientMacRaw],
    ["Source IP", session.sourceIp],
    ["SSID / VNS", [session.ssid, session.vns].filter(Boolean).join(" / ") || null],
    ["WLAN index", session.wlan],
    ["VLAN", session.vlan],
    ["AP", [session.apName, session.apSerial].filter(Boolean).join(" · ") || null],
    ["AP MAC / BSSID", [session.apMac, session.bssid].filter(Boolean).join(" / ") || null],
    ["AP location", session.apLocation],
    ["Gateway", session.gatewayHost ? `${session.gatewayHost}:${session.gatewayPort}` : null],
    ["Pre-auth role", session.preAuthRole],
    ["Original destination", session.originalDest],
    ["Sanitized destination", session.sanitizedDest],
    ["Destination rejected", session.destRejectionReason],
    ["Redirect signed at", session.redirectSignedAt?.toISOString() ?? null],
    ["Redirect expires at", session.redirectExpiresAt?.toISOString() ?? null],
    ["Accepted at", session.acceptedAt?.toISOString() ?? null],
    ["Authorization attempted", session.authorizationAttemptedAt?.toISOString() ?? null],
    ["Authorized at", session.authorizedAt?.toISOString() ?? null],
    ["Authorization result", session.authorizationResult],
    ["Failure reason", session.failureReason],
    ["Expires at", session.expiresAt?.toISOString() ?? null],
    ["Disconnected at", session.disconnectedAt?.toISOString() ?? null],
    ["Created", session.createdAt.toISOString()],
    ["Updated", session.updatedAt.toISOString()],
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href={`/admin/sessions?k=${encodeURIComponent(k ?? "")}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to sessions
        </Link>

        <h1 className="text-2xl font-bold text-slate-900 mt-3 mb-6 font-mono break-all">
          {session.id}
        </h1>

        <section className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 mb-8">
          {rows
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label} className="flex gap-4 px-4 py-2 text-sm">
                <span className="w-56 shrink-0 text-slate-500">{label}</span>
                <span className="text-slate-900 break-all">{value}</span>
              </div>
            ))}
        </section>

        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Audit trail ({session.auditEvents.length})
        </h2>
        <ol className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {session.auditEvents.map((e) => (
            <li key={e.id} className="px-4 py-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-500">
                  {e.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    e.severity === "error"
                      ? "bg-red-100 text-red-800"
                      : e.severity === "warn"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {e.action}
                </span>
              </div>
              {e.details ? (
                <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
                  {JSON.stringify(e.details, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
