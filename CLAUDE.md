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
