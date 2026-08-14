"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Consent form with a deliberate-action gate.
 *
 * Measured on 2026-08-07: with a single submit button and no checkbox, macOS's
 * Captive Network Assistant completed the whole flow unattended — a session was
 * created, accepted and authorized with nobody touching the device. A terms
 * gate that the guest's operating system can satisfy on their behalf is not a
 * terms gate.
 *
 * Three things now have to be true for a POST to be honoured, and the server
 * enforces all three:
 *
 *  1. the agreement checkbox is ticked;
 *  2. `interaction` carries the per-session challenge, which this component
 *     only writes after a genuine pointer or key event on the control;
 *  3. at least MIN_DWELL_MS elapsed since the page rendered.
 *
 * None of this can prove a human is present — an automated agent driving a real
 * WebKit view can synthesise events. It does defeat form auto-submission, which
 * is the behaviour actually observed.
 */
export default function ConsentForm({
  csrfToken,
  challenge,
  secureNetwork,
}: {
  csrfToken: string;
  challenge: string;
  /**
   * The optional secure WLAN, when one is configured. Null means the second
   * option is not rendered at all — the open guest path is then byte-identical
   * to what it was before secure onboarding existed.
   */
  secureNetwork: { ssid: string; securityLabel: string } | null;
}) {
  const [agreed, setAgreed] = useState(false);
  const [gestured, setGestured] = useState(false);
  const mountedAt = useRef(0);
  const [dwellMs, setDwellMs] = useState(0);

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  const noteGesture = () => {
    setGestured(true);
    setDwellMs(Date.now() - mountedAt.current);
  };

  const ready = agreed && gestured;

  return (
    <form method="POST" action="/api/accept">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="interaction" value={gestured ? challenge : ""} />
      <input type="hidden" name="dwellMs" value={String(dwellMs)} />

      <label className="flex items-start gap-3 mb-5 cursor-pointer select-none">
        <input
          type="checkbox"
          name="agree"
          value="yes"
          checked={agreed}
          onPointerDown={noteGesture}
          onKeyDown={noteGesture}
          onChange={(e) => {
            noteGesture();
            setAgreed(e.target.checked);
          }}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600"
        />
        <span className="text-sm text-slate-700">
          I have read and agree to the terms of use above.
        </span>
      </label>

      {/* The open guest path. Unchanged: same name, same position, same submit,
          same handler. Everything below it is additive. */}
      <button
        type="submit"
        name="mode"
        value="open"
        disabled={!ready}
        onPointerDown={noteGesture}
        onKeyDown={noteGesture}
        className="w-full rounded-xl py-3 font-semibold text-sm transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
      >
        Connect to the Internet
      </button>

      {!ready && (
        <p className="mt-3 text-center text-xs text-slate-400">
          Tick the box above to continue.
        </p>
      )}

      {secureNetwork && (
        <>
          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Secure Guest Access</h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              For better security and automatic reconnect, set up this device on
              our encrypted Wi-Fi network.
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-900">
              <span aria-hidden="true">🔒</span>
              <span>{secureNetwork.ssid}</span>
              <span className="text-xs font-normal text-slate-500">
                {secureNetwork.securityLabel}
              </span>
            </p>

            {/* Same form, same consent, same authorization — only the page the
                gateway returns to afterwards differs. Secure setup is never a
                prerequisite for getting online. */}
            <button
              type="submit"
              name="mode"
              value="secure"
              disabled={!ready}
              onPointerDown={noteGesture}
              onKeyDown={noteGesture}
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              Accept &amp; Connect Securely
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              You&apos;ll get internet access first, then we&apos;ll help you switch.
            </p>
          </section>
        </>
      )}
    </form>
  );
}
