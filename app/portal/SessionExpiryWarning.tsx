"use client";

import { useEffect, useRef, useState } from "react";
import { format, type Messages } from "@/lib/i18n";

/**
 * Warns a guest before their session's TTL runs out, with a real way to stay
 * — WCAG 2.2.1 (Timing Adjustable). Rendered on every page a guest can be
 * parked on for a while: consent, the sponsorship waiting room, and secure
 * setup.
 *
 * Two live regions, not one, and neither of them re-announces every tick:
 * - `role="alert"` (assertive) fires once when the threshold is crossed, and
 *   again only on a failed extend — an aria-live region that updates every
 *   second is a known way to make a countdown unusable with a screen reader.
 * - `role="status"` (polite) reports a successful extend once, then clears.
 * The visible mm:ss clock is `aria-hidden` and updates every second for
 * sighted users only.
 *
 * On real expiry this reloads the current page rather than inventing its own
 * "you're done" state — every page here already redirects an expired session
 * to `/portal/error?code=expired` server-side, so reloading is the one action
 * that can never disagree with the server about what happens next.
 */
export default function SessionExpiryWarning({
  expiresAt,
  messages,
  warnBeforeSeconds = 120,
}: {
  expiresAt: string;
  messages: Messages["sessionTiming"];
  warnBeforeSeconds?: number;
}) {
  const [expiry, setExpiry] = useState(() => new Date(expiresAt).getTime());
  const [remainingMs, setRemainingMs] = useState(() => expiry - Date.now());
  const [phase, setPhase] = useState<
    "ok" | "warning" | "extending" | "extended" | "failed"
  >(() => (expiry - Date.now() <= warnBeforeSeconds * 1000 ? "warning" : "ok"));
  const [extendedMinutes, setExtendedMinutes] = useState(0);
  const reloaded = useRef(false);

  useEffect(() => {
    const tick = () => {
      const remaining = expiry - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0) {
        if (!reloaded.current) {
          reloaded.current = true;
          window.location.reload();
        }
        return;
      }
      setPhase((prev) =>
        prev === "ok" || prev === "warning"
          ? remaining <= warnBeforeSeconds * 1000
            ? "warning"
            : "ok"
          : prev
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiry, warnBeforeSeconds]);

  // A settled "extended" or "failed" phase clears itself a few seconds after
  // the fact — the polite/assertive text has already been announced, and
  // holding the banner in that phase forever would misreport a session that
  // is either fine again or still running out.
  useEffect(() => {
    if (phase !== "extended" && phase !== "failed") return;
    const id = setTimeout(() => {
      const remaining = expiry - Date.now();
      setPhase(remaining <= warnBeforeSeconds * 1000 ? "warning" : "ok");
    }, 5000);
    return () => clearTimeout(id);
  }, [phase, expiry, warnBeforeSeconds]);

  const extend = async () => {
    setPhase("extending");
    try {
      const res = await fetch("/api/session/extend", { method: "POST", cache: "no-store" });
      if (!res.ok) {
        setPhase("failed");
        return;
      }
      const body = (await res.json()) as { expiresAt: string };
      const nextExpiry = new Date(body.expiresAt).getTime();
      setExtendedMinutes(Math.max(1, Math.round((nextExpiry - Date.now()) / 60000)));
      setExpiry(nextExpiry);
      setRemainingMs(nextExpiry - Date.now());
      setPhase("extended");
    } catch {
      setPhase("failed");
    }
  };

  if (phase === "ok") {
    // Kept in the DOM, empty, so the region is already registered with
    // assistive tech by the time the threshold is crossed — mounting a fresh
    // `aria-live` node only at that moment is not reliably announced.
    return <div role="alert" aria-live="assertive" className="sr-only" />;
  }

  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const clock = `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, "0")}`;

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <div role="alert" aria-live="assertive">
        {(phase === "warning" || phase === "extending") && messages.warning}
        {phase === "failed" && messages.extendFailed}
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {phase === "extended" && format(messages.extended, { minutes: String(extendedMinutes) })}
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span aria-hidden="true" className="font-mono tabular-nums">
          {clock}
        </span>
        {phase !== "extended" && (
          <button
            type="button"
            onClick={extend}
            disabled={phase === "extending"}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {phase === "extending" ? messages.extending : messages.extend}
          </button>
        )}
      </div>
    </div>
  );
}
