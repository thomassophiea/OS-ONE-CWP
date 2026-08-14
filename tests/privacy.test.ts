import { describe, expect, it } from "vitest";
import type { GuestSession } from "@prisma/client";
import {
  PERSISTENCE_ALLOWED,
  PERSISTENCE_PROHIBITED,
  auditablePolicy,
  forLedgerPersistence,
  forPersistence,
  policyFor,
  policyFromConsent,
} from "@/lib/privacy/policy";
import { GUEST_FIELD_CATALOGUE, configuredGuestFields } from "@/lib/guestFields/registry";
import { validateGuestFields } from "@/lib/guestFields/validate";
import { redact } from "@/lib/log";

/**
 * The storage prohibition.
 *
 * These assertions are the product requirement written down: a guest who ticks
 * the box must still get online, and nothing they typed about themselves may be
 * written. Everything here tests the *server-side* construct, because that is
 * the only thing a browser cannot get around.
 */

describe("policy derivation", () => {
  it("reads the guest's choice", () => {
    expect(policyFromConsent(true)).toEqual(PERSISTENCE_PROHIBITED);
    expect(policyFromConsent(false)).toEqual(PERSISTENCE_ALLOWED);
  });

  it("reads the stored flag back off a session", () => {
    expect(policyFor({ personalDataAllowed: true } as GuestSession).personalDataAllowed).toBe(true);
    expect(policyFor({ personalDataAllowed: false } as GuestSession).personalDataAllowed).toBe(
      false
    );
  });

  it("refuses persistence when there is no session to ask", () => {
    // A caller that has lost track of whose data it holds is exactly the caller
    // that should not be writing it.
    expect(policyFor(null).personalDataAllowed).toBe(false);
    expect(policyFor(undefined).personalDataAllowed).toBe(false);
  });

  it("describes itself for the audit trail without carrying data", () => {
    expect(auditablePolicy(PERSISTENCE_PROHIBITED)).toEqual({
      personalDataPersistence: "PROHIBITED",
    });
  });
});

describe("stripping personal values before a write", () => {
  const submitted = {
    fullName: "Alex Morgan",
    email: "alex@example.com",
    phone: "+1 555 010 0100",
    company: "Acme Ltd",
    roomNumber: "204",
  };

  it("keeps everything when the guest allowed it", () => {
    expect(forPersistence(PERSISTENCE_ALLOWED, submitted)).toEqual(submitted);
  });

  it("removes every personal value when the guest prohibited it", () => {
    expect(forPersistence(PERSISTENCE_PROHIBITED, submitted)).toEqual({});
  });

  it("covers every field in the catalogue, including ones added later", () => {
    // The guarantee that matters for requirement 5: a new registry entry is
    // protected the moment it exists, without this file being edited.
    const everyPersonalField = Object.fromEntries(
      GUEST_FIELD_CATALOGUE.filter((f) => f.personal).map((f) => [f.id, "value"])
    );
    expect(forPersistence(PERSISTENCE_PROHIBITED, everyPersonalField)).toEqual({});
  });

  it("leaves operational values alone — they are how the network works", () => {
    const record = {
      clientMac: "aa:bb:cc:dd:ee:ff",
      ssid: "AURA-CWP",
      gatewayHost: "apcp.example.net",
      fullName: "Alex Morgan",
    };
    expect(forPersistence(PERSISTENCE_PROHIBITED, record)).toEqual({
      clientMac: "aa:bb:cc:dd:ee:ff",
      ssid: "AURA-CWP",
      gatewayHost: "apcp.example.net",
    });
  });

  it("strips personal ledger columns but keeps the device record", () => {
    const row = {
      macAddress: "aa:bb:cc:dd:ee:ff",
      ssid: "AURA-CWP",
      displayName: "Alex Morgan",
      email: "alex@example.com",
      phone: "+1 555 010 0100",
      notes: "VIP",
    };
    // The row still exists — it is what revocation acts on — and carries nobody.
    expect(forLedgerPersistence(PERSISTENCE_PROHIBITED, row)).toEqual({
      macAddress: "aa:bb:cc:dd:ee:ff",
      ssid: "AURA-CWP",
    });
  });
});

