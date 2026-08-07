/**
 * Guest authorization store.
 *
 * This module owns the standing answer to "may this device use the guest
 * network?". It is the only place that writes `GuestAuthorization`, and the
 * portal and the internal API both go through it.
 *
 * Expiry is derived, never a background job: a row whose `expiresAt` has passed
 * reads as EXPIRED whether or not anything has swept it. `markExpired` exists so
 * the stored value catches up, but nothing depends on it having run.
 */

import type {
  GuestAuthorization,
  GuestAuthorizationStatus,
  GuestSource,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canonicalMac } from "@/lib/guests/mac";

/** The status callers should act on, given the clock. */
export function effectiveStatus(
  guest: Pick<GuestAuthorization, "status" | "expiresAt">,
  now = new Date()
): GuestAuthorizationStatus {
  if (guest.status === "REVOKED") return "REVOKED";
  if (guest.expiresAt && guest.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return guest.status;
}

/** True when the portal should approve this station without asking again. */
export function isAuthorized(
  guest: Pick<GuestAuthorization, "status" | "expiresAt"> | null,
  now = new Date()
): boolean {
  return guest !== null && effectiveStatus(guest, now) === "ACTIVE";
}

export async function findByMac(mac: string): Promise<GuestAuthorization | null> {
  const canonical = canonicalMac(mac);
  if (!canonical) return null;
  return prisma.guestAuthorization.findUnique({ where: { macAddress: canonical } });
}

export async function findById(id: string): Promise<GuestAuthorization | null> {
  return prisma.guestAuthorization.findUnique({ where: { id } });
}

export interface ListGuestsFilter {
  status?: GuestAuthorizationStatus[];
  source?: GuestSource[];
  /** Substring match on MAC, display name or email. */
  search?: string;
  /** Filter on last-seen; guests never seen are included only when no window is set. */
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  /** Opaque cursor: the id of the last row from the previous page. */
  cursor?: string;
}

export interface ListGuestsResult {
  guests: GuestAuthorization[];
  nextCursor: string | null;
  total: number;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function buildWhere(filter: ListGuestsFilter, now: Date): Prisma.GuestAuthorizationWhereInput {
  const and: Prisma.GuestAuthorizationWhereInput[] = [];

  if (filter.status && filter.status.length > 0) {
    // EXPIRED is a derived state, so it cannot be a plain column comparison:
    // a row can be stored ACTIVE and be expired by the clock, and asking for
    // ACTIVE must not return it.
    const statuses = new Set(filter.status);
    const clauses: Prisma.GuestAuthorizationWhereInput[] = [];
    if (statuses.has("ACTIVE")) {
      clauses.push({
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      });
    }
    if (statuses.has("EXPIRED")) {
      clauses.push({ status: { in: ["ACTIVE", "EXPIRED"] }, expiresAt: { lte: now } });
    }
    if (statuses.has("REVOKED")) clauses.push({ status: "REVOKED" });
    and.push({ OR: clauses });
  }

  if (filter.source && filter.source.length > 0) {
    and.push({ source: { in: filter.source } });
  }

  const search = filter.search?.trim();
  if (search) {
    // A MAC typed in any format still has to find the row, so search on the
    // canonical form when the term parses as one.
    const asMac = canonicalMac(search);
    and.push({
      OR: [
        { macAddress: { contains: asMac ?? search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (filter.startTime || filter.endTime) {
    and.push({
      lastSeen: {
        ...(filter.startTime ? { gte: filter.startTime } : {}),
        ...(filter.endTime ? { lte: filter.endTime } : {}),
      },
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

export async function listGuests(
  filter: ListGuestsFilter = {},
  now = new Date()
): Promise<ListGuestsResult> {
  const limit = Math.min(Math.max(filter.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const where = buildWhere(filter, now);

  const [rows, total] = await Promise.all([
    prisma.guestAuthorization.findMany({
      where,
      // `lastSeen` first so the most recently active guests lead, with `id` as
      // the tiebreak that makes the cursor deterministic.
      orderBy: [{ lastSeen: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      take: limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    }),
    prisma.guestAuthorization.count({ where }),
  ]);

  const hasMore = rows.length > limit;
  const guests = hasMore ? rows.slice(0, limit) : rows;
  return {
    guests,
    nextCursor: hasMore ? guests[guests.length - 1].id : null,
    total,
  };
}

export interface GuestSummary {
  authorized: number;
  revoked: number;
  expired: number;
  manual: number;
  seenToday: number;
  seenLast7Days: number;
  total: number;
}

export async function summarize(now = new Date(), timeZoneOffsetMinutes = 0): Promise<GuestSummary> {
  const startOfToday = new Date(now.getTime() - timeZoneOffsetMinutes * 60_000);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const todayCutoff = new Date(startOfToday.getTime() + timeZoneOffsetMinutes * 60_000);
  const weekCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [authorized, revoked, expired, manual, seenToday, seenLast7Days, total] =
    await Promise.all([
      prisma.guestAuthorization.count({
        where: { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      }),
      prisma.guestAuthorization.count({ where: { status: "REVOKED" } }),
      prisma.guestAuthorization.count({
        where: { status: { in: ["ACTIVE", "EXPIRED"] }, expiresAt: { lte: now } },
      }),
      prisma.guestAuthorization.count({ where: { source: "MANUAL" } }),
      prisma.guestAuthorization.count({ where: { lastSeen: { gte: todayCutoff } } }),
      prisma.guestAuthorization.count({ where: { lastSeen: { gte: weekCutoff } } }),
      prisma.guestAuthorization.count(),
    ]);

  return { authorized, revoked, expired, manual, seenToday, seenLast7Days, total };
}

export interface CreateGuestInput {
  macAddress: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  expiresAt?: Date | null;
  createdBy?: string | null;
  source?: GuestSource;
}

export type CreateGuestResult =
  | { ok: true; guest: GuestAuthorization; reactivated: boolean }
  | { ok: false; reason: "DUPLICATE_ACTIVE"; guest: GuestAuthorization };

/**
 * Add (or re-activate) a standing authorization.
 *
 * A MAC that is already actively authorized is refused rather than duplicated —
 * the unique index makes a second row impossible anyway, and silently
 * overwriting the first would erase an operator's earlier expiry. A revoked or
 * expired entry, by contrast, is reactivated in place, so the audit trail on
 * that device survives.
 */
export async function createGuest(
  input: CreateGuestInput,
  now = new Date()
): Promise<CreateGuestResult> {
  const macAddress = canonicalMac(input.macAddress);
  if (!macAddress) throw new Error("createGuest requires a canonical MAC address");

  const existing = await prisma.guestAuthorization.findUnique({ where: { macAddress } });

  if (existing && effectiveStatus(existing, now) === "ACTIVE") {
    return { ok: false, reason: "DUPLICATE_ACTIVE", guest: existing };
  }

  const data = {
    displayName: input.displayName ?? existing?.displayName ?? null,
    email: input.email ?? existing?.email ?? null,
    phone: input.phone ?? existing?.phone ?? null,
    notes: input.notes ?? existing?.notes ?? null,
    source: input.source ?? "MANUAL",
    status: "ACTIVE" as const,
    expiresAt: input.expiresAt ?? null,
    authorizedAt: now,
    revokedAt: null,
    revokedBy: null,
    createdBy: input.createdBy ?? null,
  };

  const guest = existing
    ? await prisma.guestAuthorization.update({ where: { id: existing.id }, data })
    : await prisma.guestAuthorization.create({
        data: { macAddress, firstSeen: null, lastSeen: null, ...data },
      });

  return { ok: true, guest, reactivated: Boolean(existing) };
}

/**
 * Withdraw access, preserving the record.
 *
 * Any live portal session for the device is stamped REVOKED in the same
 * transaction, so a station cannot finish a consent flow that started before
 * the operator acted.
 */
export async function revokeGuest(
  id: string,
  revokedBy: string | null,
  now = new Date()
): Promise<GuestAuthorization | null> {
  const existing = await prisma.guestAuthorization.findUnique({ where: { id } });
  if (!existing) return null;

  const [guest] = await prisma.$transaction([
    prisma.guestAuthorization.update({
      where: { id },
      data: { status: "REVOKED", revokedAt: now, revokedBy },
    }),
    prisma.guestSession.updateMany({
      where: { clientMac: existing.macAddress, status: { in: ["STARTED", "ACCEPTED", "AUTHORIZED"] } },
      data: { status: "REVOKED", failureReason: "REVOKED_BY_OPERATOR" },
    }),
  ]);

  return guest;
}

/**
 * Hard-delete — permitted only for an entry that has never been seen on the
 * network. Anything a real device used is history and is revoked instead.
 */
export async function deleteGuest(id: string): Promise<"DELETED" | "NOT_FOUND" | "HAS_HISTORY"> {
  const existing = await prisma.guestAuthorization.findUnique({ where: { id } });
  if (!existing) return "NOT_FOUND";
  if (existing.lastSeen !== null || existing.firstSeen !== null) return "HAS_HISTORY";

  const sessions = await prisma.guestSession.count({
    where: { clientMac: existing.macAddress },
  });
  if (sessions > 0) return "HAS_HISTORY";

  await prisma.guestAuthorization.delete({ where: { id } });
  return "DELETED";
}

export interface PortalObservation {
  macAddress: string;
  ssid?: string | null;
  wlan?: string | null;
  gatewayHost?: string | null;
  apName?: string | null;
  apSerial?: string | null;
  sessionId?: string | null;
  now?: Date;
}

function observationContext(input: PortalObservation) {
  return {
    ssid: input.ssid ?? undefined,
    wlan: input.wlan ?? undefined,
    gatewayHost: input.gatewayHost ?? undefined,
    apName: input.apName ?? undefined,
    apSerial: input.apSerial ?? undefined,
    lastSessionId: input.sessionId ?? undefined,
  };
}

/**
 * Note that a known device turned up, without creating anything.
 *
 * Deliberately update-only. A station that merely got redirected has not
 * consented to anything, and creating an ACTIVE ledger row for it would be a
 * standing grant issued to whoever last associated with the SSID.
 */
export async function touchGuestSeen(
  input: PortalObservation
): Promise<GuestAuthorization | null> {
  const macAddress = canonicalMac(input.macAddress);
  if (!macAddress) return null;
  const now = input.now ?? new Date();

  const { count } = await prisma.guestAuthorization.updateMany({
    where: { macAddress },
    data: { lastSeen: now, ...observationContext(input) },
  });
  if (count === 0) return null;
  return prisma.guestAuthorization.findUnique({ where: { macAddress } });
}

/**
 * Record a guest the gateway has confirmed it authorized.
 *
 * A revoked entry is *not* resurrected — it is left revoked and returned as-is.
 * Reaching this point after a revocation would mean the station completed a
 * flow that started before the operator acted; the standing decision still
 * stands, and AURA's revoke path is what removes it from the gateway.
 */
export async function recordAuthorizedGuest(
  input: PortalObservation
): Promise<GuestAuthorization | null> {
  const macAddress = canonicalMac(input.macAddress);
  if (!macAddress) return null;
  const now = input.now ?? new Date();
  const context = observationContext(input);

  const existing = await prisma.guestAuthorization.findUnique({ where: { macAddress } });
  if (existing?.status === "REVOKED") return existing;

  if (!existing) {
    return prisma.guestAuthorization.create({
      data: {
        macAddress,
        source: "CAPTIVE_PORTAL",
        status: "ACTIVE",
        firstSeen: now,
        lastSeen: now,
        authorizedAt: now,
        ...context,
      },
    });
  }

  return prisma.guestAuthorization.update({
    where: { id: existing.id },
    data: {
      lastSeen: now,
      authorizedAt: now,
      firstSeen: existing.firstSeen ?? now,
      // An expired entry that just completed the portal flow is live again;
      // its expiry was a limit on the old grant, not on the device.
      ...(effectiveStatus(existing, now) === "EXPIRED"
        ? { status: "ACTIVE" as const, expiresAt: null }
        : {}),
      ...context,
    },
  });
}

/**
 * Whether the portal may skip the consent form for this device.
 *
 * Only an operator-entered authorization does. A guest who consented last week
 * still sees the terms on their next visit: the consent record is per-visit and
 * is the point of the portal, so turning a past visit into a standing bypass
 * would quietly retire it.
 */
export function mayBypassConsent(
  guest: Pick<GuestAuthorization, "status" | "expiresAt" | "source"> | null,
  now = new Date()
): boolean {
  return guest !== null && guest.source === "MANUAL" && isAuthorized(guest, now);
}

/** Bring stored status in line with the clock. Idempotent; safe to call often. */
export async function markExpired(now = new Date()): Promise<number> {
  const { count } = await prisma.guestAuthorization.updateMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
  return count;
}
