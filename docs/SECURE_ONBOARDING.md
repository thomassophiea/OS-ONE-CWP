# Secure Guest Access

Everything measured here was measured against the live gateway
(`tsophiea.ddns.net`, XCC driving AP5020s) and the deployed Integration portal
on 2026-08-14. Nothing is inferred from vendor documentation.

## Two workflows, one portal

```
                     Open guest WLAN (AURA-CWP)
                                │
                       Captive Web Portal
                                │
                       User agreement (one form)
                                │
                ┌───────────────┴────────────────┐
     Connect to the Internet          Accept & Connect Securely
                │                                │
                └──────────► identical ◄─────────┘
                     signed /ext_approval.php
                     gateway authorizes station
                                │
                        GET /success  (AUTHORIZED)
                                │
                ┌───────────────┴────────────────┐
     original destination                 /portal/secure
        (unchanged)                              │
                                     device-aware provisioning
                                                 │
                                         Skynet (WPA2-PSK)
```

**The two paths differ in exactly one place.** `GuestSession.onboardingRequested`
is a boolean with a default of `false`, written at `/api/accept` from which
submit button was pressed, and read once, at `/success`. The consent gate, the
CSRF token, the presigned approval URL, the gateway callback and the role change
are byte-for-byte the same in both. A guest who never taps the secure option
cannot reach any onboarding code, and nothing on the open path waits on the
gateway, the credential provider or device detection.

If the secure WLAN is not configured, or its configuration cannot be read, the
second button is simply not drawn. That is the intended failure mode: the
feature can be unavailable, but it can never make getting online harder.

**Secure setup runs after authorization, deliberately.** The device needs real
internet access to download a configuration profile, to reach Settings, and to
come back. So the guest is put online first, and `/portal/secure` says so before
it says anything else.

## The secure WLAN, as actually configured

`GET /management/v1/services/c8d4880b-2a54-424e-9459-46c02425f587`:

| | |
|---|---|
| SSID | `Skynet` |
| Privacy element | `WpaPskElement`, `mode: aesOnly` → **WPA2 Personal (CCMP)** |
| PMF | `disabled` |
| Key encoding | ASCII passphrase (`keyHexEncoded: false`) |
| Broadcast | `suppressSsid: false` |
| Captive portal | disabled |
| Topology | `3ad88dfd-…` — the same topology as the guest WLAN |
| Authenticated role | `Enterprise User` |

Everything below follows from that row. WPA2-Personal is what Apple's
`EncryptionType: WPA` and the `WIFI:T:WPA` QR grammar can both express, which is
why both mechanisms are available at all. On a WPA3-only network neither can be,
and `planFor` withdraws them rather than offering a button that fails silently.

## What each platform actually gets

The user-facing action is **Set Up Secure Wi-Fi** everywhere. What it resolves
to is not the same everywhere, and pretending otherwise is how a guest ends up
tapping something that does nothing.

| Platform | Primary | Also offered | Why |
|---|---|---|---|
| iPhone | Apple configuration profile | Manual, QR (for another device) | The only mechanism iOS has for installing a network from a web page. |
| iPad | Apple configuration profile | QR, Manual | Same. QR ranks above manual because an iPad is a plausible second screen. |
| Mac | Apple configuration profile | QR, Manual | Installed from System Settings › General › VPN & Device Management. |
| Android | **Manual** | QR (for another device) | Android has **no** web-installable Wi-Fi profile. Its native mechanism is the camera scanning a Wi-Fi QR — which a phone cannot point at its own screen. |
| Windows | **Manual** | Downloadable WLAN profile, QR | Windows can import a profile, but only via `netsh wlan add profile` from a downloaded file. That is one command from the guest, so it is secondary. |
| Unknown | Manual | QR | Always available, never wrong. |

**QR is never primary on a phone.** It is offered, and it is labelled for
another device, because the trap this table exists to avoid is leaving a guest
trying to scan their own screen.

## The captive mini-browser

iOS's Captive Network Assistant and Android's captive-portal window are webviews,
not browsers. The assistant cannot install a configuration profile and cannot
reach Settings.

It is detected server-side by the same signature `lib/captive/safeRedirect.ts`
already uses — bare `AppleWebKit/…` with no product token — and reported to the
page as `captiveAssistant`. On an Apple device the page then leads with getting
out of it:

