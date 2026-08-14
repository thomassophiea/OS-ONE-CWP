@AGENTS.md

## Internal guest API

`/api/internal/guests` is a service-to-service surface consumed by AURA, which is
the management plane for guests. It is **disabled outright** unless
`INTERNAL_API_TOKEN` (≥24 chars) is set — a missing token must never mean "open".

`GuestAuthorization` is the standing answer to "may this device use the guest
network?", one row per MAC. `GuestSession` is unchanged and remains the per-visit
audit record.

The portal consults the ledger on every verified redirect:

- `REVOKED` → refused at `/portal/error?code=revoked`, before a session is minted.
- `MANUAL` + `ACTIVE` → consent skipped; the signed `/ext_approval.php` URL is
  issued directly. This is what makes "add a MAC in AURA" actually grant access.
- `CAPTIVE_PORTAL` + `ACTIVE` → consent shown as before. A past visit is
  deliberately **not** a standing bypass.

Full design: `docs/GUEST_MANAGEMENT.md` in the AURA repo.

## Secure Guest Access

The captive portal offers two workflows from one consent form. The open path is
unchanged and is what runs when `GuestSession.onboardingRequested` is false —
its default. That boolean is written at `/api/accept` from which submit button
was pressed and read once, at `/success`; the consent gate, the presigned
approval URL and the gateway callback are identical either way.

Secure onboarding runs **after** the gateway has authorized the station, because
the device needs real internet access to download a profile, reach Settings and
come back.

`COMPLETED` on an `OnboardingSession` means one thing only: the controller
reported that MAC on the secure WLAN's `serviceId`. A downloaded profile or a
rendered QR code is not evidence of a join and must never be recorded as one.

Credential material never reaches `OnboardingSession`, the JavaScript bundle,
any URL or any log line. It is read from the gateway at issue time and appears
only inside a provisioning artifact or the body of `POST /credential`.

Full design, per-platform mechanisms and the PPSK integration point:
`docs/SECURE_ONBOARDING.md`.

## Captive Portal API (RFC 8908)

`/captive-api` and `/captive-api/{token}` serve the standards-track alternative
to probe-and-infer captive detection. Dormant until the network emits DHCP
option 114 — the Campus Controller cannot, so nothing reaches these routes yet.

Two invariants, both load-bearing and both tested:

- **An unidentified client is told `captive: true`.** Wrongly captive costs one
  redundant sign-in sheet that resolves on tap; wrongly free leaves a captive
  guest with no route to the portal.
- **An online guest with unfinished secure setup is not captive.** Secure Wi-Fi
  is advertised through `venue-info-url`, never `user-portal-url`.

The per-client token is an HMAC of the station MAC, not a random per-session
value: DHCP hands out the URI before the session exists.

Full design and the gateway findings: `docs/CAPPORT.md`.

## Storage prohibition and localisation

`GuestSession.personalDataAllowed` is the session-level answer to "may personal
data from this guest be written?". It is set once, on the server, from the
consent form, and read by every write afterwards. Two rules it exists to keep:

- **Avoid the write, never undo it.** `forPersistence` and
  `forLedgerPersistence` strip personal values before a query is built. Do not
  add a deletion pass — data that was written and deleted still existed in a WAL
  segment and any backup taken in between.
- **Operational is not personal.** MAC, AP, gateway token and timestamps are how
  the network functions and are always kept. What the guest typed about
  themselves is what the prohibition covers, and
  `GuestFieldDefinition.personal` is the only place that judgement lives.

Guest fields are declared once in `lib/guestFields/registry.ts` and read by the
form, the catalogues, validation, the API, the ledger and the privacy filter. A
new field is one entry; it defaults to `personal: true`.

The logger redacts personal keys unconditionally. Do not make it conditional on
a session — the call site that forgets is the leak.

Eight locales in `lib/i18n/locales/`, typed against English so a missing key is a
build error. Detection is cookie, then `Accept-Language`, then English — never
geolocation. SSIDs, security modes, `netsh` and `Settings` stay untranslated
because a guest has to find them on their own screen.

Full design: `docs/PRIVACY_AND_I18N.md`.
