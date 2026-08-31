import { NextRequest, NextResponse } from "next/server";
import type { PortalConfig, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { audit } from "@/lib/session/repository";
import { authorizeInternalRequest, actorFrom } from "@/lib/guests/internalAuth";
import {
  effectiveGuestFields,
  effectiveSponsorship,
  invalidatePortalConfigCache,
  portalConfigRow,
} from "@/lib/config/portal";
import {
  isAcceptableSponsorDomain,
  validateSponsorEmail,
} from "@/lib/sponsorship/sponsorEmailPolicy";
import { sponsorAllowedDomains as envSponsorDomains, emailTransportKind } from "@/lib/env";
import { GUEST_FIELD_CATALOGUE, fieldById } from "@/lib/guestFields/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Service-to-service configuration surface, consumed by AURA's
 * "Cloud Captive Portal" page. Same trust model as `/api/internal/guests`:
 * disabled outright without `INTERNAL_API_TOKEN`, bearer-authenticated,
 * never reachable by a guest.
 *
 * Contract: omitted field = unchanged; explicit `null` = clear the override
 * and fall back to the environment. Lists travel as arrays; storage is the
 * comma-joined form the config module parses.
 */

type StoredView = {
  sponsorshipEnabled: boolean | null;
  sponsorAllowedDomains: string[] | null;
  sponsorAllowedAddresses: string[] | null;
  sponsorshipTtlSeconds: number | null;
  sponsorshipMaxPerSession: number | null;
  guestFieldsEnabled: string[] | null;
  guestFieldsRequired: string[] | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

function splitStored(value: string | null): string[] | null {
  if (value == null) return null;
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function storedView(row: PortalConfig | null): StoredView {
  return {
    sponsorshipEnabled: row?.sponsorshipEnabled ?? null,
    sponsorAllowedDomains: splitStored(row?.sponsorAllowedDomains ?? null),
    sponsorAllowedAddresses: splitStored(row?.sponsorAllowedAddresses ?? null),
    sponsorshipTtlSeconds: row?.sponsorshipTtlSeconds ?? null,
    sponsorshipMaxPerSession: row?.sponsorshipMaxPerSession ?? null,
    guestFieldsEnabled: splitStored(row?.guestFieldsEnabled ?? null),
    guestFieldsRequired: splitStored(row?.guestFieldsRequired ?? null),
    updatedBy: row?.updatedBy ?? null,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  };
}

async function fullView() {
  const [row, sponsorship, guestFields] = await Promise.all([
    portalConfigRow(),
    effectiveSponsorship(),
    effectiveGuestFields(),
  ]);
  return {
    stored: storedView(row),
    effective: {
      sponsorship,
      emailTransport: emailTransportKind(),
      guestFields: guestFields.map((f) => ({ id: f.id, required: f.required })),
    },
    // What the operator may choose from, so the UI never invents field ids.
    fieldCatalogue: GUEST_FIELD_CATALOGUE.map((f) => ({ id: f.id, personal: f.personal })),
    envDefaults: {
      sponsorAllowedDomains: envSponsorDomains(),
    },
  };
}

export async function GET(request: NextRequest) {
  const auth = authorizeInternalRequest(request.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return NextResponse.json(await fullView());
  } catch (err) {
    log.error("internal_config_read_failed", { err });
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = authorizeInternalRequest(request.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const errors: string[] = [];
  const data: Prisma.PortalConfigUpdateInput = {};

  const listField = (
    name: string,
    validate: (item: string) => string | null
  ): string | null | undefined => {
    if (!(name in body)) return undefined;
    const value = body[name];
    if (value === null) return null;
    if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
      errors.push(`${name} must be an array of strings or null`);
      return undefined;
    }
    const normalised: string[] = [];
    for (const raw of value as string[]) {
      const item = validate(raw.trim());
      if (item === null) errors.push(`${name}: "${raw}" is not acceptable`);
      else if (item) normalised.push(item);
    }
    return normalised.join(",");
  };

  // Domains being saved (or the current effective set) validate the addresses,
  // so what the operator stores is exactly what a guest submission can match.
  const domainsValue = listField("sponsorAllowedDomains", (d) => {
    const lower = d.toLowerCase();
    return isAcceptableSponsorDomain(lower) ? lower : null;
  });
  if (domainsValue !== undefined) data.sponsorAllowedDomains = domainsValue;

  const prospectiveDomains =
    domainsValue != null && domainsValue !== ""
      ? domainsValue.split(",")
      : domainsValue === null
        ? envSponsorDomains()
        : (await effectiveSponsorship()).domains;

  const addressesValue = listField("sponsorAllowedAddresses", (a) => {
    const verdict = validateSponsorEmail(a, prospectiveDomains);
    return verdict.ok ? verdict.email.toLowerCase() : null;
  });
  if (addressesValue !== undefined) data.sponsorAllowedAddresses = addressesValue;

  const fieldIds = (name: string) =>
    listField(name, (id) => (fieldById(id) ? id : null));
  const enabledValue = fieldIds("guestFieldsEnabled");
  if (enabledValue !== undefined) data.guestFieldsEnabled = enabledValue;
  const requiredValue = fieldIds("guestFieldsRequired");
  if (requiredValue !== undefined) data.guestFieldsRequired = requiredValue;

  if ("sponsorshipEnabled" in body) {
    const v = body.sponsorshipEnabled;
    if (v === null || typeof v === "boolean") data.sponsorshipEnabled = v;
    else errors.push("sponsorshipEnabled must be a boolean or null");
  }

  const intField = (name: string, min: number, max: number) => {
    if (!(name in body)) return undefined;
    const v = body[name];
    if (v === null) return null;
    if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
      errors.push(`${name} must be an integer between ${min} and ${max}, or null`);
      return undefined;
    }
    return v;
  };
  const ttl = intField("sponsorshipTtlSeconds", 60, 86_400);
  if (ttl !== undefined) data.sponsorshipTtlSeconds = ttl;
  const maxPer = intField("sponsorshipMaxPerSession", 1, 10);
  if (maxPer !== undefined) data.sponsorshipMaxPerSession = maxPer;

  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const actor = actorFrom(request.headers);
  data.updatedBy = actor;

  try {
    await prisma.portalConfig.upsert({
      where: { id: "default" },
      update: data,
      create: { id: "default", ...(data as Prisma.PortalConfigCreateInput) },
    });
  } catch (err) {
    log.error("internal_config_write_failed", { err });
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }

  invalidatePortalConfigCache();
  await audit(null, "PORTAL_CONFIG_UPDATED", "info", {
    actor,
    // The keys touched and the new values — configuration, not secrets and
    // not personal data, and exactly what an operator audit needs.
    changed: Object.keys(data).filter((k) => k !== "updatedBy"),
  });

  return NextResponse.json(await fullView());
}
