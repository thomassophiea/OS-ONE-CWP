-- The standing guest-authorization ledger, plus the session state an operator
-- revocation produces.
--
-- `GuestSession` stays exactly as it is: it is the per-visit audit record and
-- nothing here rewrites it. What is added is the standing answer to "may this
-- device use the guest network?", which the portal consults on redirect and
-- AURA manages.

-- --------------------------------------------------------------- enum: REVOKED
-- Added rather than swapped, so no existing row is rewritten.
ALTER TYPE "public"."SessionStatus" ADD VALUE IF NOT EXISTS 'REVOKED';

-- ------------------------------------------------------------------ new enums
CREATE TYPE "public"."GuestSource" AS ENUM ('CAPTIVE_PORTAL', 'MANUAL', 'GATEWAY');

CREATE TYPE "public"."GuestAuthorizationStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- ------------------------------------------------------------------ new table
CREATE TABLE "public"."GuestAuthorization" (
  "id"            TEXT NOT NULL,
  "macAddress"    TEXT NOT NULL,
  "displayName"   TEXT,
  "email"         TEXT,
  "phone"         TEXT,
  "notes"         TEXT,
  "source"        "public"."GuestSource" NOT NULL DEFAULT 'CAPTIVE_PORTAL',
  "status"        "public"."GuestAuthorizationStatus" NOT NULL DEFAULT 'ACTIVE',
  "ssid"          TEXT,
  "wlan"          TEXT,
  "gatewayHost"   TEXT,
  "apName"        TEXT,
  "apSerial"      TEXT,
  "siteId"        TEXT,
  "firstSeen"     TIMESTAMP(3),
  "lastSeen"      TIMESTAMP(3),
  "authorizedAt"  TIMESTAMP(3),
  "expiresAt"     TIMESTAMP(3),
  "revokedAt"     TIMESTAMP(3),
  "revokedBy"     TEXT,
  "createdBy"     TEXT,
  "lastSessionId" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GuestAuthorization_pkey" PRIMARY KEY ("id")
);

-- One standing authorization per device: the portal looks a station up by MAC
-- and must not have to choose between two answers.
CREATE UNIQUE INDEX "GuestAuthorization_macAddress_key"
  ON "public"."GuestAuthorization"("macAddress");

CREATE INDEX "GuestAuthorization_status_idx"         ON "public"."GuestAuthorization"("status");
CREATE INDEX "GuestAuthorization_lastSeen_idx"       ON "public"."GuestAuthorization"("lastSeen");
CREATE INDEX "GuestAuthorization_expiresAt_idx"      ON "public"."GuestAuthorization"("expiresAt");
CREATE INDEX "GuestAuthorization_source_idx"         ON "public"."GuestAuthorization"("source");
CREATE INDEX "GuestAuthorization_status_lastSeen_idx" ON "public"."GuestAuthorization"("status", "lastSeen");

-- --------------------------------------------------------------- backfill
-- Every device that has ever been authorized through the portal already is an
-- authorized guest; not backfilling would make the new page look empty on the
-- day it ships while the gateway still honours those stations.
INSERT INTO "public"."GuestAuthorization" (
  "id", "macAddress", "source", "status", "ssid", "wlan", "gatewayHost",
  "apName", "apSerial", "firstSeen", "lastSeen", "authorizedAt",
  "lastSessionId", "createdAt", "updatedAt"
)
SELECT
  md5(s."clientMac")                       AS "id",
  s."clientMac"                            AS "macAddress",
  'CAPTIVE_PORTAL'::"public"."GuestSource" AS "source",
  'ACTIVE'::"public"."GuestAuthorizationStatus" AS "status",
  s."ssid", s."wlan", s."gatewayHost", s."apName", s."apSerial",
  s."firstCreatedAt", s."lastCreatedAt", s."lastAuthorizedAt",
  s."lastSessionId", s."firstCreatedAt", CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON ("clientMac")
    "clientMac",
    "ssid", "wlan", "gatewayHost", "apName", "apSerial",
    "id"                                       AS "lastSessionId",
    "authorizedAt"                             AS "lastAuthorizedAt",
    "createdAt"                                AS "lastCreatedAt",
    MIN("createdAt") OVER (PARTITION BY "clientMac") AS "firstCreatedAt"
  FROM "public"."GuestSession"
  WHERE "clientMac" IS NOT NULL
    AND "status" = 'AUTHORIZED'
  ORDER BY "clientMac", "createdAt" DESC
) s;
