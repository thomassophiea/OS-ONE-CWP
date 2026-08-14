# Storage prohibition and localisation

Two features that turned out to be the same shape: a property every user-visible
string and every write has to carry, rather than a condition sprinkled through
the pages.

## "Do not store my personal data"

A prohibition, not a preference. Three consequences follow from taking that
seriously, and each one is visible in the code.

### It is decided on the server

The checkbox posts like any other form field, and a client can forge it, omit
it, or never render the page at all. What is authoritative is the flag written
to `GuestSession.personalDataAllowed` at consent time; every later decision
reads that column. Hiding inputs in the browser is presentation. This is
enforcement.

```
POST /api/accept
  doNotStorePersonalData=yes
        │
        ▼
  policyFromConsent()  ─►  personalDataAllowed = false, privacyChoiceAt = now
        │
        ▼
  every downstream write reads the session, not the form
```

### It prevents the write rather than cleaning up after it

There is no deferred deletion, no nightly sweep, no store-then-redact. Personal
values are stripped *before* a query is built:

```ts
guestFields:
  policy.personalDataAllowed && Object.keys(values).length > 0
    ? values
    : Prisma.DbNull
```

The difference matters beyond tidiness. Data that is written and later deleted
has still existed in the table, in a WAL segment, in whatever backup ran in
between, and on any replica — and a `DELETE` reaches none of those retroactively.
Data that was never written has none of that history.

### It separates operational data from personal data explicitly

| Kept, always | Subject to the prohibition |
|---|---|
| Station MAC, client IP, source IP | Name |
| AP name and serial, BSSID, SSID, WLAN | Email address |
| Gateway host, port, session token | Phone number |
| Timestamps, session status, audit events | Company, room number |
| The user agent | Anything else flagged `personal` in the registry |

The left column is how the network functions; without it there is no session for
a guest to have a preference about. The right column is what the guest told us
about themselves. `GuestFieldDefinition.personal` is the boundary, and it is the
only place that judgement is recorded.

### The guest still gets online

Both paths work identically with the box ticked. The guest-ledger row is still
created — it is the standing record of which *device* may use the network, and
what revocation acts on — it simply carries nobody's name:

```
GuestAuthorization  { macAddress, ssid, wlan, apName, firstSeen, lastSeen, … }
                    { displayName: null, email: null, phone: null, notes: null }
```

### Logs

`lib/log.ts` redacts personal keys **unconditionally**, not only when a guest has
prohibited storage. Conditional redaction would require the logger to know which
session a line belongs to, and the one call site that forgot to tell it would be
the leak. A control that has to be remembered at every call site is not a
control.

Audit events record *that* the prohibition was exercised, because that is the
only evidence it was honoured:

```json
{ "event": "AUTHORIZATION_ISSUED",
  "clientMac": "…", "personalDataPersistence": "PROHIBITED", "guestFieldsStored": 0 }
```

### Not pre-selected

The box starts unticked. No legal or product requirement in this project calls
for the opposite, and pre-selecting a privacy control makes it a dark pattern in
the other direction — a guest who wanted their details kept for a returning-visit
convenience would have to notice and undo it.

## The guest-field registry

Fields are declared once, in `lib/guestFields/registry.ts`, and read by
everything: the form, the catalogues, validation, the API, the ledger mapping,
and the privacy filter.

```ts
{ id: "email", type: "email", personal: true, maxLength: 254,
  autoComplete: "email", messageKey: "email", ledgerColumn: "email" }
```

Adding a field is that entry plus a label and placeholder in the eight
catalogues. It is then automatically rendered, localised, validated, covered by
the prohibition, mapped to the ledger, and excluded from logs. No page changes.

**New fields are `personal: true` by default.** The safe failure for a privacy
control is protecting too much.

### Configuration

| Variable | Meaning |
|---|---|
| `GUEST_FIELDS_ENABLED` | Comma-separated ids to collect. Empty ⇒ collect nothing. |
| `GUEST_FIELDS_REQUIRED` | Which of those are mandatory. |

