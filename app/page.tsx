export const dynamic = "force-dynamic";

/**
 * Landing page. `/portal` is the ECP entry point and requires a signed request
 * from the gateway, so sending humans there produces a confusing error — this
 * page tells them what to do instead.
 */
export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Guest Wi-Fi Portal</h1>
        <p className="text-sm text-slate-500">
          Connect to the guest wireless network and your device will open the
          sign-in page automatically.
        </p>
        <p className="mt-8 text-xs text-slate-400">OS-ONE-CWP</p>
      </div>
    </main>
  );
}
