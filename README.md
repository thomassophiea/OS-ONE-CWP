# OS-ONE-CWP

A lightweight cloud-hosted Captive Web Portal proof of concept for Extreme Campus Controller External CWP/UAP workflows.

## What this is

OS-ONE-CWP is a basic external captive portal endpoint. When an Extreme Campus Controller redirects a guest device to this service, it:

1. Captures all query parameters the controller provides
2. Captures request headers and source IP (sensitive headers scrubbed before storage)
3. Creates a persisted guest session record in PostgreSQL
4. Displays Terms and Conditions to the guest
5. Records acceptance with a timestamp and audit event
6. Safely redirects the guest to the controller-specified destination URL

## What this is not

- Not Extreme Guest Essentials
- Not a marketing or loyalty platform
- Not a social login platform
- No sponsor approval workflows
- No voucher codes or PPSK management
- No email or SMS
- No multi-tenancy

## Phase 1 Scope

- [x] External redirect landing page (`/portal`)
- [x] Terms and Conditions acceptance
- [x] Guest session logging with all controller-provided fields
- [x] Raw query parameter capture
- [x] Raw header capture (auth/cookie headers scrubbed)
- [x] Source IP detection (proxy-aware: Cloudflare → X-Forwarded-For → X-Real-IP)
- [x] Safe redirect validation (blocks javascript:, data:, file:, vbscript:, protocol-relative)
- [x] Admin session viewer (`/admin/sessions`)
- [x] Session detail page with raw data and audit log

## Phase 1 Security Limitations

These are known and accepted for the proof-of-concept phase:

- **`/admin` has no authentication.** Before any real-world use, protect these routes behind a reverse proxy, VPN, or middleware. Do not expose them publicly.
- **`/api/accept` has no session binding.** A client with a guessed sessionId could mark it accepted. Risk is low (CUIDs are non-enumerable, accept does not grant network access — the XCC controller controls that), but should be fixed in Phase 2 with HMAC-signed tokens.
- **`/success?session=` leaks a session ID in the URL.** Only clientMac, ssid, and acceptedAt are exposed. The CUID is non-enumerable.

## Local Setup

### Prerequisites

- Node.js 18+
- PostgreSQL running locally

### Steps

```bash
git clone https://github.com/thomassophiea/OS-ONE-CWP.git
cd OS-ONE-CWP
npm install
cp .env.example .env
# Edit .env — set DATABASE_URL to your local Postgres connection string
npx prisma migrate dev
npm run dev
```

App runs at http://localhost:3000

## Railway Setup

1. Connect this GitHub repo to Railway
2. Add a **PostgreSQL** service in Railway (Database → Add)
3. Railway automatically injects `DATABASE_URL` from the Postgres service
4. Set these environment variables in Railway → your service → Variables:
   - `APP_BASE_URL=https://os-one-cwp-production.up.railway.app`
   - `ALLOWED_REDIRECT_DOMAINS=` (leave blank for Phase 1, or restrict to known domains)
   - `NODE_ENV=production`
5. Deploy (Railway auto-deploys on push to main)
6. After first successful deploy, run the database migration via Railway shell:
   ```bash
   npx prisma migrate deploy
   ```

## Test URLs

**Portal (simulates a controller redirect):**
```
https://os-one-cwp-production.up.railway.app/portal?client_mac=AA:BB:CC:DD:EE:FF&ssid=GuestWiFi&redirect_url=https://example.com
```

**Admin sessions list:**
```
https://os-one-cwp-production.up.railway.app/admin/sessions
```

## Extreme Campus Controller Test Plan

1. Create a test WLAN/SSID on the controller
2. Enable captive portal using **External CWP / UAP** mode
3. Set the external portal URL to:
   ```
   https://os-one-cwp-production.up.railway.app/portal
   ```
4. Connect a phone or laptop to the SSID
5. Confirm the controller redirects the browser to OS-ONE-CWP
6. Review and accept the Terms and Conditions
7. Confirm the redirect behavior (does the controller handle post-auth, or does the portal?)
8. Check `/admin/sessions` for the captured session record
9. Open the session detail page
10. Copy the raw query parameters and raw headers — this reveals exactly what the real controller sends

## Unknowns to Validate with Real Controller

- Exact query parameter names the XCC uses for client MAC, AP MAC, redirect URL
- Whether the controller redirects the client after portal acceptance, or the portal must redirect
- Whether the controller expects a specific success URL format
- Whether the controller requires a token echoed back in the success redirect
- Whether the controller requires an API callback to authorize the session
- Whether the controller requires RADIUS accounting
- Whether authorization is based purely on the portal redirect or an external callback to the controller

## Roadmap — Next Phases

After validating redirect behavior with a real controller:

1. Admin authentication (middleware with JWT or session-based auth)
2. Portal branding and custom themes per SSID
3. Multiple portal profiles
4. Self-registration (name + email capture)
5. Sponsor approval workflow
6. Voucher / one-time-code support
7. HMAC-signed session tokens for `/api/accept`
8. Controller-specific authorization callback (if required by XCC)
9. Local hosting / container packaging

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `APP_BASE_URL` | Yes | Public URL of this deployment (no trailing slash) |
| `ALLOWED_REDIRECT_DOMAINS` | No | Comma-separated allowed redirect domains. Blank = allow any https URL |
| `DEFAULT_SUCCESS_URL` | No | Override fallback redirect after acceptance |
| `NODE_ENV` | No | Set to `production` on Railway |
