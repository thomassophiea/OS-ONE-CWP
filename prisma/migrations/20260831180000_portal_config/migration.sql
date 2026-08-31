-- Operator-managed portal configuration: the storage behind AURA's
-- "Cloud Captive Portal" configuration page. One row, every column nullable —
-- null always means "fall back to the environment variable", so an empty
-- table reproduces pre-existing behaviour exactly.

CREATE TABLE "public"."PortalConfig" (
  "id"                       TEXT NOT NULL DEFAULT 'default',
  "sponsorshipEnabled"       BOOLEAN,
  "sponsorAllowedDomains"    TEXT,
  "sponsorAllowedAddresses"  TEXT,
  "sponsorshipTtlSeconds"    INTEGER,
  "sponsorshipMaxPerSession" INTEGER,
  "guestFieldsEnabled"       TEXT,
  "guestFieldsRequired"      TEXT,
  "updatedBy"                TEXT,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PortalConfig_pkey" PRIMARY KEY ("id")
);
