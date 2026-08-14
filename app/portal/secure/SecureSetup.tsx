"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format, type Messages } from "@/lib/i18n";

/**
 * Only the parts of the catalogue this component renders.
 *
 * Props to a client component are serialised into the page, so passing the
 * whole catalogue shipped every error string and every consent paragraph to a
 * browser that renders none of them. Naming the subtrees keeps the payload to
 * what is used and makes the dependency legible — adding a string here is a
 * type error until the page passes it.
 */
export type SecureSetupMessages = Pick<
  Messages,
  "common" | "secure" | "handoff" | "qr" | "manual"
>;

/**
 * The secure-onboarding experience.
 *
 * Three things drive the shape of this component, and all three come from how
 * the devices actually behave rather than from how the flow reads on paper.
 *
 * **The captive mini-browser is not the browser.** iOS's Captive Network
 * Assistant cannot install a configuration profile and cannot reach Settings.
 * A "Set Up Secure Wi-Fi" button that silently does nothing there is worse than
 * no button, so when the server reports an assistant the page leads with
 * getting into Safari — and still offers manual setup, which works everywhere.
 *
 * **A phone cannot scan its own screen.** QR is genuinely the best mechanism on
 * Android — it is what Android's own Wi-Fi sharing uses — and it is useless on
 * the single device a guest is holding. So the method plan comes from the
 * server (see `lib/onboarding/methods.ts`), QR is never primary on a phone, and
 * where it is shown on a phone it is labelled for another device.
 *
 * **Downloaded is not connected.** The completion state comes from polling the
 * gateway for this station on the secure WLAN. Until that says so, the page
 * says what actually happened — "Wi-Fi setup downloaded" — and nothing more.
 *
 * No credential material is present in this file or in the bundle it compiles
 * into. The passphrase arrives only from an explicit POST the guest triggers.
 */

interface MethodOption {
  id: "APPLE_PROFILE" | "WIFI_QR" | "MANUAL" | "WINDOWS_PROFILE";
  label: string;
  description: string;
  primary: boolean;
  followUp: string | null;
}

interface OnboardingView {
  id: string;
  status: string;
  statusLabel: string;
  platform: string;
  platformLabel: string;
  network: { ssid: string; security: string; securityLabel: string; hidden: boolean };
  methods: MethodOption[];
  verified: boolean;
}

interface CredentialView {
  network: { ssid: string; securityLabel: string };
  passphrase: string | null;
  perDevice: boolean;
}

type Phase = "loading" | "ready" | "unavailable";

const HANDHELD = new Set(["IOS", "IPADOS", "ANDROID"]);

