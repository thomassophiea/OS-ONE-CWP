export const dynamic = "force-dynamic";

/**
 * Deliberately generic, operator-friendly errors. The specific failure reason
 * is recorded in the audit table and the structured log; the guest sees only
 * enough to know whether retrying will help.
 */
const MESSAGES: Record<string, { title: string; body: string }> = {
  bad_request: {
    title: "This link isn't valid",
    body: "The connection request was incomplete. Disconnect from the network, reconnect, and try again.",
  },
  untrusted: {
    title: "We couldn't verify this request",
    body: "The request did not come from a recognised network gateway. Reconnect to the Wi-Fi network and try again.",
  },
  expired: {
    title: "This link has expired",
    body: "Sign-in links are only valid for a short time. Reconnect to the Wi-Fi network to get a fresh one.",
  },
  no_session: {
    title: "Your session has ended",
    body: "Reconnect to the Wi-Fi network to start again.",
  },
  unsupported_gateway: {
    title: "Network not supported",
    body: "This portal is not configured for the network you are connecting from. Please contact the network administrator.",
  },
  consent: {
    title: "You need to accept the terms",
    body: "Tick the agreement box on the sign-in page and press Connect. If your device opened this page automatically, open a browser and try again.",
  },
  csrf: {
    title: "Your session could not be confirmed",
    body: "For your security we could not confirm this form submission. Reconnect to the Wi-Fi network and try again.",
  },
  authorization_failed: {
    title: "We couldn't complete your connection",
    body: "The network gateway declined the request. Reconnect to the Wi-Fi network and try again, or contact the network administrator.",
  },
  handoff_invalid: {
    title: "This setup link has expired",
    body: "Secure setup links are only valid for a few minutes. Go back to the Wi-Fi sign-in window and tap Open in Safari again.",
  },
  handoff_used: {
    title: "This setup link has already been used",
    body: "Each link works once. Go back to the Wi-Fi sign-in window and tap Open in Safari again to get a fresh one.",
  },
  revoked: {
    title: "Guest access has been withdrawn",
    body: "This device is no longer permitted on the guest network. Please contact the network administrator.",
  },
  unavailable: {
    title: "The portal is temporarily unavailable",
    body: "Please wait a moment and try again. If this continues, contact the network administrator.",
  },
};

export default async function PortalErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const message = MESSAGES[code ?? ""] ?? MESSAGES.bad_request;

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8 text-center">
        <div className="mb-4 text-amber-500" aria-hidden="true">
          <svg
            className="mx-auto h-14 w-14"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">{message.title}</h1>
        <p className="text-sm text-slate-500">{message.body}</p>
        <p className="mt-8 text-xs text-slate-400">
          OS-ONE-CWP{code ? ` · ${code}` : ""}
        </p>
      </div>
    </main>
  );
}
