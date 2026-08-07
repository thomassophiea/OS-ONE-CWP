# Deployment

## Topology

```
station ──── AURA-CWP WLAN ──── AP5020 ──── XCC 192.168.100.12
   │                              │
   │  1. HTTP:80 intercepted, 307 signed redirect
   │
   ├──► https://os-one-cwp-production.up.railway.app/portal   (Railway)
   │         verifies SigV4, creates session ──► PostgresCWP
   │         /portal/consent  →  POST /api/accept
   │
   ├──► http://apcp.ezcloudx.com/ext_approval.php?...signed   (AP, on-link)
   │         gateway authorizes the station
   │
   └──► https://…/success?s=<id>  → marks AUTHORIZED → original destination
```

## Railway service: OS-ONE-CWP

- Repository `thomassophiea/OS-ONE-CWP`, branch `main`
- Builder: Railpack (auto-detected Next.js)
- Health check path: `/health`
- Start command: default (`next start`), binds Railway's `$PORT`

### Variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{PostgresCWP.DATABASE_URL}}` — service reference, private network |
| `NODE_ENV` | `production` |
| `APP_BASE_URL` | `https://os-one-cwp-production.up.railway.app` |
| `ECP_PATH` | `/portal` |
| `ALLOWED_HOSTS` | `os-one-cwp-production.up.railway.app` |
| `TRUST_PROXY` | `true` |
| `LOG_LEVEL` | `info` |
| `XCC_IDENTITY` | must equal the gateway role's `cpIdentity` |
| `XCC_SHARED_SECRET` | must equal the gateway role's `cpSharedKey` |
| `XCC_ALLOWED_GATEWAY_HOSTS` | `apcp.ezcloudx.com,192.168.100.12` |
| `SESSION_SECRET` | 32-byte random hex |
| `PORTAL_SESSION_TTL_SECONDS` | `900` |
| `ECP_APPROVAL_TTL_SECONDS` | `60` |
| `ECP_SIGNATURE_SKEW_SECONDS` | `300` |
| `ADMIN_TOKEN` | optional; unset disables `/admin/sessions` |

`DATABASE_URL` **must** reference `PostgresCWP`, not the shared `Postgres`
service used by the AURA application.

## Migrations

Migrations are not run automatically on deploy — the app image has no
privileged database step. Run them from a workstation with the public proxy
URL, or from a Railway shell:

```bash
DATABASE_URL="<PostgresCWP url>" npx prisma migrate deploy
```

The history was baselined against the pre-existing `db push` schema:

- `20260807000000_baseline_existing_schema` — marked applied via
  `prisma migrate resolve --applied`, never executed against the live database
- `20260807001000_ecp_session_model` — the real change; renames rather than
  drops every column with an equivalent in the new model, so existing session
  and audit rows survive

Verify there is no drift with:

```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
# expected output: "-- This is an empty migration."
```

## Gateway configuration (XCC 192.168.100.12)

WLAN `AURA-CWP` (`/management/v1/services/e21c4520-91f3-11f1-b355-751cfcce73ab`):

| Setting | Value |
|---|---|
| Captive portal | Enabled, type `External` |
| Unauthenticated role | `Unregistered role for AURA-CWP` (same UUID as the WLAN) |
| Authenticated role | `Enterprise User` |
| Default topology | `v1` (VLAN 1) — must match the sibling SSIDs on the AP profile |
| MAC-based auth | **disabled** |
| Session timeout | 3600 s |
| Post-auth idle timeout | 1800 s |
| Pre-auth idle timeout | 300 s |

Pre-authentication role (`/management/v3/roles/e21c4520-…`):

| Setting | Value |
|---|---|
| `cpRedirect` | `https://os-one-cwp-production.up.railway.app/portal` |
| `cpIdentity` | matches `XCC_IDENTITY` |
| `cpSharedKey` | matches `XCC_SHARED_SECRET` |
| `cpAddSign` | `true` |
| `cpRedirectUrlSelect` | `URLTARGET` (original destination) |
| `cpRedirectPorts` | `[80]` — 443 is not intercepted, which would break TLS |
| `cpHttp` | `true` (approval callback over HTTP; see ECP_PROTOCOL.md) |
| `defaultAction` | `deny` |

Walled garden (`l3Filters`, evaluated in order):

1. DNS udp/53, DNS tcp/53 — any address
2. DHCP udp/67 — any address
3. `192.168.100.12/32` tcp/80 and tcp/443 — controller
4. `os-one-cwp-production.up.railway.app` tcp/443 and tcp/80 — FQDN rule
   (`subnetType: "hostName"`)

The SSID must also be bound to a radio in the AP profile's `radioIfList`, or it
will not broadcast at all:

```
PUT /management/v3/profiles/6951f126-71c0-475c-b6de-f150d86d74f4
  radioIfList += { serviceId: "e21c4520-…", index: 1 }, { …, index: 2 }
```

## Rotating the shared secret

The gateway and Railway must change together; there is no overlap window.

