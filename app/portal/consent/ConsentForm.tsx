"use client";

import { useEffect, useRef, useState } from "react";
import type { Messages } from "@/lib/i18n";
import { format } from "@/lib/i18n";

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
 *
 * The privacy checkbox posts with the form and is *acted on by the server*.
 * Nothing here hides or clears the fields when it is ticked, and that is
 * deliberate: a guest may reasonably tick the box and still type a name because
 * a required field asks for one. What the tick changes is whether the value is
 * written down, and only the server can promise that.
 */

export interface RenderedField {
  id: string;
  type: "text" | "email" | "tel";
  required: boolean;
  maxLength: number;
  autoComplete: string;
  label: string;
  placeholder: string;
  /** Server-side validation message from a previous attempt, if any. */
  error: string | null;
  /** Value to re-populate after a failed attempt. Never a stored value. */
  value: string;
}

export default function ConsentForm({
  csrfToken,
  challenge,
  messages,
  secureNetwork,
  fields,
}: {
  csrfToken: string;
  challenge: string;
  messages: Messages;
  /**
   * The optional secure WLAN, when one is configured. Null means the second
   * option is not rendered at all — the open guest path is then byte-identical
   * to what it was before secure onboarding existed.
   */
  secureNetwork: { ssid: string; securityLabel: string } | null;
  /** Guest fields this deployment collects. Empty is the default. */
  fields: RenderedField[];
}) {
  const [agreed, setAgreed] = useState(false);
  const [gestured, setGestured] = useState(false);
  const [doNotStore, setDoNotStore] = useState(false);
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

      {fields.length > 0 && (
        <fieldset className="mb-6 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">
            {messages.fields.heading}
          </legend>
          <p className="mb-3 text-xs text-slate-500">{messages.fields.subheading}</p>

          <div className="flex flex-col gap-3">
            {fields.map((field) => (
              <div key={field.id} className="flex flex-col gap-1">
                <label
                  htmlFor={`field-${field.id}`}
                  className="flex items-baseline gap-2 text-xs font-medium text-slate-700"
                >
                  <span>{field.label}</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    {field.required ? messages.common.required : messages.common.optional}
                  </span>
                </label>
                <input
                  id={`field-${field.id}`}
                  name={field.id}
                  type={field.type}
                  defaultValue={field.value}
                  required={field.required}
                  maxLength={field.maxLength}
                  autoComplete={field.autoComplete}
                  placeholder={field.placeholder}
                  onPointerDown={noteGesture}
                  onKeyDown={noteGesture}
                  aria-invalid={field.error ? true : undefined}
                  aria-describedby={field.error ? `field-${field.id}-error` : undefined}
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-300 ${
                    field.error ? "border-amber-400" : "border-slate-300"
                  }`}
                />
                {field.error && (
                  <p id={`field-${field.id}-error`} className="text-[11px] text-amber-700">
                    {field.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </fieldset>
      )}

      <label className="mb-5 flex cursor-pointer select-none items-start gap-3">
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
        <span className="text-sm text-slate-700">{messages.consent.agree}</span>
      </label>

      {/* The storage prohibition, placed last so it is the final thing weighed
          before submitting — and after the agreement, so "the terms of use
          above" refers to the terms and nothing in between.

          Rendered whether or not fields are collected: a guest is entitled to
          say "don't keep anything about me" before they know what will be
          asked, and the answer has to mean the same thing either way. */}
      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <label className="flex cursor-pointer select-none items-start gap-3">
          <input
            type="checkbox"
            name="doNotStorePersonalData"
            value="yes"
            checked={doNotStore}
            onPointerDown={noteGesture}
            onKeyDown={noteGesture}
            onChange={(e) => {
              noteGesture();
              setDoNotStore(e.target.checked);
            }}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600"
          />
          <span className="text-sm font-medium text-slate-900">{messages.privacy.checkbox}</span>
        </label>
        <p className="mt-2 pl-7 text-xs leading-relaxed text-slate-600">
          {messages.privacy.explainer}
        </p>
        {doNotStore && (
          <p
            className="mt-3 ml-7 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
            role="status"
          >
            <span className="font-semibold">{messages.privacy.activeTitle}</span>{" "}
            {messages.privacy.activeBody}
          </p>
        )}
      </div>

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
        {messages.consent.submitOpen}
      </button>

      {!ready && (
        <p className="mt-3 text-center text-xs text-slate-400">
          {messages.consent.tickToContinue}
        </p>
      )}

      {secureNetwork && (
        <>
          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs uppercase tracking-wide text-slate-400">
              {messages.consent.or}
            </span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-900">{messages.secureOffer.title}</h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              {messages.secureOffer.body}
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
              {messages.secureOffer.submit}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              {format(messages.secureOffer.note)}
            </p>
          </section>
        </>
      )}
    </form>
  );
}
