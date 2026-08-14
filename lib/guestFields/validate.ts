/**
 * Validation for guest-supplied fields, driven by the registry.
 *
 * Server-side, and that is the whole point of where it lives: the browser's
 * `required` and `type="email"` are conveniences for someone filling the form
 * in good faith, and are absent entirely for anyone who is not. Every rule that
 * matters is applied here, on values that arrived over the wire.
 *
 * Errors come back as message keys plus parameters rather than as sentences, so
 * a validation failure is localised in the guest's own language by the same
 * catalogue as everything else — a field that validates in English while the
 * rest of the page is in Japanese is a field nobody can fix.
 */

import type { ConfiguredGuestField } from "@/lib/guestFields/registry";
import { format, type Messages } from "@/lib/i18n";

export interface FieldError {
  fieldId: string;
  /** Key under `messages.fields.validation`. */
  messageKey: keyof Messages["fields"]["validation"];
}

export interface ValidationResult {
  /** Trimmed values, keyed by field id. Only ever the configured fields. */
  values: Record<string, string>;
  errors: FieldError[];
}

/**
 * Deliberately permissive, deliberately not a full RFC 5322 implementation.
 *
 * The portal cannot verify an address anyway — it sends nothing to it — so the
 * only useful job here is catching a typo before it becomes a stored value.
 * A stricter pattern rejects real addresses and teaches guests that the form is
 * broken, which is worse than accepting one that bounces.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * Digits, with the punctuation people actually type. Length is bounded by the
 * registry; the shape is bounded here.
 */
const PHONE_RE = /^\+?[0-9][0-9\s().-]{5,30}$/;

/**
 * Control characters are stripped rather than rejected.
 *
 * Nobody types one, so their presence means a paste or an automated
 * submission — and failing a guest for something they cannot see is a worse
 * outcome than removing it. Written as escapes rather than literal bytes so
 * the source stays readable and survives a copy-paste.
 */
const CONTROL_RE = /[\u0000-\u001f\u007f]/g;

export function validateGuestFields(
  fields: readonly ConfiguredGuestField[],
  raw: Record<string, string | undefined>
): ValidationResult {
  const values: Record<string, string> = {};
  const errors: FieldError[] = [];

  for (const field of fields) {
    const value = (raw[field.id] ?? "").replace(CONTROL_RE, "").trim();

    if (!value) {
      if (field.required) errors.push({ fieldId: field.id, messageKey: "required" });
      // An empty optional field is simply absent — not stored as "".
      continue;
    }

    if (value.length > field.maxLength) {
      errors.push({ fieldId: field.id, messageKey: "tooLong" });
      continue;
    }

    if (field.type === "email" && !EMAIL_RE.test(value)) {
      errors.push({ fieldId: field.id, messageKey: "email" });
      continue;
    }

    if (field.type === "tel" && !PHONE_RE.test(value)) {
      errors.push({ fieldId: field.id, messageKey: "phone" });
      continue;
    }

    values[field.id] = value;
  }

  return { values, errors };
}

/** Render one validation error in the guest's language. */
export function describeFieldError(
  error: FieldError,
  field: ConfiguredGuestField,
  messages: Messages
): string {
  const label = messages.fields[field.messageKey].label;
  return format(messages.fields.validation[error.messageKey], { field: label });
}
