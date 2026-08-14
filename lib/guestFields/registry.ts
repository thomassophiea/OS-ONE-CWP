/**
 * The guest-field registry.
 *
 * One declaration per field, and everything else in the system reads it rather
 * than knowing about fields individually. That is what makes "add a field" a
 * one-entry change instead of a sweep through the portal: a new row here is
 * automatically rendered, localised, validated, accepted by the API, subject to
 * the privacy control, and correctly excluded from logs.
 *
 * The `personal` flag is the load-bearing one. It is the single place that says
 * whether a value is something a guest told us about themselves — and therefore
 * whether the storage prohibition applies to it. A field added without thinking
 * about that flag defaults to `true`, because the safe failure for a privacy
 * control is to protect too much rather than too little.
 *
 * Fields are configured, not coded: `GUEST_FIELDS_ENABLED` and
 * `GUEST_FIELDS_REQUIRED` select which of these appear and which are mandatory,
 * so a deployment can collect nothing (the default, and what runs today), or a
 * name and email, without a code change.
 */

import type { Messages } from "@/lib/i18n";

export type GuestFieldType = "text" | "email" | "tel";

export interface GuestFieldDefinition {
  /** Stable identifier: form field name, API key, storage key. Never shown. */
  id: string;
  type: GuestFieldType;
  /** Whether this is something the guest told us about themselves. */
  personal: boolean;
  maxLength: number;
  /** Autocomplete token, so a phone offers the right keyboard and autofill. */
  autoComplete: string;
  /** Where the label and placeholder live in every catalogue. */
  messageKey: keyof Messages["fields"] & ("fullName" | "email" | "phone" | "company" | "roomNumber");
  /** Column on `GuestAuthorization` this maps to, when persistence is allowed. */
  ledgerColumn?: "displayName" | "email" | "phone";
}

/**
 * Every field the portal knows how to collect.
 *
 * All of them are `personal: true` today. That is not an oversight — a room
 * number identifies a guest in a hotel as surely as a name does. A genuinely
 * non-personal field (a language preference, a device nickname) would set it
 * false and be exempt.
 */
export const GUEST_FIELD_CATALOGUE: readonly GuestFieldDefinition[] = [
  {
    id: "fullName",
    type: "text",
    personal: true,
    maxLength: 120,
    autoComplete: "name",
    messageKey: "fullName",
    ledgerColumn: "displayName",
  },
  {
    id: "email",
    type: "email",
    personal: true,
    maxLength: 254,
    autoComplete: "email",
    messageKey: "email",
    ledgerColumn: "email",
  },
  {
    id: "phone",
    type: "tel",
    personal: true,
    maxLength: 32,
    autoComplete: "tel",
    messageKey: "phone",
    ledgerColumn: "phone",
  },
  {
    id: "company",
    type: "text",
    personal: true,
    maxLength: 120,
    autoComplete: "organization",
    messageKey: "company",
  },
  {
    id: "roomNumber",
    type: "text",
    personal: true,
    maxLength: 32,
    autoComplete: "off",
    messageKey: "roomNumber",
  },
] as const;

const BY_ID = new Map(GUEST_FIELD_CATALOGUE.map((f) => [f.id, f]));

export function fieldById(id: string): GuestFieldDefinition | null {
  return BY_ID.get(id) ?? null;
}

/** Every personal field id the portal could ever collect. */
export const PERSONAL_FIELD_IDS: readonly string[] = GUEST_FIELD_CATALOGUE.filter(
  (f) => f.personal
).map((f) => f.id);

export interface ConfiguredGuestField extends GuestFieldDefinition {
  required: boolean;
}

function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * The fields this deployment actually collects.
 *
 * Empty by default. The portal collects no personal data at all unless someone
 * configures it to, which keeps the least-collecting configuration the one you
 * get by doing nothing.
 *
 * An id in `GUEST_FIELDS_REQUIRED` that is not also enabled is ignored rather
 * than implicitly enabled — "required" answers a different question from
 * "collected", and guessing across them would put a mandatory field on the form
 * that the operator never asked for.
 */
export function configuredGuestFields(
  env: Record<string, string | undefined> = process.env
): ConfiguredGuestField[] {
  const enabled = parseList(env.GUEST_FIELDS_ENABLED);
  const required = new Set(parseList(env.GUEST_FIELDS_REQUIRED));

  return enabled
    .map((id) => BY_ID.get(id))
    .filter((f): f is GuestFieldDefinition => Boolean(f))
    .map((f) => ({ ...f, required: required.has(f.id) }));
}

/** True when this deployment collects anything from the guest at all. */
export function collectsGuestFields(
  env: Record<string, string | undefined> = process.env
): boolean {
  return configuredGuestFields(env).length > 0;
}
