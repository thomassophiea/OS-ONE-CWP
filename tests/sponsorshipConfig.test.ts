import { describe, expect, it } from "vitest";
import { sponsorAllowedDomains } from "@/lib/env";
import { sponsorshipGuestFields, fieldsForConsentRender } from "@/lib/sponsorship/fields";
import { configuredGuestFields } from "@/lib/guestFields/registry";

describe("sponsor domain configuration", () => {
  it("parses, trims and lowercases the domain list", () => {
    expect(
      sponsorAllowedDomains({ SPONSOR_ALLOWED_DOMAINS: " ExtremeNetworks.com , partner.example ,, " })
    ).toEqual(["extremenetworks.com", "partner.example"]);
  });

  it("is empty — feature off — when unset", () => {
    expect(sponsorAllowedDomains({})).toEqual([]);
    expect(sponsorAllowedDomains({ SPONSOR_ALLOWED_DOMAINS: "" })).toEqual([]);
  });
});

describe("sponsorship field merge", () => {
  it("forces name and email to required on the sponsor path", () => {
    const merged = sponsorshipGuestFields(configuredGuestFields({}));
    const ids = merged.map((f) => f.id);
    expect(ids).toContain("fullName");
    expect(ids).toContain("email");
    expect(merged.every((f) => f.required)).toBe(true);
  });

  it("upgrades an already-configured optional field rather than duplicating it", () => {
    const configured = configuredGuestFields({
      GUEST_FIELDS_ENABLED: "fullName,email,company",
      GUEST_FIELDS_REQUIRED: "",
    });
    const merged = sponsorshipGuestFields(configured);
    expect(merged.filter((f) => f.id === "fullName")).toHaveLength(1);
    expect(merged.find((f) => f.id === "fullName")?.required).toBe(true);
    expect(merged.find((f) => f.id === "email")?.required).toBe(true);
    // Fields the sponsor path does not need keep their configured requirement.
    expect(merged.find((f) => f.id === "company")?.required).toBe(false);
  });

  it("renders identity fields as optional so the open path is not burdened", () => {
    const rendered = fieldsForConsentRender(configuredGuestFields({}), true);
    expect(rendered.find((f) => f.id === "fullName")?.required).toBe(false);
    expect(fieldsForConsentRender(configuredGuestFields({}), false)).toHaveLength(0);
  });
});
