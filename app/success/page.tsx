import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: sessionId } = await searchParams;

  let session = null;
  if (sessionId) {
    try {
      session = await prisma.guestSession.findUnique({
        where: { id: sessionId },
      });
    } catch {
      // Non-fatal — success page still renders without session details
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8 text-center">
        <div className="mb-4 text-green-500">
          <svg
            className="mx-auto h-16 w-16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Connection Authorized
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          Your guest access request has been accepted.
        </p>

        {session && (
          <div className="text-left rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 space-y-2">
            <div>
              <span className="font-medium">Session ID:</span>{" "}
              <span className="font-mono text-xs break-all">{session.id}</span>
            </div>
            {session.clientMac && (
              <div>
                <span className="font-medium">Device:</span> {session.clientMac}
              </div>
            )}
            {session.ssid && (
              <div>
                <span className="font-medium">Network:</span> {session.ssid}
              </div>
            )}
            {session.acceptedAt && (
              <div>
                <span className="font-medium">Accepted at:</span>{" "}
                {session.acceptedAt.toISOString()}
              </div>
            )}
          </div>
        )}

        <p className="mt-6 text-xs text-gray-400">OS-ONE-CWP</p>
      </div>
    </main>
  );
}
