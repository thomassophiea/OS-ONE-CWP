/**
 * Query-parameter parsing for the internal guest API.
 *
 * Kept separate from the route handlers so it can be tested without a running
 * Next.js server. Every value is validated rather than coerced: an unknown
 * status is an error, not silently ignored, because a caller that misspells a
 * filter must not be handed the unfiltered list.
 */

import type { GuestAuthorizationStatus, GuestSource } from "@prisma/client";
import type { ListGuestsFilter } from "@/lib/guests/repository";

const STATUSES: GuestAuthorizationStatus[] = ["ACTIVE", "REVOKED", "EXPIRED"];
const SOURCES: GuestSource[] = ["CAPTIVE_PORTAL", "MANUAL", "GATEWAY"];

export type ParseResult =
  | { ok: true; filter: ListGuestsFilter }
  | { ok: false; error: string };

function parseList<T extends string>(raw: string | null, allowed: T[]): T[] | "INVALID" | null {
  if (!raw) return null;
  const parts = raw
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const out: T[] = [];
  for (const part of parts) {
    const match = allowed.find((a) => a === part);
    if (!match) return "INVALID";
    out.push(match);
  }
  return out;
}

function parseDate(raw: string | null): Date | "INVALID" | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "INVALID" : date;
}

export function parseListParams(params: URLSearchParams): ParseResult {
  const status = parseList(params.get("status"), STATUSES);
  if (status === "INVALID") {
    return { ok: false, error: `status must be one of ${STATUSES.join(", ")}` };
  }

  const source = parseList(params.get("source"), SOURCES);
  if (source === "INVALID") {
    return { ok: false, error: `source must be one of ${SOURCES.join(", ")}` };
  }

  const startTime = parseDate(params.get("start_time"));
  if (startTime === "INVALID") {
    return { ok: false, error: "start_time must be an ISO-8601 timestamp" };
  }
  const endTime = parseDate(params.get("end_time"));
  if (endTime === "INVALID") {
    return { ok: false, error: "end_time must be an ISO-8601 timestamp" };
  }
  if (startTime && endTime && startTime.getTime() > endTime.getTime()) {
    return { ok: false, error: "start_time must not be after end_time" };
  }

  const rawLimit = params.get("limit");
  let limit: number | undefined;
  if (rawLimit !== null) {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
      return { ok: false, error: "limit must be an integer between 1 and 500" };
    }
    limit = parsed;
  }

  const search = params.get("search")?.trim();

  return {
    ok: true,
    filter: {
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(search ? { search: search.slice(0, 128) } : {}),
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
      ...(limit ? { limit } : {}),
      ...(params.get("cursor") ? { cursor: params.get("cursor")!.slice(0, 64) } : {}),
    },
  };
}

export type CreateBodyResult =
  | {
      ok: true;
      value: {
        macAddress: string;
        displayName: string | null;
        email: string | null;
        phone: string | null;
        notes: string | null;
        expiresAt: Date | null;
      };
    }
  | { ok: false; error: string };

const MAX_DURATION_MINUTES = 365 * 24 * 60;

function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, max);
}

/**
 * Validate a create-guest body.
 *
 * Expiry may be given either as an absolute `expires_at` or as
 * `duration_minutes`; supplying both is refused rather than resolved by
 * precedence, since guessing which the operator meant is how an access window
 * ends up wrong.
 */
export function parseCreateBody(body: unknown, now = new Date()): CreateBodyResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "A JSON object body is required" };
  }
  const b = body as Record<string, unknown>;

  const macAddress = typeof b.mac_address === "string" ? b.mac_address : b.macAddress;
  if (typeof macAddress !== "string" || macAddress.trim() === "") {
    return { ok: false, error: "mac_address is required" };
  }

  const rawExpiresAt = b.expires_at ?? b.expiresAt;
  const rawDuration = b.duration_minutes ?? b.durationMinutes;

  if (rawExpiresAt != null && rawDuration != null) {
    return { ok: false, error: "Provide either expires_at or duration_minutes, not both" };
  }

  let expiresAt: Date | null = null;
  if (rawExpiresAt != null) {
    if (typeof rawExpiresAt !== "string") {
      return { ok: false, error: "expires_at must be an ISO-8601 timestamp" };
    }
    const parsed = new Date(rawExpiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "expires_at must be an ISO-8601 timestamp" };
    }
    if (parsed.getTime() <= now.getTime()) {
      return { ok: false, error: "expires_at must be in the future" };
    }
    expiresAt = parsed;
  } else if (rawDuration != null) {
    const minutes = Number(rawDuration);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_DURATION_MINUTES) {
      return {
        ok: false,
        error: `duration_minutes must be between 1 and ${MAX_DURATION_MINUTES}`,
      };
    }
    expiresAt = new Date(now.getTime() + minutes * 60_000);
  }

  return {
    ok: true,
    value: {
      macAddress: macAddress.trim(),
      displayName: optionalText(b.display_name ?? b.displayName, 120),
      email: optionalText(b.email, 254),
      phone: optionalText(b.phone, 40),
      notes: optionalText(b.notes, 500),
      expiresAt,
    },
  };
}
