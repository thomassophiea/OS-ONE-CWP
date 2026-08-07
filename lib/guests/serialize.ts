/**
 * Wire representation of a guest.
 *
 * The internal API is consumed by AURA, not by a browser, but it still only
 * emits what the management plane needs: nothing here carries a gateway token,
 * a CSRF hash, or request headers.
 */

import type { GuestAuthorization } from "@prisma/client";
import { effectiveStatus } from "@/lib/guests/repository";

export interface GuestDto {
  id: string;
  macAddress: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source: string;
  /** Stored status; may lag the clock. */
  storedStatus: string;
  /** Status after applying `expiresAt`. This is the one to display. */
  authorizationStatus: string;
  ssid: string | null;
  wlan: string | null;
  gatewayHost: string | null;
  apName: string | null;
  apSerial: string | null;
  siteId: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  authorizedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  createdBy: string | null;
  lastSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

const iso = (value: Date | null) => (value ? value.toISOString() : null);

export function toGuestDto(guest: GuestAuthorization, now = new Date()): GuestDto {
  return {
    id: guest.id,
    macAddress: guest.macAddress,
    displayName: guest.displayName,
    email: guest.email,
    phone: guest.phone,
    notes: guest.notes,
    source: guest.source,
    storedStatus: guest.status,
    authorizationStatus: effectiveStatus(guest, now),
    ssid: guest.ssid,
    wlan: guest.wlan,
    gatewayHost: guest.gatewayHost,
    apName: guest.apName,
    apSerial: guest.apSerial,
    siteId: guest.siteId,
    firstSeen: iso(guest.firstSeen),
    lastSeen: iso(guest.lastSeen),
    authorizedAt: iso(guest.authorizedAt),
    expiresAt: iso(guest.expiresAt),
    revokedAt: iso(guest.revokedAt),
    revokedBy: guest.revokedBy,
    createdBy: guest.createdBy,
    lastSessionId: guest.lastSessionId,
    createdAt: guest.createdAt.toISOString(),
    updatedAt: guest.updatedAt.toISOString(),
  };
}