1. `PUT /management/v3/roles/{wlanId}` with the new `cpSharedKey`
2. Set `XCC_SHARED_SECRET` on the Railway service
3. Wait for the AP config push (~30 s) and the Railway redeploy
4. Confirm with a fresh association — a mismatch surfaces as
   `REDIRECT_REJECTED / SIGNATURE_MISMATCH` in the audit table

## Rotating the database password

1. `ALTER USER postgres WITH PASSWORD '<new>'` on PostgresCWP
2. Update `PGPASSWORD`, `POSTGRES_PASSWORD`, `DATABASE_URL` and
   `DATABASE_PUBLIC_URL` on the PostgresCWP service
3. OS-ONE-CWP picks the new value up automatically through the
   `${{PostgresCWP.DATABASE_URL}}` reference

## Rollback

### Gateway — restore the previous WLAN state

The pre-change configuration of every object touched was captured before any
write. To revert, `PUT` these back:

```
/management/v3/roles/e21c4520-91f3-11f1-b355-751cfcce73ab
   cpRedirect="" cpIdentity="" cpSharedKey="" cpAddSign=false
   cpHttp=false  cpRedirectPorts=[80,443]  l3Filters=[]
/management/v1/services/e21c4520-91f3-11f1-b355-751cfcce73ab
   defaultTopology="efd5f044-26c8-11e7-93ae-92361f002671"   (Bridged at AP untagged)
   mbaAuthorization=true  mbatimeoutRoleId=null  sessionTimeout=0
/management/v3/profiles/6951f126-71c0-475c-b6de-f150d86d74f4
   remove the two radioIfList entries whose serviceId is the AURA-CWP WLAN id
```

Note the topology and profile changes are coupled: reverting `defaultTopology`
to *Bridged at AP untagged* while the WLAN is still bound to the AP5020 profile
reproduces the VLAN-conflict error, so remove the `radioIfList` entries first.

### Disable the external portal without unwinding anything

Clear `cpRedirect` on the pre-auth role. Stations then stay in the
unauthenticated role with no portal to send them to.

### Disable the test WLAN entirely

`PUT /management/v1/services/{wlanId}` with `status: "disabled"`. This is also
how station sessions are flushed during testing.

### Railway — restore the previous deployment

Redeploy an earlier deployment from the service's Deployments tab, or:

```
mutation { deploymentRollback(id: "<previous deployment id>") }
```

The variables are versioned separately; rolling the deployment back does not
restore deleted variables. `XCC_CONTROLLER_IP`, `XCC_ALLOW_INSECURE_CALLBACK`,
`ALLOWED_REDIRECT_DOMAINS` and `DEFAULT_SUCCESS_URL` were removed and would need
re-adding for a rollback past commit `dcddb71`.

### Git

```bash
git revert --no-commit dcddb71..HEAD && git commit
```

### Database

The forward migration renames rather than drops, so it is reversible. Reverse it
by renaming the columns back, dropping the added ones, and recreating the old
enum:

```sql
ALTER TABLE "GuestSession" RENAME COLUMN "gatewayToken"  TO "sessionToken";
ALTER TABLE "GuestSession" RENAME COLUMN "gatewayHost"   TO "hwcIp";
ALTER TABLE "GuestSession" RENAME COLUMN "gatewayPort"   TO "hwcPort";
ALTER TABLE "GuestSession" RENAME COLUMN "clientIp"      TO "userIp";
ALTER TABLE "GuestSession" RENAME COLUMN "originalDest"  TO "dest";
ALTER TABLE "GuestSession" RENAME COLUMN "preAuthRole"   TO "role";
ALTER TABLE "GuestSession" RENAME COLUMN "apName"        TO "ap";
ALTER TABLE "GuestSession" RENAME COLUMN "apLocation"    TO "aploc";
ALTER TABLE "GuestSession" RENAME COLUMN "apSerial"      TO "sn";
ALTER TABLE "GuestSession" RENAME COLUMN "gatewayParams" TO "rawQuery";
ALTER TABLE "GuestSession" RENAME COLUMN "requestHeaders" TO "rawHeaders";
ALTER TABLE "GuestSession"
  DROP COLUMN "clientMacRaw", DROP COLUMN "bssid", DROP COLUMN "vns",
  DROP COLUMN "redirectSignature", DROP COLUMN "redirectSignedAt",
  DROP COLUMN "redirectExpiresAt", DROP COLUMN "sanitizedDest",
  DROP COLUMN "destRejectionReason", DROP COLUMN "csrfTokenHash",
  DROP COLUMN "authorizationAttemptedAt", DROP COLUMN "authorizedAt",
  DROP COLUMN "authorizationResult", DROP COLUMN "failureReason",
  DROP COLUMN "authorizedRole", DROP COLUMN "disconnectedAt";
ALTER TABLE "AuditEvent" DROP COLUMN "severity";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260807001000_ecp_session_model';
```

Rows added since the migration whose status is one of the four new enum values
must be mapped to an old value before the enum can be recreated. Take a dump
first: the columns dropped here (the whole authorization record) have no
equivalent in the old schema and are not recoverable afterwards.
