# XCC External Captive Portal protocol

Everything here was measured against a live ExtremeCloud IQ Controller
(`192.168.100.12`, management API on port 5825) driving an AP5020 on the
`AURA-CWP` WLAN, on 2026-08-07. Nothing in this document is inferred from
vendor documentation.

## Where the configuration lives

The External Captive Portal settings are **not** on the WLAN service object.
They live on the WLAN's *pre-authentication role*, whose id is the same UUID as
the WLAN service:

```
GET  /management/v1/services/{wlanId}     -> enableCaptivePortal, captivePortalType
GET  /management/v3/roles/{wlanId}        -> cpRedirect, cpIdentity, cpSharedKey, ...
```

Relevant role fields:

| Field | Meaning |
|---|---|
| `cpRedirect` | ECP URL the station is redirected to |
| `cpIdentity` | SigV4 access-key id (`XCC_IDENTITY`) |
| `cpSharedKey` | SigV4 secret (`XCC_SHARED_SECRET`) |
| `cpAddSign` | when true, the redirect is signed |
| `cpAdd*` | which parameters are appended to the redirect |
| `cpRedirectPorts` | TCP ports intercepted and redirected (we use `[80]`) |
| `cpHttp` | **inverted** in the UI — `false` means "Use HTTPS connection" is checked |
| `cpRedirectUrlSelect` | `URLTARGET` = original destination, `URLCUSTOMIZED` = fixed URL |
| `l3Filters` | walled-garden rules; `subnetType: "hostName"` allows FQDN entries |
| `defaultAction` | `deny` for a pre-auth role |

## 1. Redirect (gateway → station → portal)

An unauthenticated station's HTTP request on a port in `cpRedirectPorts` is
answered by the AP's redirector with `307` to `cpRedirect` plus:

```
X-Amz-Algorithm=AWS4-HMAC-SHA256
X-Amz-Credential=<identity>/<YYYYMMDD>/world/ecp/aws4_request
X-Amz-Date=<YYYYMMDDThhmmssZ>
X-Amz-Expires=20
X-Amz-SignedHeaders=host
ap=<AP name, punctuation stripped>   aploc=<site>       apmac=<12 hex>
bssid=<12 hex>                       dest=<original destination, no scheme>
hwc_ip=<ECP callback host>           hwc_port=<80|443>
mac=<station MAC, 12 lowercase hex>  role=<pre-auth role name>
sn=<AP serial>                       ssid=<SSID>        vns=<VNS name>
token=<opaque station token>         vlan=<n>           wlan=<WLAN index>
X-Amz-Signature=<hex>
```

The redirector only emits the `307` for requests that look like a browser: a
request without `Accept: text/html` gets a "Redirection Error" page instead.

### Signature

Standard AWS SigV4 presigned-URL construction with:

```
region  = world
service = ecp
payload = UNSIGNED-PAYLOAD
signed headers = host
```

**The controller signs the query string exactly as it emits it.** It leaves `!`
unencoded in `token`, so a canonical query string rebuilt from decoded
parameters will not match. Verification must strip only the
`X-Amz-Signature=...` pair and leave every other byte untouched
(`lib/captive/ecpSigV4.ts`).

`X-Amz-Expires` is **20 seconds** — long enough to load the portal, far too
short to survive a guest reading terms and conditions. The signature is
therefore verified once, at portal entry.

## 2. Approval (portal → station → gateway)

The station is authorized by fetching a presigned URL at:

```
<http|https>://<hwc_ip>[:<hwc_port>]/ext_approval.php
  ?token=<token from the redirect>
  &username=<station MAC, exactly as the redirect spelled it>
  &wlan=<WLAN index>
  &dest=<destination to send the browser to>
  &X-Amz-* ... &X-Amz-Signature=<hex>
```

Signed identically to the redirect, over `GET /ext_approval.php` with
`host:<hwc_ip[:port]>`.

Scheme follows `hwc_port`: `80` → `http`, otherwise `https`.

**This request must be made by the station's browser, not by the portal
server.** `hwc_ip` is `apcp.ezcloudx.com`, which resolves publicly to
`1.1.1.1`; on the wireless link the AP intercepts that name and serves the ECP
handler itself. Railway cannot reach it. Issuing a `303` to the signed URL is
the protocol's intended shape.

Responses (HTTP 200 either way — check the body):

| Outcome | Body contains |
|---|---|
| success | `window.location.href="<dest>"` |
| failure | `Failed to authenticate: <reason>` inside `#finalBox` |

`dest` may be a full `https://` URL including a query string; the gateway
round-trips it verbatim. This portal exploits that by pointing `dest` at its
own `/success?s=<sessionId>` page, so arrival there is proof the gateway
authorized the station. The guest's real destination is forwarded from there.

## 3. Result

After a successful approval the station's role changes from the pre-auth role
to the WLAN's `authenticatedUserDefaultRoleID`:

```
GET /management/v1/stations
  "macAddress": "66:DF:FD:68:BA:25",
  "role":       "Enterprise User",      # was "Unregistered role for AURA-CWP"
  "userName":   "66dffd68ba25"          # the `username` we sent
```

## Known limitations

- **`apcp.ezcloudx.com` certificate expired 2026-04-15.** The AP presents a
  genuine DigiCert certificate for that name, shipped in firmware, and it is
  out of date. An HTTPS approval callback therefore fails validation in a real
  browser. The deployment runs with `cpHttp = true` so the approval hop uses
  plain HTTP to the on-link AP; the guest-facing portal stays on HTTPS with a
  valid Railway certificate. Fixing this properly requires an AP firmware
  update from Extreme.
- **Walled-garden FQDN rules depend on DNS interception.** The AP learns the
  portal's address from the station's DNS queries. A client using DNS-over-HTTPS
  or a resolver outside the WLAN will not be reachable to the portal until an
  IP-literal rule is added as well.
