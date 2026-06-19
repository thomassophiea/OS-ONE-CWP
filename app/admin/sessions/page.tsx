import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  STARTED: "bg-yellow-100 text-yellow-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REDIRECTED: "bg-blue-100 text-blue-800",
  BLOCKED_REDIRECT: "bg-orange-100 text-orange-800",
  ERROR: "bg-red-100 text-red-800",
  EXPIRED: "bg-gray-100 text-gray-600",
};

export default async function AdminSessionsPage() {
  const sessions = await prisma.guestSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const testUrl = `${appBaseUrl}/portal?client_mac=AA:BB:CC:DD:EE:FF&ssid=GuestWiFi&redirect_url=https://example.com`;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Guest Sessions
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          OS-ONE-CWP Admin — Phase 1 —{" "}
          {sessions.length} recent session
          {sessions.length !== 1 ? "s" : ""}
        </p>

        <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
          <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">
            Test URL
          </p>
          <code className="text-xs text-blue-900 break-all select-all">
            {testUrl}
          </code>
        </div>

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                {[
                  "Created",
                  "Status",
                  "Client MAC",
                  "AP MAC",
                  "SSID",
                  "User IP",
                  "Redirect URL",
                  "Accepted",
                  "Accepted At",
                  "User Agent",
                  "Detail",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No sessions yet. Visit the test URL above to create one.
                  </td>
                </tr>
              )}
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    {s.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.clientMac ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.apMac ?? "—"}
                  </td>
                  <td className="px-4 py-3">{s.ssid ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {s.userIp ?? s.sourceIp ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[200px] truncate">
                    {s.redirectUrl ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.acceptedTerms ? (
                      <span className="text-green-600 font-semibold">Yes</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    {s.acceptedAt
                      ? s.acceptedAt
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 19)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[150px] truncate">
                    {s.userAgent ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/sessions/${s.id}`}
                      className="text-blue-600 hover:underline text-xs whitespace-nowrap"
                    >
                      View →
                    </Link>
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