- **Open in Safari** — an `x-safari-https://…` link, the scheme iOS uses to hand
  a URL from an embedded webview to full Safari. It is not guaranteed on every
  iOS build, so the plain link sits underneath it.
- **Manual Setup**, beside it, which needs neither Safari nor Settings and
  therefore works inside the assistant.

Once the gateway has authorized the station, the assistant may close itself
because connectivity is restored. The guest is already online when that happens;
they can reopen the portal in Safari and the session cookie is still valid for
`PORTAL_SESSION_TTL_SECONDS`.

## API

Resource-oriented, under `/api/v1/onboarding`. Every route requires the
onboarding token — an HttpOnly cookie holding 32 random bytes, stored only as a
SHA-256, compared in constant time. The onboarding id travels in URLs and is
therefore never sufficient on its own.

| | | |
|---|---|---|
| `POST` | `/sessions` | Start onboarding. Requires an authorized portal session. Returns the method plan and a non-secret network description. |
| `GET` | `/sessions/{id}` | Current state. Never returns a credential. |
| `GET` | `/sessions/{id}/profile` | Apple `.mobileconfig`. |
| `GET` | `/sessions/{id}/windows-profile` | Windows WLAN profile XML. |
| `GET` | `/sessions/{id}/qr` | Wi-Fi QR as SVG. |
| `POST` | `/sessions/{id}/credential` | Reveal the passphrase for manual entry. |
| `GET` | `/sessions/{id}/status` | Ask the gateway whether the device joined. |

`/profile` and `/windows-profile` are `GET` because iOS will only hand a
`.mobileconfig` to Settings on a top-level navigation — a `fetch()` body cannot
be installed. `/credential` is a `POST` for the opposite reason: its body *is*
the passphrase, and a `GET` could be bookmarked, prefetched, linked, restored by
a back-navigation, or left in history.

Refusals are deliberately indistinguishable. "No such onboarding", "wrong token"
and "expired" all answer `404`, so the difference cannot be used to enumerate
ids.

## Status, and what it is allowed to claim

```
OFFERED → STARTED → PROFILE_DOWNLOADED / QR_DISPLAYED / MANUAL_SETUP_VIEWED
                                    ↓
                              COMPLETED      (gateway-confirmed only)
                              FAILED / EXPIRED
```

**`COMPLETED` is set in exactly one place**, `verifyJoin`, and only when the
controller's station list reports this MAC with `serviceId` equal to the secure
WLAN's. Handing over a profile or drawing a QR code is not evidence that
anything joined anything, and those statuses never advance past their own names.

Verified against the live controller on 2026-08-14 using a MAC the gateway
reported on Skynet: `state: completed`, `accessPointName: AP5020-PVT-02`.

### The honest limitation

A device using a **randomised (private) MAC per SSID** appears on the secure
WLAN as a *different* station, and this correlation will never see it. That
produces `exhausted` after the poll budget — not a false `COMPLETED` — and the
page says so:

> We stopped checking. If your device is set to use a private Wi-Fi address, we
> can't confirm the switch from here — open your Wi-Fi settings to see whether
> you're on Skynet.

`unavailable` is reported when the gateway could not be asked at all, rather
than leaving the guest on "pending" forever.

## Polling

The gateway question is "where is every station right now", not "where is this
one", so `verifyJoin` reads the **bulk** `/v1/stations` endpoint through a
6-second shared cache with in-flight collapsing. Ten guests polling every five
seconds produce one gateway request every few seconds in total, not ten.

The cadence is the server's — `pollAfterMs` in the status response — so it can
be widened without shipping a new bundle, and it stops the moment the answer is
terminal. `ONBOARDING_MAX_CHECKS` (default 60) is a persisted per-session budget
on top, so a page left open on a locked phone cannot become a permanent poller.

## Credential handling

The passphrase is read from the **gateway**, not from configuration:
`skynetProvider` fetches `/v1/services/{id}` and derives both the security mode
and the key from the live `privacy` element, cached for five minutes. Rotating
the key or moving to WPA3 on the controller therefore cannot leave the portal
handing out a stale credential or mislabelling the network.

`SECURE_WLAN_PSK` is a **fallback**, not the source of truth. It exists so a
gateway outage degrades the secure workflow to "works, from last known
configuration" instead of "unavailable".

