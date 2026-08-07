import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminTokenIsValid } from "@/lib/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  STARTED: "bg-yellow-100 text-yellow-800",
  ACCEPTED: "bg-sky-100 text-sky-800",
  AUTHORIZED: "bg-emerald-100 text-emerald-800",
  AUTH_FAILED: "bg-red-100 text-red-800",
  REJECTED: "bg-red-100 text-red-800",
  BLOCKED_REDIRECT: "bg-orange-100 text-orange-800",
  ERROR: "bg-red-100 text-red-800",
  EXPIRED: "bg-slate-100 text-slate-600",
  DISCONNECTED: "bg-slate-100 text-slate-600",
};

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  const { k } = await searchParams;
  if (!adminTokenIsValid(k)) notFound();

  const sessions = await prisma.guestSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Guest Sessions</h1>
        <p className="text-sm text-slate-500 mb-6">
          {sessions.length} most recent session{sessions.length === 1 ? "" : "s"}
        </p>

        <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {["Created", "Status", "Device", "SSID", "AP", "Authorized", "Result"].map(
                  (h) => (
                    <th key={h} className="text-left font-medium px-4 py-2">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Link
                      href={`/admin/sessions/${s.id}?k=${encodeURIComponent(k ?? "")}`}
                      className="text-blue-600 hover:underline"
                    >
                      {s.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[s.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{s.clientMac ?? "—"}</td>
                  <td className="px-4 py-2">{s.ssid ?? "—"}</td>
                  <td className="px-4 py-2">{s.apName ?? "—"}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-xs">
                    {s.authorizedAt?.toISOString().replace("T", " ").slice(0, 19) ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {s.authorizationResult ?? s.failureReason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
