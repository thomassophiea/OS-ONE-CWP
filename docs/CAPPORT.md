# CAPPORT — Captive Portal API (RFC 8908 / RFC 8910)

Everything about the gateway below was measured against the live Campus
Controller on 2026-08-14. The RFC quotations are from the published texts at
rfc-editor.org.

## What this replaces

Captive-portal detection today is inference. The device fetches a well-known
probe URL, something intercepts the response, and the operating system guesses
from what comes back. This portal even keeps a hard-coded list of twelve probe
hostnames in `lib/captive/safeRedirect.ts` for exactly that reason.

CAPPORT replaces the guess with an answer:

- **RFC 8910** — the network tells the client *where the API is*: DHCPv4 option
  **114**, DHCPv6 option **103**, IPv6 RA option type **37**. The value is a URI
  (RFC 3986) and "SHOULD NOT contain an IP address literal".
- **RFC 8908** — the client asks that URI and gets a JSON document describing
  its own state.

Client support is real: **iOS 14+, Android 11+, recent macOS and Windows**.

## The document we serve

Media type `application/captive+json` (§8.1). `Cache-Control: private, no-store`
(§5: *"Captive Portal API servers SHOULD set the Cache-Control header field in
any responses to 'private' or a more restrictive value"*).

| Member | When we send it | Meaning |
|---|---|---|
| `captive` | always — it is the only required member | Is this client in captivity? |
| `user-portal-url` | only when captive | Where to go to get out |
| `venue-info-url` | only when **not** captive, and secure onboarding is configured | Secure Wi-Fi setup |
| `can-extend-session` | always | |
| `seconds-remaining` | when the session has a future expiry | From the session's own `expiresAt` |

`serializeCapportState` strips anything outside that set on the way out. The
IANA registry is closed (§8.2), so an unregistered key is a conformance bug, not
a harmless extra.

### Two judgement calls the RFC leaves open

**An online guest who has not finished secure setup is not captive.** Secure
Wi-Fi is offered through `venue-info-url` — which is precisely what RFC 8908
provides that member for. Putting it in `user-portal-url` would re-open a
sign-in sheet on a device that is already working.

**`ACCEPTED` is still captive.** The approval URL has been issued and the
gateway has not confirmed the role change. `captive: false` there would claim
access the network has not granted.

## The hard part: which client is asking?

RFC 8908 §4 assumes the API server can see the client:

> *"If the identifier used by the Captive Portal system is the client's set of
> IP addresses, the system needs to ensure that the same IP addresses are
> visible to both the API server and the enforcement device."*

**That does not hold for this portal.** It runs on Railway, off-network. Every
station at a site reaches it through the same NAT, so the source address
identifies the *site*, not the device. This is not a limitation to work around
— the RFC's next sentence is the design:

> *"If the API server needs information about the client identity that is not
> otherwise visible to it, the URI provided to the client during provisioning
> SHOULD be distinct per client."*

### Per-client URI — the reliable form

```
https://<portal>/captive-api/<token>
token = base64url(HMAC-SHA256(CAPPORT_TOKEN_SECRET, <mac, lowercase, colons>))[:43]
```

**Derived, not random**, and the ordering is why. DHCP hands out the URI before
the guest has ever reached the portal, so a token minted when a session is
created could not possibly be in a URI that already exists. An HMAC that both
sides compute from what they already hold needs no registration step, no lookup
service, and no ordering requirement between them. HMAC rather than a plain hash
so knowing a MAC does not let anyone ask about that device.

The portal stores only `sha256(token)` on `GuestSession.capportTokenHash`, so
the lookup is a unique-index hit.

The token is **read-only by construction**: it selects a session and produces a
state document. It cannot authorize a station, cannot reach a credential, and
never sets a cookie. A leaked one discloses one device's captive state.

An *unknown* token is answered rather than refused — a client holding a stale
URI needs to be told it is captive so it opens the portal. A 404 would leave it
with no state and no route out.

### Network-wide URI — the fallback

`https://<portal>/captive-api` identifies by, in order:

1. the session cookie, when the client's captive agent shares one;
2. the source address — **only** when exactly one live session carries it. Two
   candidates means unknown, not "probably the newest one";
3. nothing.

### When the client cannot be identified

We answer `captive: true` with `user-portal-url`. This is the safer of two wrong
answers, and the reasoning is worth keeping:

- Wrongly captive → the guest sees one redundant sign-in sheet. Tapping it lands
  on the portal, which *can* identify them from their cookie and immediately
  confirms they are connected. Recoverable, in one tap.
- Wrongly free → a genuinely captive guest is told the network is fine. No sheet
  opens. They have no route to the portal at all. A dead end.

## `user-portal-url` points at `/portal/entry`, not `/portal`

`/portal` is the ECP entry point. It only answers a redirect the access point
has signed byte-for-byte, so a client opening it directly is told its link isn't
valid. `/portal/entry` is the human-openable front door: it continues an
existing session, or gives the one instruction that works.

## What the network must do — and cannot, today

This is dormant until something emits option 114. **The Campus Controller
cannot.** Verified against the live controller:

| Checked | Result |
|---|---|
| Topology DHCP fields | `dhcpMode`, `dhcpServers`, start/end range, `dhcpDomain`, `dhcpDefaultLease`, `dhcpMaxLease`, `dhcpDnsServers` — **no custom/vendor option field** |
| Unregistered role's `cp*` fields | 22 of them, all redirect-interception (`cpRedirect`, `cpRedirectPorts`, `cpHttp`, `cpUseFQDN`, `cpAddSign`, …) — **no CAPPORT API URL** |
| `/v1/capport`, `/v3/capport`, `/v1/captiveportal`, `/v1/dhcp` | all `404` |

The lab topology runs `dhcpMode: DHCPNone` — DHCP is already external, which is
the opening. Any of these would light it up:

- the external DHCP server emits option 114 (ISC dhcpd: `option captive-portal-api-url`; Kea: `capture-portal`),
- the L3 gateway emits RA option 37 for IPv6,
- a future controller release exposes a custom-DHCP-option or CAPPORT field.

For the per-client form the DHCP integration needs `CAPPORT_TOKEN_SECRET` and
the client MAC, which it has from the lease.

## Configuration

| Variable | Meaning |
|---|---|
| `CAPPORT_TOKEN_SECRET` | Shared with whatever provisions option 114. Absent ⇒ only the network-wide route is useful. |

No other configuration. Both routes are always served — an endpoint nobody has
been told about is inert, so there is nothing to gate.

## What this does *not* fix

CAPPORT tells a device it is captive and where to go. It does not change the
fact that the captive-portal window and the real browser keep separate cookie
stores — see the hand-off in `SECURE_ONBOARDING.md`. The two are complementary:
CAPPORT gets the guest to the portal cleanly, the hand-off gets them out of the
mini-browser afterwards.

## Prior art at Extreme

Searched 2026-08-14 across Jira and Confluence:

- **No Jira issue** mentions CAPPORT, RFC 8908, RFC 8910 or DHCP option 114.
- **RFC 8908 appears nowhere** in Confluence.
- **RFC 8910 appears in exactly two pages**, both in the Universal ZTNA space
  for the EP1 Security cloud portal (epic UZ-1342), both authored May 2026, and
  both as a conditional aspiration rather than a design: *"Use RFC 8910 DHCP
  Option 114 where NAS supports it."* No ticket, no acceptance criteria.

So this appears to be the first implementation of the API itself in the estate.