Where the credential is allowed to appear:

- inside a `.mobileconfig` body, `no-store`, `Content-Disposition: attachment`
- inside a Windows WLAN profile body, same headers
- encoded as QR modules in an SVG, `no-store`
- in the JSON body of `POST /credential`, `no-store`, after an explicit tap

Where it is not, and this is asserted rather than assumed:

- not in `OnboardingSession` — the table holds no credential column at all
- not in the JavaScript bundle (623 KB scanned in a real browser per platform)
- not in server-rendered HTML, `localStorage`, `sessionStorage`, or any URL
- not in Railway build or runtime logs. `secure_credential_issued` records the
  onboarding id, provider, source, SSID, security mode and platform — the act,
  never the material. `lib/log.ts` redacts by key name as a second line.

## Apple profile signing

**The profile is unsigned**, and iOS therefore shows it as *Unverified* in red
on the install screen. It installs and works.

Signing needs a code-signing identity the device already trusts. No such
identity exists in this environment, and the Railway TLS certificate's private
key is not available to the application. Standing up a PKI to remove a warning
would be more moving parts than the warning is worth, so the behaviour is
documented rather than hidden. If a trusted identity appears later, signing is a
change to `buildAppleWifiProfile` alone.

Payload UUIDs are derived from `(onboarding session, SSID)` and the payload
identifier from the SSID, so a guest who taps twice replaces the profile instead
of stacking duplicates in Settings, while two guests never collide.

## Where PPSK plugs in

```
             /portal/secure   ─┐
             method plan       │  none of this changes
             Apple / QR / manual / Windows adapters
             onboarding session lifecycle
             join verification
                               ┘
                      CredentialProvider
                               │
              ┌────────────────┴────────────────┐
     skynetProvider  [now]              PPSKProvider  [later]
     shared WPA2 key                    per-device key
     read from the gateway              minted per onboarding
     perDevice: false                   perDevice: true
```

`CredentialProvider` has two methods. `describe()` returns the non-secret
network (SSID, security mode) and is safe to call from anywhere. `issue(context)`
returns credential material and is called only from a route that has already
validated an onboarding session; it receives the onboarding id, the client MAC
and the platform, which is everything a per-device provider needs to mint a key.

A PPSK provider becomes a second implementation of those two methods plus a
branch in `credentialProviderFor(context)` — which already takes the session
context rather than being a constant, precisely so that branch has somewhere to
go. `SecureNetworkCredential.perDevice` and `expiresAt` exist for it: the UI
never says "your password" today because today it is not true, and it will not
need rewriting when it becomes true.

What will **not** need rebuilding: the iPhone and Android flows, the QR handling,
the manual fallback, platform detection, the onboarding session model, the audit
events, the join verification, or any page.

`OnboardingSession.credentialProvider` records which provider answered, so a
session remains interpretable after the provider set changes.

## Configuration

| Variable | Meaning |
|---|---|
| `SECURE_WLAN_SSID` | SSID of the secure WLAN. Absent ⇒ the secure option is not offered. |
| `SECURE_WLAN_SERVICE_ID` | Gateway service id. Used to read the live WLAN **and** to verify a join. |
| `SECURE_WLAN_PSK` | Fallback passphrase, used only when the gateway cannot be read. |
| `GATEWAY_API_BASE_URL` | Management-API proxy base, e.g. `https://integration.up.railway.app/api/management`. |
| `GATEWAY_CONTROLLER_URL` | Value sent as `X-Controller-URL`. |
| `GATEWAY_USERNAME` / `GATEWAY_PASSWORD` | Credentials for minting a controller token. |
| `ONBOARDING_TTL_SECONDS` | Onboarding session lifetime. Default 1800. |
| `ONBOARDING_MAX_CHECKS` | Join-verification poll budget per session. Default 60. |

All are optional. Every one of them missing means the portal offers the open
guest path and nothing else — which is exactly the behaviour that existed before
this feature.

## Gateway changes

**None.** This feature only reads: `GET /v1/services/{id}` for the WLAN
configuration and `GET /v1/stations` for join verification. No WLAN, role, AAA
policy, topology or radio binding was created or modified, and the Skynet
passphrase was not rotated.