export default function SecureSetup({
  messages,
  ssid,
  securityLabel,
  destination,
  safariUrl,
  handoffUrl,
}: {
  /** The guest's strings. Passed down rather than fetched: this component is
   *  rendered inside captive webviews where an extra round trip is a risk. */
  messages: SecureSetupMessages;
  ssid: string;
  securityLabel: string;
  destination: string | null;
  /** `x-safari-https://…` hand-off, present only inside a captive assistant. */
  safariUrl: string | null;
  /** The same link as plain https, for copying when the scheme does nothing. */
  handoffUrl: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [view, setView] = useState<OnboardingView | null>(null);
  const [captiveAssistant, setCaptiveAssistant] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openPanel, setOpenPanel] = useState<null | "qr" | "manual">(null);
  const [credential, setCredential] = useState<CredentialView | null>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [credentialPending, setCredentialPending] = useState(false);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [copied, setCopied] = useState<null | "ssid" | "passphrase">(null);

  const [joinState, setJoinState] = useState<
    "idle" | "pending" | "completed" | "exhausted" | "unavailable"
  >("idle");
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- start the onboarding session ------------------------------------
  useEffect(() => {
    let cancelled = false;

    // Signals only the page can see. `maxTouchPoints` is how an iPad, which
    // sends a macOS user-agent, is told apart from a Mac.
    const body = {
      maxTouchPoints: typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0,
      platform: guessPlatform(),
    };

    (async () => {
      try {
        const response = await fetch("/api/v1/onboarding/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) {
          setError(payload?.error?.message ?? messages.secure.unavailableGeneric);
          setPhase("unavailable");
          return;
        }
        setView(payload.onboarding);
        setCaptiveAssistant(Boolean(payload.captiveAssistant));
        setPhase("ready");

        // Pick up where a previous visit left off.
        //
        // A guest who installed the profile, watched their device switch, and
        // came back to this page would otherwise sit in front of a setup screen
        // that never checks — polling used to begin only when a method was
        // tapped, so returning was the one moment it could not confirm. If the
        // gateway has already seen them, say so; if they have been handed an
        // artifact, start watching for the result.
        if (payload.onboarding?.verified) {
          setJoinState("completed");
        } else if (
          ["PROFILE_DOWNLOADED", "QR_DISPLAYED", "MANUAL_SETUP_VIEWED"].includes(
            payload.onboarding?.status
          )
        ) {
          setJoinState("pending");
        }
      } catch {
        if (cancelled) return;
        setError(messages.secure.unavailableStart);
        setPhase("unavailable");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---- gateway-confirmed join ------------------------------------------
  // Runs only while the state is `pending`, and stops itself the moment the
  // gateway gives a terminal answer. The cadence is the server's (`pollAfterMs`)
  // so it can be widened without shipping a new bundle, and the server enforces
  // its own budget on top — see `onboardingMaxChecks`.
  useEffect(() => {
    if (joinState !== "pending" || !view) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const response = await fetch(`/api/v1/onboarding/sessions/${view.id}/status`);
        if (cancelled) return;
        if (!response.ok) {
          setJoinState("unavailable");
          return;
        }
        const payload = await response.json();
        if (cancelled) return;
        if (payload.state === "completed") {
          setJoinState("completed");
          return;
        }
        if (payload.state === "pending" && payload.pollAfterMs) {
          pollTimer.current = setTimeout(tick, payload.pollAfterMs);
          return;
        }
        setJoinState(payload.state === "exhausted" ? "exhausted" : "unavailable");
      } catch {
        if (!cancelled) setJoinState("unavailable");
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [joinState, view]);

  const startPolling = useCallback(() => {
    setJoinState((current) => (current === "idle" ? "pending" : current));
  }, []);

  // ---- actions ----------------------------------------------------------
  const runMethod = useCallback(
    async (method: MethodOption) => {
      if (!view) return;
      setError(null);
      setCredentialError(null);

      switch (method.id) {
        case "APPLE_PROFILE":
        case "WINDOWS_PROFILE": {
          const path = method.id === "APPLE_PROFILE" ? "profile" : "windows-profile";
          setFollowUp(method.followUp);
          startPolling();
          // A top-level navigation, not a fetch: iOS only hands a
          // `.mobileconfig` to Settings when the browser navigates to it, and a
          // response body read by script cannot be installed.
          window.location.href = `/api/v1/onboarding/sessions/${view.id}/${path}`;
          return;
        }
        case "WIFI_QR": {
          setOpenPanel("qr");
          setFollowUp(method.followUp);
          startPolling();
          return;
        }
        case "MANUAL": {
          setOpenPanel("manual");
          setFollowUp(method.followUp);
          return;
        }
      }
    },
    [view, startPolling]
  );

  const revealCredential = useCallback(async () => {
    if (!view || credentialPending) return;
    setCredentialPending(true);
    setCredentialError(null);
    try {
      // POST, so this can never be a URL, a bookmark, a prefetch or a history
      // entry — the response body is the passphrase.
      const response = await fetch(`/api/v1/onboarding/sessions/${view.id}/credential`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setCredentialError(payload?.error?.message ?? messages.manual.failed);
        return;
      }
      setCredential(payload);
      startPolling();
    } catch {
      setCredentialError(messages.manual.failed);
    } finally {
      setCredentialPending(false);
    }
  }, [view, credentialPending, startPolling]);

  const copy = useCallback(async (value: string, what: "ssid" | "passphrase") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard access is denied in some captive webviews. The value is on
      // screen and can be typed, so this is not worth an error message.
    }
  }, []);

  // ---- render -----------------------------------------------------------
  if (phase === "loading") {
    return (
      <Card>
        <p className="text-sm text-slate-500 text-center py-6">{messages.secure.preparing}</p>
      </Card>
    );
  }

  if (phase === "unavailable" || !view) {
    return (
      <Card>
        <h1 className="text-lg font-bold text-slate-900">{messages.secure.unavailableTitle}</h1>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
        <ContinueLink destination={destination} messages={messages} />
      </Card>
    );
  }

  const primary = view.methods.find((m) => m.primary) ?? view.methods[0];
  const secondary = view.methods.filter((m) => m !== primary);
  const handheld = HANDHELD.has(view.platform);
  // The assistant cannot install a profile or reach Settings, so on an Apple
  // device the first move is getting out of it.
  const needsSafari =
    captiveAssistant &&
    Boolean(safariUrl) &&
    (view.platform === "IOS" || view.platform === "IPADOS" || view.platform === "MACOS");

  return (
    <Card>
      <header>
        <h1 className="text-xl font-bold text-slate-900">{messages.secure.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{messages.secure.subtitle}</p>
      </header>

      <p className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900">
        <span aria-hidden="true">🔒</span>
        <span>{ssid}</span>
        <span className="ml-auto text-xs font-normal text-slate-500">{securityLabel}</span>
      </p>

      {joinState === "completed" ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">
            {format(messages.secure.onSecureTitle, { ssid })}
          </p>
          <p className="mt-1 text-xs text-emerald-800">{messages.secure.onSecureBody}</p>
          <ContinueLink destination={destination} messages={messages} />
        </div>
      ) : needsSafari ? (
        <SafariHandoff
          safariUrl={safariUrl!}
          handoffUrl={handoffUrl}
          onManual={() => {
            setOpenPanel("manual");
            setFollowUp(null);
          }}
          messages={messages}
        />
      ) : (
        <>
          <div className="mt-5 space-y-3">
            {primary && (
              <button
                type="button"
                onClick={() => runMethod(primary)}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                {primary.label}
              </button>
            )}
            {primary && (
              <p className="text-center text-xs text-slate-500">{primary.description}</p>
            )}
          </div>

          {secondary.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {secondary.map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => runMethod(method)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
                >
                  {method.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {followUp && joinState !== "completed" && (
        <p className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
          {followUp}
        </p>
      )}

      {openPanel === "qr" && (
        <QrPanel
          id={view.id}
          ssid={ssid}
          handheld={handheld}
          onManual={() => setOpenPanel("manual")}
          messages={messages}
        />
      )}

      {openPanel === "manual" && (
        <ManualPanel
          ssid={ssid}
          securityLabel={securityLabel}
          credential={credential}
          error={credentialError}
          pending={credentialPending}
          copied={copied}
          onReveal={revealCredential}
          onCopy={copy}
          messages={messages}
        />
      )}

      {joinState === "pending" && (
        <p className="mt-5 text-center text-xs text-slate-400">
          {format(messages.secure.waiting, { ssid })}
        </p>
      )}
      {joinState === "exhausted" && (
        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          {format(messages.secure.exhausted, { ssid })}
        </p>
      )}
      {joinState === "unavailable" && (
        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          {format(messages.secure.unknown, { ssid })}
        </p>
      )}

      <ContinueLink destination={destination} messages={messages} />
    </Card>
  );
}

// ---------------------------------------------------------------------------

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white p-6 shadow-md sm:p-8">{children}</div>;
}

function ContinueLink({
  destination,
  messages,
}: {
  destination: string | null;
  messages: SecureSetupMessages;
}) {
  return (
    <p className="mt-6 text-center text-xs text-slate-400">
      {destination ? (
        <a className="text-blue-600 underline break-all" href={destination}>
          {messages.secure.skip}
        </a>
      ) : (
        messages.secure.closeAnyTime
      )}
    </p>
  );
}

/**
 * The way out of the OS captive-portal window.
 *
 * Two things have to happen and only one of them is the URL scheme.
 * `x-safari-https://…` asks the system to open the link in Safari — registered
 * on both iOS and macOS, so it does open. What it opens is a browser with a
 * *different cookie store*, which is why the link carries a single-use
 * hand-off token: without it the new browser has no session and shows "Your
 * session has ended", which is exactly what happened before this existed.
 *
 * The scheme is not guaranteed to fire on every build, and a link that silently
 * does nothing is worse than no link. So the page watches: if it is still
 * visible a moment after the tap, the plain https link is revealed to copy into
 * Safari by hand. Manual setup sits alongside throughout, because it needs
 * neither Safari nor Settings and therefore works inside the assistant.
 */
function SafariHandoff({
  safariUrl,
  handoffUrl,
  onManual,
  messages,
}: {
  safariUrl: string;
  handoffUrl: string | null;
  onManual: () => void;
  messages: SecureSetupMessages;
}) {
  const [stalled, setStalled] = useState(false);
  const [copied, setCopied] = useState(false);

  // Leaving for another app hides this page. Still visible after a beat means
  // the hand-off did not take, and the guest needs the manual route.
  const noteTap = useCallback(() => {
    window.setTimeout(() => {
      if (document.visibilityState === "visible") setStalled(true);
    }, 2500);
  }, []);

  const copyLink = useCallback(async () => {
    if (!handoffUrl) return;
    try {
      await navigator.clipboard.writeText(handoffUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused in some captive webviews. The link is on
      // screen and selectable, so this needs no error message.
    }
  }, [handoffUrl]);

  return (
    <div className="mt-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">{messages.handoff.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-800">
          {messages.handoff.body}
        </p>
      </div>

      <a
        href={safariUrl}
        onClick={noteTap}
        className="mt-4 block w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      >
        {messages.handoff.openInSafari}
      </a>

      {stalled && handoffUrl && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-900">
            {messages.handoff.stalledTitle}
          </p>
          <p className="mt-2 break-all rounded-lg border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-700">
            {handoffUrl}
          </p>
          <button
            type="button"
            onClick={copyLink}
            className="mt-2 w-full rounded-lg border border-slate-300 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            {copied ? messages.common.copied : messages.handoff.copyLink}
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {messages.handoff.linkNote}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onManual}
        className="mt-3 w-full rounded-lg border border-slate-300 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        {messages.handoff.manualSetup}
      </button>
      <p className="mt-2 text-center text-[11px] text-slate-400">
        {messages.handoff.manualWorksHere}
      </p>
    </div>
  );
}

function QrPanel({
  id,
  ssid,
  handheld,
  onManual,
  messages,
}: {
  id: string;
  ssid: string;
  handheld: boolean;
  onManual: () => void;
  messages: SecureSetupMessages;
}) {
  return (
    <div className="mt-5 rounded-xl border border-slate-200 p-4 text-center">
      <p className="text-sm font-semibold text-slate-900">
        {format(messages.qr.title, { ssid })}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {handheld ? messages.qr.handheld : messages.qr.desktop}
      </p>
      {/* The credential is encoded inside the image, which is generated
          server-side and served `no-store`. It is never in this page's HTML. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/v1/onboarding/sessions/${id}/qr`}
        alt={format(messages.qr.alt, { ssid })}
        className="mx-auto mt-4 h-48 w-48"
      />
      <button
        type="button"
        onClick={onManual}
        className="mt-4 text-xs font-medium text-blue-600 underline"
      >
        {messages.qr.cantScan}
      </button>
    </div>
  );
}

function ManualPanel({
  ssid,
  securityLabel,
  credential,
  error,
  pending,
  copied,
  onReveal,
  onCopy,
  messages,
}: {
  ssid: string;
  securityLabel: string;
  credential: CredentialView | null;
  error: string | null;
  pending: boolean;
  copied: null | "ssid" | "passphrase";
  onReveal: () => void;
  onCopy: (value: string, what: "ssid" | "passphrase") => void;
  messages: SecureSetupMessages;
}) {
  return (
    <div className="mt-5 rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-900">{messages.manual.title}</p>
      <dl className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 text-sm">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <dt className="text-slate-500">{messages.manual.networkLabel}</dt>
          <dd className="flex items-center gap-2 font-medium text-slate-900">
            <span className="break-all">{ssid}</span>
            <button
              type="button"
              onClick={() => onCopy(ssid, "ssid")}
              className="text-xs text-blue-600 underline"
            >
              {copied === "ssid" ? messages.common.copied : messages.common.copy}
            </button>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <dt className="text-slate-500">{messages.manual.securityLabel}</dt>
          <dd className="font-medium text-slate-900">{securityLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <dt className="text-slate-500">{messages.manual.passwordLabel}</dt>
          <dd className="flex items-center gap-2 text-right">
            {credential?.passphrase ? (
              <>
                <span className="break-all font-mono text-xs text-slate-900">
                  {credential.passphrase}
                </span>
                <button
                  type="button"
                  onClick={() => onCopy(credential.passphrase!, "passphrase")}
                  className="text-xs text-blue-600 underline"
                >
                  {copied === "passphrase" ? messages.common.copied : messages.common.copy}
                </button>
              </>
            ) : (
              // Revealed only on an explicit tap — never rendered into the page
              // that arrives from the server.
              <button
                type="button"
                onClick={onReveal}
                disabled={pending}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 disabled:text-slate-400"
              >
                {pending ? messages.common.loading : messages.manual.showPassword}
              </button>
            )}
          </dd>
        </div>
      </dl>
      {error && <p className="mt-3 text-xs text-amber-700">{error}</p>}
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        {format(messages.manual.instructions, { ssid })}
      </p>
    </div>
  );
}

/**
 * The page's own guess at its platform, sent to the server as one more signal.
 *
 * `userAgentData.platform` is authoritative where it exists and unavailable on
 * Safari, so this returns null rather than a fabrication when it cannot tell —
 * the server still has Client Hints and the user-agent to work from.
 */
function guessPlatform(): string | null {
  if (typeof navigator === "undefined") return null;
  const touch = navigator.maxTouchPoints ?? 0;
  const ua = navigator.userAgent ?? "";
  if (/\bAndroid\b/i.test(ua)) return "ANDROID";
  if (/\biPhone\b|\biPod\b/i.test(ua)) return "IOS";
  if (/\biPad\b/i.test(ua)) return "IPADOS";
  // iPadOS reports a Mac user-agent; a Mac with a touchscreen does not exist.
  if (/\bMacintosh\b|\bMac OS X\b/i.test(ua)) return touch > 1 ? "IPADOS" : "MACOS";
  if (/\bWindows NT\b/i.test(ua)) return "WINDOWS";
  return null;
}