Nothing is collected unless configured, so the least-collecting configuration is
the one you get by doing nothing. An id in `REQUIRED` that is not also `ENABLED`
is ignored rather than implicitly enabled — "required" and "collected" answer
different questions.

### Validation

Server-side, from the registry, in the guest's language. Errors travel back as
message keys, so a French guest gets a French error. Values ride in the redirect
so a guest does not retype a whole form over one bad address — **except under a
prohibition**, where they are omitted, because a URL ends up in history and
"do not store my personal data" fits badly with putting it there.

## Localisation

Eight languages: English, Spanish, French, German, Portuguese, Simplified
Chinese, Japanese, Korean. English is the fallback.

### Adding a language

1. Copy `lib/i18n/locales/en.ts`, translate the values, type it as `Messages`.
2. Add one row to `LOCALES`.

That is the whole change. `Messages` is inferred from the English catalogue, so
a missing or misspelled key is a **build error** rather than a string that
renders in English at three in the afternoon in Osaka.

Two things types cannot catch are covered by tests: a value left in English, and
a `{ssid}` a translator dropped — which would render a sentence with a hole in
it.

### Detection

```
1. the language this guest chose      (cookie)
2. the language their browser asked for  (Accept-Language, q-values honoured)
3. English
```

**Not geolocation.** Where a device is has never been a reliable statement about
what its owner reads.

`Accept-Language` handling is more careful than taking the first tag: `q=0` is a
refusal rather than a low score, and regions fall back to their base language, so
`pt-BR`, `fr-CA` and `es-419` get Portuguese, French and Spanish rather than
English.

**`zh-TW`, `zh-HK` and `zh-Hant` deliberately do not match.** Serving Simplified
to a Traditional reader is a worse answer than serving English.

### The selector

A plain `<select>`, labelled in each language's own name — someone hunting for
Japanese is looking for 日本語, not for the English word. Every mobile OS renders
it as a native, accessible list; a custom dropdown would look tidier and be worse
to use one-handed, in a hurry, in a language you are trying to get *out* of.

Choosing writes a cookie and reloads, so everything a guest reads is produced on
the server — including the parts of the flow inside captive webviews that never
hydrate.

The cookie holds a language tag. It is not personal data, it is never written to
Postgres, and it expires in a day.

### What is localised

Everything a guest can read: welcome and landing copy, terms, privacy wording and
the checkbox, field labels, placeholders and validation messages, both access
paths, secure-onboarding and QR instructions, profile-installation steps, the
captive-assistant hand-off, success and every error page, onboarding status
labels, and API error bodies.

### What is deliberately *not* localised

SSIDs, security-mode names (`WPA2 Personal`), `netsh`, `Settings`,
`System Settings > General > VPN & Device Management`, `secure-wifi.xml`, URLs,
API field names, error codes.

These are identifiers, not prose. A guest reading a translated instruction has to
find the thing it names on their own screen, and their screen says
`System Settings`. The i18n tests assert these survive translation.

## Client payload

Client components take a named `Pick` of the catalogue rather than the whole
thing. Props are serialised into the page, so passing everything shipped the
error catalogue and the consent copy to components that render neither.

## Verified

Against the deployed Integration build and the real database:

- 289 unit tests, including catalogue completeness for all eight locales.
- 50 live checks: the prohibition with and without fields, with a
  **database-wide search for the exact submitted strings** across every text and
  JSON column of every table. Zero hits.
- The mirror case: with the box unticked the same values *are* stored, which is
  what proves the prohibition is doing the suppressing.
- 94 browser checks across all eight languages on an iPhone viewport: no
  overflow, nothing clipped, no console errors, the picker in native names, and
  a language switch surviving the gateway redirect.
- Runtime logs searched for every submitted value, permitted and prohibited
  alike. Zero occurrences.
