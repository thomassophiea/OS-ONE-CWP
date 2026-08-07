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
}: {
  csrfToken: string;
  challenge: string;
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

      <button
        type="submit"
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
    </form>
  );
}
