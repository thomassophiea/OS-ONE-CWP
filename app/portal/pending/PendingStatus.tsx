"use client";

import { useEffect, useRef, useState } from "react";
import { format, type Messages } from "@/lib/i18n";

/**
 * Live view of one sponsorship request, from the waiting guest's side.
 *
 * Plain interval polling, for the same reason the secure-onboarding page
 * polls: the audience is captive-portal webviews, where SSE and WebSocket
 * support is the least dependable thing about the environment and a missed
 * event has no recovery story. A 4-second GET against an indexed row is
 * nothing, the server owns the cadence (`pollAfterMs`), and the budget is
 * bounded server-side so an abandoned tab goes quiet on its own.
 *
 * On approval the server hands over the presigned gateway callback and this
 * component navigates to it — the same browser-fetches-the-approval-URL step
 * every other path through this portal uses.
 */

export type PendingInitialState =
  | "pending"
  | "approved_waiting"
  | "denied"
  | "expired"
  | "session_expired";

type ViewState =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "session_expired"
  | "exhausted"
  | "error";

export type PendingMessages = Pick<Messages, "common" | "sponsorship">;

export default function PendingStatus({
  initialState,
  sponsorEmail,
  ttlMinutes,
  messages,
  networkLabel,
  ssid,
}: {
  initialState: PendingInitialState;
  sponsorEmail: string;
  ttlMinutes: number;
  messages: PendingMessages;
  networkLabel: string;
  ssid: string | null;
}) {
  const [state, setState] = useState<ViewState>(
    initialState === "approved_waiting" ? "pending" : initialState
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    // Terminal states rendered by the server need no polling at all.
    if (initialState === "denied" || initialState === "expired" || initialState === "session_expired") {
      return;
    }
    stopped.current = false;

    const poll = async () => {
      if (stopped.current) return;
      try {
        const res = await fetch("/api/sponsorship/status", { cache: "no-store" });
        const body = (await res.json()) as {
          state: string;
          approvalUrl?: string;
          pollAfterMs?: number | null;
        };

        switch (body.state) {
          case "pending":
            setState("pending");
            timer.current = setTimeout(poll, body.pollAfterMs ?? 4000);
            return;
          case "approved":
            setState("approved");
            stopped.current = true;
            if (body.approvalUrl) {
              // The grant itself: this browser fetches the signed callback,
              // the gateway moves the station, and the gateway forwards the
              // browser to /success.
              window.location.href = body.approvalUrl;
            }
            return;
          case "authorized":
            setState("approved");
            stopped.current = true;
            window.location.href = "/success";
            return;
          case "denied":
            setState("denied");
            stopped.current = true;
            return;
          case "expired":
          case "none":
            setState("expired");
            stopped.current = true;
            return;
          case "session_expired":
          case "no_session":
            setState("session_expired");
            stopped.current = true;
            return;
          case "exhausted":
            setState("exhausted");
            stopped.current = true;
            return;
          default:
            setState("error");
            timer.current = setTimeout(poll, 10_000);
        }
      } catch {
        // Transient network trouble inside a captive webview is normal;
        // keep trying, more slowly.
        timer.current = setTimeout(poll, 10_000);
      }
    };

    void poll();
    return () => {
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [initialState]);

  const s = messages.sponsorship;

  if (state === "pending") {
    return (
      <div className="mt-4 text-center">
        <div className="mb-4 flex justify-center" aria-hidden="true">
          <span className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{s.pendingTitle}</h1>
        <p className="text-sm text-slate-500 mb-6">
          {format(s.pendingBody, { sponsor: sponsorEmail })}
        </p>
        {ssid && (
          <dl className="text-left rounded-lg bg-slate-50 border border-slate-200 text-sm mb-6">
            <div className="flex justify-between gap-4 px-4 py-2">
              <dt className="text-slate-500">{networkLabel}</dt>
              <dd className="text-slate-900 font-medium text-right break-all">{ssid}</dd>
            </div>
          </dl>
        )}
        <p className="text-xs text-slate-400">
          {format(s.pendingHint, { minutes: ttlMinutes })}
        </p>
      </div>
    );
  }

  if (state === "approved") {
    return (
      <StatusCard tone="ok" title={s.approvedTitle} body={s.approvedBody} />
    );
  }

  if (state === "denied") {
    return <StatusCard tone="warn" title={s.deniedTitle} body={s.deniedBody} />;
  }

  if (state === "exhausted" || state === "error") {
    return (
      <div className="mt-4 text-center">
        <StatusCard
          tone="warn"
          title={s.pendingTitle}
          body={state === "exhausted" ? s.stoppedBody : s.statusError}
        />
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 w-full rounded-xl py-3 font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          {s.reload}
        </button>
      </div>
    );
  }

  // expired / session_expired
  return <StatusCard tone="warn" title={s.expiredTitle} body={s.expiredBody} />;
}

function StatusCard({
  tone,
  title,
  body,
}: {
  tone: "ok" | "warn";
  title: string;
  body: string;
}) {
  return (
    <div className="mt-4 text-center">
      <div
        className={`mb-4 ${tone === "ok" ? "text-emerald-500" : "text-amber-500"}`}
        aria-hidden="true"
      >
        {tone === "ok" ? (
          <svg className="mx-auto h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ) : (
          <svg className="mx-auto h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        )}
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
      <p className="text-sm text-slate-500">{body}</p>
    </div>
  );
}
