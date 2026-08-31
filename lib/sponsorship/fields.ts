import {
  fieldById,
  type ConfiguredGuestField,
} from "@/lib/guestFields/registry";

/**
 * The guest fields a *sponsorship* submission must satisfy.
 *
 * A sponsor is being asked to vouch for a person, so the request has to say
 * who that person is: name and email are mandatory on this path regardless of
 * what `GUEST_FIELDS_REQUIRED` says, and they are drawn from the same registry
 * as everywhere else — same ids, same validation, same privacy classification,
 * same localised labels. No parallel field system.
 *
 * The open path is untouched: this merge is applied only when validating a
 * `mode=sponsor` submission (and when deciding what the consent page renders
 * while sponsorship is offered).
 */
export const SPONSORSHIP_IDENTITY_FIELD_IDS = ["fullName", "email"] as const;

export function sponsorshipGuestFields(
  configured: readonly ConfiguredGuestField[]
): ConfiguredGuestField[] {
  const out: ConfiguredGuestField[] = [...configured];
  for (const id of SPONSORSHIP_IDENTITY_FIELD_IDS) {
    const index = out.findIndex((f) => f.id === id);
    if (index >= 0) {
      out[index] = { ...out[index], required: true };
    } else {
      const definition = fieldById(id);
      if (definition) out.push({ ...definition, required: true });
    }
  }
  return out;
}

/**
 * What the consent page renders when sponsorship is offered: the configured
 * fields plus the identity fields, with the configured `required` flags kept
 * as they are. The sponsor path's stricter requirement is enforced by the
 * server at submit time; advertising it as `required` in shared markup would
 * make the *open* path demand a name it does not need.
 */
export function fieldsForConsentRender(
  configured: readonly ConfiguredGuestField[],
  sponsorshipOffered: boolean
): ConfiguredGuestField[] {
  if (!sponsorshipOffered) return [...configured];
  const out: ConfiguredGuestField[] = [...configured];
  for (const id of SPONSORSHIP_IDENTITY_FIELD_IDS) {
    if (!out.some((f) => f.id === id)) {
      const definition = fieldById(id);
      if (definition) out.push({ ...definition, required: false });
    }
  }
  return out;
}