describe("the field registry", () => {
  it("collects nothing unless configured", () => {
    expect(configuredGuestFields({})).toEqual([]);
  });

  it("enables only what is named, and only what exists", () => {
    const fields = configuredGuestFields({
      GUEST_FIELDS_ENABLED: "fullName,email,notARealField",
    });
    expect(fields.map((f) => f.id)).toEqual(["fullName", "email"]);
  });

  it("marks required fields without enabling them by implication", () => {
    // "required" and "collected" answer different questions; guessing across
    // them would put a mandatory field on the form nobody asked for.
    const fields = configuredGuestFields({
      GUEST_FIELDS_ENABLED: "fullName",
      GUEST_FIELDS_REQUIRED: "fullName,phone",
    });
    expect(fields.map((f) => [f.id, f.required])).toEqual([["fullName", true]]);
  });

  it("treats every collectable field as personal by default", () => {
    expect(GUEST_FIELD_CATALOGUE.every((f) => f.personal)).toBe(true);
  });
});

describe("server-side validation", () => {
  const fields = configuredGuestFields({
    GUEST_FIELDS_ENABLED: "fullName,email,phone",
    GUEST_FIELDS_REQUIRED: "fullName,email",
  });

  it("accepts good input and trims it", () => {
    const result = validateGuestFields(fields, {
      fullName: "  Alex Morgan  ",
      email: "alex@example.com",
      phone: "+1 555 010 0100",
    });
    expect(result.errors).toEqual([]);
    expect(result.values.fullName).toBe("Alex Morgan");
  });

  it("requires what is marked required", () => {
    const result = validateGuestFields(fields, { fullName: "", email: "" });
    expect(result.errors.map((e) => [e.fieldId, e.messageKey])).toEqual([
      ["fullName", "required"],
      ["email", "required"],
    ]);
  });

  it("does not store an empty optional field as an empty string", () => {
    const result = validateGuestFields(fields, {
      fullName: "Alex",
      email: "alex@example.com",
      phone: "",
    });
    expect("phone" in result.values).toBe(false);
  });

  it("rejects a malformed email and phone", () => {
    const result = validateGuestFields(fields, {
      fullName: "Alex",
      email: "not-an-email",
      phone: "abc",
    });
    expect(result.errors.map((e) => e.messageKey).sort()).toEqual(["email", "phone"]);
  });

  it("rejects over-long input rather than truncating it silently", () => {
    const result = validateGuestFields(fields, {
      fullName: "x".repeat(500),
      email: "alex@example.com",
    });
    expect(result.errors[0]).toEqual({ fieldId: "fullName", messageKey: "tooLong" });
  });

  it("ignores inputs that are not configured fields", () => {
    const result = validateGuestFields(fields, {
      fullName: "Alex",
      email: "alex@example.com",
      // An input a client invented. It must never become a stored value.
      nationalIdNumber: "123-45-6789",
    } as Record<string, string>);
    expect("nationalIdNumber" in result.values).toBe(false);
  });
});

describe("the logger is blind to personal data", () => {
  it("redacts personal keys unconditionally, not only under a prohibition", () => {
    // Conditional redaction would mean the logger had to know which session a
    // line belongs to, and the one call site that forgot would be the leak.
    const scrubbed = redact({
      fullName: "Alex Morgan",
      email: "alex@example.com",
      phone: "+1 555 010 0100",
      displayName: "Alex",
      notes: "VIP",
      guestFields: { email: "alex@example.com" },
    }) as Record<string, unknown>;

    for (const value of Object.values(scrubbed)) expect(value).toBe("[personal]");
    expect(JSON.stringify(scrubbed)).not.toContain("alex@example.com");
    expect(JSON.stringify(scrubbed)).not.toContain("Alex Morgan");
  });

  it("still logs the operational fields an engineer needs", () => {
    const scrubbed = redact({
      sessionId: "cmst1",
      clientMac: "aa:bb:cc:dd:ee:ff",
      ssid: "AURA-CWP",
    }) as Record<string, unknown>;
    expect(scrubbed).toEqual({
      sessionId: "cmst1",
      clientMac: "aa:bb:cc:dd:ee:ff",
      ssid: "AURA-CWP",
    });
  });

  it("redacts personal keys nested inside other objects", () => {
    const scrubbed = redact({ detail: { email: "alex@example.com" } });
    expect(JSON.stringify(scrubbed)).not.toContain("alex@example.com");
  });
});
