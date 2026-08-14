/**
 * The persistence policy for one guest session.
 *
 * A guest who ticks "Do not store my personal data" has issued a prohibition,
 * not a preference, and the difference shows up in how this is built. Three
 * decisions follow from treating it as a prohibition:
 *
 * **It is decided on the server.** The checkbox is a form field like any other
 * — it can be forged, omitted, or sent by something that never rendered the
 * page. What is authoritative is the value written to the session row at
 * consent time, and every later decision reads that row. Hiding inputs in the
 * browser is presentation; this is enforcement.
 *
 * **It prevents writes rather than cleaning up after them.** There is no
 * deferred deletion, no nightly sweep, no "store then redact". `forPersistence`
 * strips personal values *before* they reach a query builder, so the prohibited
 * data never exists in Postgres to begin with — including in a WAL segment, a
 * backup, or a replica that a later `DELETE` would not reach.
 *
 * **It separates operational data from personal data explicitly.** A station's
 * MAC, its AP, the gateway token and the session's timestamps are how the
 * network functions; without them there is no session to have a preference
 * about. Those are kept. What the guest *typed about themselves* is what the
 * prohibition covers, and the registry's `personal` flag is the boundary.
 */

import type { GuestSession } from "@prisma/client";
import { PERSONAL_FIELD_IDS } from "@/lib/guestFields/registry";

export interface PersistencePolicy {
  /**
   * Whether personal data from this guest may be written to storage.
   *
   * The name is the question a caller actually has, and it reads correctly at
   * the call site: `if (!policy.personalDataAllowed) …`.
   */
  personalDataAllowed: boolean;
}

export const PERSISTENCE_ALLOWED: PersistencePolicy = { personalDataAllowed: true };
export const PERSISTENCE_PROHIBITED: PersistencePolicy = { personalDataAllowed: false };

/**
 * The policy for a session.
 *
 * Defaults to prohibited when the session is missing. A caller that has lost
 * track of whose data it is holding is exactly the caller that should not be
 * writing it.
 */
export function policyFor(
  session: Pick<GuestSession, "personalDataAllowed"> | null | undefined
): PersistencePolicy {
  if (!session) return PERSISTENCE_PROHIBITED;
  return session.personalDataAllowed ? PERSISTENCE_ALLOWED : PERSISTENCE_PROHIBITED;
}

/** What the guest ticked, translated into the stored flag. */
export function policyFromConsent(doNotStore: boolean): PersistencePolicy {
  return doNotStore ? PERSISTENCE_PROHIBITED : PERSISTENCE_ALLOWED;
}

/**
 * Filter a record down to what this policy permits to be stored.
 *
 * Keyed on the registry rather than on a hand-maintained list, so a field added
 * to the catalogue is covered here the moment it exists. The generic signature
 * is what lets this sit directly inside a `prisma.…create({ data })` call,
 * which is the only place it is any use — a helper that has to be *remembered*
 * separately from the write is a helper that will eventually be forgotten.
 */
export function forPersistence<T extends Record<string, unknown>>(
  policy: PersistencePolicy,
  values: T
): Partial<T> {
  if (policy.personalDataAllowed) return values;

  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!PERSONAL_FIELD_IDS.includes(key)) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

/**
 * Ledger columns that carry personal data, cleared when persistence is refused.
 *
 * Listed explicitly because these are columns rather than registry ids — the
 * mapping between the two lives in `GuestFieldDefinition.ledgerColumn`, and
 * this is the receiving end of it.
 */
const PERSONAL_LEDGER_COLUMNS = ["displayName", "email", "phone", "notes"] as const;

/**
 * Strip personal columns from a guest-ledger write.
 *
 * The row itself is still created: it is the standing record of which *device*
 * may use the network, which is operational and is what revocation acts on.
 * What it must not carry is who the device belongs to.
 */
export function forLedgerPersistence<T extends Record<string, unknown>>(
  policy: PersistencePolicy,
  values: T
): Partial<T> {
  if (policy.personalDataAllowed) return values;

  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!(PERSONAL_LEDGER_COLUMNS as readonly string[]).includes(key)) {
      out[key as keyof T] = value as T[keyof T];
    }
  }
  return out;
}

/**
 * A description of the policy safe to put in an audit record or a log line.
 *
 * Recording *that* a guest exercised the control is not itself personal data,
 * and it is the only evidence that the prohibition was honoured — so it is
 * deliberately kept, while the values it protected are not.
 */
export function auditablePolicy(policy: PersistencePolicy): { personalDataPersistence: string } {
  return {
    personalDataPersistence: policy.personalDataAllowed ? "ALLOWED" : "PROHIBITED",
  };
}
