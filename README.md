# OS-ONE-CWP

An externally hosted Captive Web Portal for the ExtremeCloud IQ Controller (XCC)
External Captive Portal (ECP) workflow.

A guest joins the WLAN, the access point intercepts their first HTTP request and
redirects them here with a signed set of parameters, they accept the terms, and
this service hands their browser a signed authorization URL that moves the
station into its authenticated role. Every step is recorded.

## Flow

```
station ──── guest WLAN ──── access point ──── XCC
   │                            │
   │  1. HTTP intercepted, 307 to the ECP URL, SigV4-signed
   ├──► GET  /portal            verify signature → create session → signed cookie
   ├──►      /portal/consent    terms + CSRF-protected form
   ├──► POST /api/accept        issue the presigned /ext_approval.php URL
   ├──► GET  <gateway>/ext_approval.php   gateway authorizes the station
   └──► GET  /success           record AUTHORIZED → forward to the original page
```

The authorization callback is made by the **browser**, not by this server. The
ECP handler lives on the access point serving the station and is only reachable
from the wireless link. Full protocol notes, measured against a live controller:
[`docs/ECP_PROTOCOL.md`](docs/ECP_PROTOCOL.md).

## What it does

- Verifies the AWS SigV4 signature on every gateway redirect, against the raw
  query string, with expiry and clock-skew bounds
- Validates the shape of every gateway parameter and refuses malformed requests
- Constrains the ECP callback host to an explicit allowlist
- Sanitises the guest's original destination (rejects `javascript:`, `data:`,
  `file:`, protocol-relative and control-character forms) and falls back safely
- Binds the browser to a server-side session with a signed HttpOnly cookie;
  a fresh session is minted on every verified redirect, so it cannot be fixated
- Protects the consent form with a single-use CSRF token, checked against both
  a server-side hash and an HttpOnly cookie
- Treats a replayed redirect and a resubmitted form as idempotent, never as a
  second authorization
- Records the session, the authorization outcome and a full audit trail in a
  dedicated Postgres database
- Reports readiness at `/health`, logs structured JSON with secret redaction,
  and shows guests controlled error pages rather than stack traces

## What it is not

Not Extreme Guest Essentials. No social login, sponsor approval, vouchers,
PPSK, email/SMS, or multi-tenancy.

## Routes

| Route | Purpose |
|---|---|
| `/portal` | ECP entry point — configure this as the gateway's ECP URL |
| `/portal/consent` | Terms and acceptance form |
| `/portal/error` | Controlled error pages |
| `/api/accept` | Issues the presigned gateway authorization URL |
| `/success` | Authorization receipt; forwards to the original destination |
| `/health` | Configuration + database probe |
| `/admin/sessions` | Session browser — requires `?k=<ADMIN_TOKEN>`, disabled when unset |

## Local setup

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, XCC_*, SESSION_SECRET
npx prisma migrate deploy
npm run dev
```

`/portal` requires a validly signed request, so it cannot be exercised by hand.
Drive it from a real gateway, or sign a request with the same shared secret.

```bash
npm test          # 94 tests, including a conformance check against a
                  # signature captured from a live AP5020
npm run type-check
```

## Deployment

Railway service `OS-ONE-CWP`, backed by the dedicated `PostgresCWP` database.
Variables, gateway settings, migration procedure, secret rotation and rollback:
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
