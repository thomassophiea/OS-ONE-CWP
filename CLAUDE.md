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
