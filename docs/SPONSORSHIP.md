# Employee Sponsorship

A guest names an employee; the employee allows or denies from their inbox; an
approval releases the same presigned gateway callback every other path through
this portal uses. Phase 1 sponsors are `@extremenetworks.com`.

## The flow

```
guest ──── /portal (signed redirect verified, session minted)
  │
  ├─ /portal/consent — third option: "Employee Sponsorship"
  │      name + email (required on this path) + sponsor's work email
  │
  ├─ POST /api/accept  mode=sponsor
  │      same CSRF / deliberate-action / dwell gates as the open path
  │      sponsor address validated against SPONSOR_ALLOWED_DOMAINS (server-side)
  │      SponsorshipRequest row created — PENDING, expiry stamped
  │      email sent (token only ever inside the review URL)
  │      session: consent recorded, NOTHING authorized, CSRF burnt
  │
  ├─ /portal/pending — waiting page, polls GET /api/sponsorship/status
  │
sponsor ── email: ALLOW / DENY → both open GET /sponsor/{token} (read-only)
  │           └─ POST /api/sponsor/decision (atomic PENDING → APPROVED|DENIED)
  │
  └─ next guest poll: state=approved + presigned /ext_approval.php URL
         browser fetches it → gateway authorizes station → /success
         (identical to the consent flow from here on)
```

## Trust boundaries

- **The sponsor's click never authorizes the network directly.** It flips one
  row from PENDING to APPROVED. The network grant is the signed `ext_approval`
  URL, released only to the browser holding the signed session cookie, built by
  the same signer (`buildEcpApprovalUrl`) as the open path. There is exactly one
  authorization stack.
- **The emailed token authorizes reading and deciding one request** — nothing
  else. 32 random bytes, base64url; only its SHA-256 is stored; it is never
  logged. Malformed tokens are rejected before any lookup, and unknown tokens
  render the same page as malformed ones, so nothing can be enumerated.
- **GET is harmless by construction.** Enterprise mail scanners fetch every URL
  in a message, so the emailed Allow/Deny links land on a review page that
  mutates nothing (`?intent=` is a display hint). The decision is a POST from
  that page. A scanner can therefore never approve a guest.
- **The decision is exactly-once.** `UPDATE … WHERE status = 'PENDING' AND
  expiresAt > now()` — double clicks, replays, and a simultaneous approve/deny
  resolve to one winner inside Postgres. A denied request can never later
  become approved; a new request is the only path back.
- **Expiry is enforced on read.** `effectiveStatus()` decays overdue PENDING on
  every touch; the stored EXPIRED stamp is bookkeeping. Default TTL equals the
  portal session TTL (15 min): an approval after the guest's gateway token died
  cannot be redeemed, so a longer window only manufactures "approved but never
  online".

## Sponsor address validation

`lib/sponsorship/sponsorEmailPolicy.ts`, server-side, stricter than guest-field
email validation because this address selects who can grant access:

- printable ASCII only — Unicode homoglyph domains are refused wholesale;
- exact, case-insensitive domain match after the **last** `@`
  (`extremenetworks.com.example.org` and `a@extremenetworks.com@evil.org` both
  fail);
- structural local-part and DNS-label checks; no CR/LF/whitespace anywhere.

Client-side there is only `type=email` — UX, never authority.

## Privacy

Name and email are required on this path — a sponsor cannot vouch for an
anonymous request — and flow through the same registry, validation and storage
prohibition as every other guest field. Under "Do not store my personal data"
they are used transiently (they appear in the email the sponsor reads) and the
`SponsorshipRequest` row keeps nulls; the review page then identifies the
request by network context and MAC. `sponsorEmail` is retained regardless: who
vouched for a device is operational audit data, the same class as `revokedBy`.
Audit events and logs carry the sponsor's **domain**, never the mailbox.

## Email

`lib/email/transport.ts` — business logic, template and transport are separate.
Three transports: **Resend** (HTTPS API — required on Railway, which blocks all
outbound SMTP: 587/465/2525 measured dead from the container on 2026-08-31),
**SMTP** (nodemailer, for hosts with an open SMTP path; Ethereal works for
local demos), and a `console` transport that prints the rendered message to
the structured log for development, available in production only by explicit
`EMAIL_TRANSPORT=console` (the message contains the review URL). Delivery
failure cancels the request and tells the guest — nobody waits for an email
that never left. All interpolated values are control-character stripped;
recipients and subjects are refused outright if header-unsafe; HTML bodies are
escaped; the Resend key travels only in the Authorization header.

## Waiting behaviour

Plain bounded polling (4 s cadence, server-owned via `pollAfterMs`, budget
`SPONSORSHIP_MAX_STATUS_CHECKS` persisted on the row), for the same reason the
secure-onboarding page polls: captive webviews are the least dependable place
for SSE/WebSocket, and a missed event there has no recovery story. The endpoint
is bound to the signed session cookie — a guest can only ask about their own
visit.

## Configuration

| Variable | Meaning | Default |
|---|---|---|
| `SPONSOR_ALLOWED_DOMAINS` | comma-separated sponsor domains; empty ⇒ feature off | unset |
| `SPONSORSHIP_TTL_SECONDS` | decision window | `PORTAL_SESSION_TTL_SECONDS` |
| `SPONSORSHIP_MAX_PER_SESSION` | requests one session may create | `3` |
| `SPONSORSHIP_MAX_STATUS_CHECKS` | poll budget per request | `300` |
| `EMAIL_TRANSPORT` | `smtp` / `console` (console: explicit-only in prod) | auto |
| `EMAIL_FROM` | From header | `guest-portal@localhost` |
| `SMTP_URL` or `SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE`/`SMTP_USER`/`SMTP_PASSWORD` | relay | unset |

Multi-domain support already works (`SPONSOR_ALLOWED_DOMAINS=a.com,b.com`);
per-tenant policy, sponsor allowlists, Entra ID validation, and richer
notification channels are Phase 2 and slot in behind `sponsorEmailPolicy` and
the transport seam without schema changes.

## Audit trail

`SponsorshipRequest` holds who asked (`guestName`/`guestEmail`, policy
permitting, plus `clientMac`), who was asked (`sponsorEmail`), the outcome and
when (`approvedAt`/`deniedAt`/`decidedAt`, `decisionIp`, `decisionUserAgent`),
and when authorization was released (`authorizationIssuedAt`; the session's
`authorizedAt` records the gateway-confirmed grant). `AuditEvent` rows:
`SPONSORSHIP_REQUESTED`, `SPONSORSHIP_EMAIL_FAILED`, `SPONSORSHIP_APPROVED`,
`SPONSORSHIP_DENIED`, `SPONSORSHIP_EXPIRED`, `SPONSORSHIP_AUTHORIZATION_ISSUED`,
`SPONSORSHIP_AUTHORIZATION_FAILED`.

## Guest access duration

Approval inherits the existing session/gateway lifetime: the WLAN's session
timeout (3600 s) and the ledger row written at `/success` govern how long the
device stays online, exactly as on the open path. Sponsorship adds no second
duration framework.
