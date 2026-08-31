# Employee Sponsorship — implementation audit

Date: 2026-08-31 · Commit: `0e38bdd` · Service: OS-ONE-CWP (Railway, EDGE Services)

## 1. Existing-architecture audit (pre-change findings)

- **Stack**: Next.js 16.2.9 app router, React 19, Prisma 7 → PostgresCWP,
  Tailwind 4, Vitest. Deployed on Railway from `thomassophiea/OS-ONE-CWP@main`.
- **Captive flow**: gateway (XCC 192.168.100.12) emits a SigV4-signed redirect
  to `/portal`; the route verifies the signature byte-for-byte, mints a
  `GuestSession`, sets a signed HttpOnly cookie, and renders `/portal/consent`.
  `POST /api/accept` enforces CSRF (hash + cookie), a deliberate-action
  challenge, and a dwell floor, then hands the **browser** a presigned
  `/ext_approval.php` URL — the ECP callback lives on the AP and is reachable
  only from the wireless client's link. The gateway forwards the authorized
  browser to `/success`, which stamps `AUTHORIZED` and writes the
  `GuestAuthorization` ledger row. **That presigned-URL hand-off is the single
  authorization boundary**, also reused verbatim by the operator pre-auth path
  (`approveWithoutConsent`).
- **Session handling**: server-side rows keyed by signed cookie; replay
  control via unique `redirectSignature`; TTL 900 s.
- **Email**: none existed. Built new (`lib/email/`).
- **Waiting-state precedent**: secure onboarding polls a status endpoint with
  server-owned cadence and a persisted poll budget — reused for sponsorship.
- **Privacy machinery**: `GuestFieldDefinition.personal`,
  `GuestSession.personalDataAllowed`, `forPersistence` write-avoidance,
  unconditional log redaction. Sponsorship rides all of it.

## 2. Research findings (industry patterns)

- Cisco ISE sponsor-approval: emailed link → confirmation page with an approve
  button (not a bare GET commit); approval links expire (up to 24 h); optional
  sponsor login for stronger identity.
- Juniper Mist sponsored guest: sponsor email domain restriction configured
  per-WLAN; authorize/deny links; default 60-minute approval window.
- Meraki sponsored guest and ClearPass sponsor confirmation follow the same
  shape: domain-restricted sponsor, emailed decision, bounded validity.
- Common hardening: pre-configured allowed domains (and optionally allowed
  sponsor addresses), audit of who approved, one-time links.
- Incorporated: exact-domain server-side validation, confirmation-page +
  POST decision (the scanner-safe pattern), short configurable expiry
  (defaulted to the portal-session TTL, 15 min — inside the Mist/ISE range and
  matched to the gateway token's real usable life), decision audit metadata,
  domain-only logging. Not copied: any vendor UI, wording, or branding.

## 3. Verification record

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 321/321 (26 new across 5 files: domain policy incl.
  suffix/prefix/homoglyph/@-smuggling/header-injection; token entropy,
  format-gate, hash matching; state decay incl. boundary instant; email
  scanner-safety, escaping, header-injection, subject bounding; config parsing
  and field-merge).
- `npm run build` — clean; routes `/portal/pending`, `/sponsor/[token]`,
  `/api/sponsorship/status`, `/api/sponsor/decision` present.
- Migration `20260831120000_employee_sponsorship` applied to PostgresCWP
  (public proxy, `prisma migrate deploy`).
- Railway variables set on OS-ONE-CWP: `SPONSOR_ALLOWED_DOMAINS`,
  `EMAIL_TRANSPORT=console`, `EMAIL_FROM`.
- Live verification of the deployed flow recorded in the final report.

## 4. Threat checklist disposition

| Threat | Disposition |
|---|---|
| Scanner auto-approval | Emailed links GET a read-only page; decision is POST-only |
| Token guessing | 256-bit CSPRNG, SHA-256 at rest, format-gated before lookup |
| Replay / double click | Conditional `UPDATE … WHERE status='PENDING' AND expiresAt>now()` |
| Approve-vs-deny race | Same conditional update — one winner in Postgres |
| Deny→approve resurrection | Terminal states never decay; new request required |
| Domain spoofing (`x.com.evil.org`, homoglyphs, `a@x.com@evil`) | ASCII-only exact match after last `@`; tested |
| Header/email injection | CR/LF refused in envelope fields, stripped in body, HTML escaped; tested |
| Enumeration | Unknown token ≡ malformed token; status endpoint session-bound; no mailbox oracle |
| Session spoofing | Status endpoint keyed to signed HttpOnly cookie only |
| URL/log token leakage | Token only in the emailed URL and decision form; hashes elsewhere; audit/logs carry sponsor domain only |
| Stranded guest (mail outage) | Send failure cancels the request and errors the submit |
| Poll abuse | Persisted per-request budget + server-owned cadence |
| CSRF (guest) | Existing token+cookie double-submit unchanged |
| CSRF (sponsor) | Secret bearer token required in POST body; origin checked; GET harmless |
| Feature-off regression | No domains or no transport ⇒ form byte-identical to before |
