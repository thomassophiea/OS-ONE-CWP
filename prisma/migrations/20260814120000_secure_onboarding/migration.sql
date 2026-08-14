-- Secure guest onboarding.
--
-- Purely additive. `GuestSession` gains one boolean with a default, so every
-- existing row keeps working and the open guest path is unaffected: a session
-- with `onboardingRequested = false` behaves exactly as it did before this
-- migration existed.
--
-- `OnboardingSession` holds no credential material. The secure network's
-- passphrase is fetched from the credential provider when a provisioning
-- artifact is generated and is never written here.

-- ------------------------------------------------------- GuestSession (add-only)
ALTER TABLE "public"."GuestSession"
  ADD COLUMN IF NOT EXISTS "onboardingRequested" BOOLEAN NOT NULL DEFAULT false;

-- ------------------------------------------------------------------- new enums
DO $$ BEGIN
  CREATE TYPE "public"."OnboardingMethod" AS ENUM ('APPLE_PROFILE', 'WIFI_QR', 'MANUAL', 'WINDOWS_PROFILE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."OnboardingPlatform" AS ENUM ('IOS', 'IPADOS', 'ANDROID', 'MACOS', 'WINDOWS', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."OnboardingStatus" AS ENUM (
    'OFFERED', 'STARTED', 'PROFILE_DOWNLOADED', 'QR_DISPLAYED',
    'MANUAL_SETUP_VIEWED', 'COMPLETED', 'FAILED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------------- new table
CREATE TABLE IF NOT EXISTS "public"."OnboardingSession" (
  "id"                 TEXT NOT NULL,
  "tokenHash"          TEXT NOT NULL,
  "sessionId"          TEXT,
  "guestId"            TEXT,
  "clientMac"          TEXT,
  "clientMacRaw"       TEXT,
  "clientIp"           TEXT,
  "sourceIp"           TEXT,
  "userAgent"          TEXT,
  "platform"           "public"."OnboardingPlatform" NOT NULL DEFAULT 'OTHER',
  "platformSource"     TEXT,
  "sourceSsid"         TEXT,
  "sourceWlan"         TEXT,
  "targetSsid"         TEXT NOT NULL,
  "targetServiceId"    TEXT,
  "credentialProvider" TEXT NOT NULL,
  "method"             "public"."OnboardingMethod",
  "status"             "public"."OnboardingStatus" NOT NULL DEFAULT 'OFFERED',
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  "expiresAt"          TIMESTAMP(3) NOT NULL,
  "startedAt"          TIMESTAMP(3),
  "profileRequestedAt" TIMESTAMP(3),
  "qrDisplayedAt"      TIMESTAMP(3),
  "manualViewedAt"     TIMESTAMP(3),
  "completedAt"        TIMESTAMP(3),
  "failedAt"           TIMESTAMP(3),
  "failureReason"      TEXT,
  "verifiedServiceId"  TEXT,
  "verifiedAt"         TIMESTAMP(3),
  "lastCheckedAt"      TIMESTAMP(3),
  "checkCount"         INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "OnboardingSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingSession_tokenHash_key"    ON "public"."OnboardingSession"("tokenHash");
CREATE INDEX        IF NOT EXISTS "OnboardingSession_sessionId_idx"    ON "public"."OnboardingSession"("sessionId");
CREATE INDEX        IF NOT EXISTS "OnboardingSession_clientMac_idx"    ON "public"."OnboardingSession"("clientMac");
CREATE INDEX        IF NOT EXISTS "OnboardingSession_status_idx"       ON "public"."OnboardingSession"("status");
CREATE INDEX        IF NOT EXISTS "OnboardingSession_createdAt_idx"    ON "public"."OnboardingSession"("createdAt");
CREATE INDEX        IF NOT EXISTS "OnboardingSession_expiresAt_idx"    ON "public"."OnboardingSession"("expiresAt");
CREATE INDEX        IF NOT EXISTS "OnboardingSession_status_createdAt_idx" ON "public"."OnboardingSession"("status", "createdAt");

-- The portal visit an onboarding grew out of. ON DELETE SET NULL rather than
-- CASCADE: an onboarding record is an audit artifact in its own right and must
-- survive session retention sweeps.
ALTER TABLE "public"."OnboardingSession"
  DROP CONSTRAINT IF EXISTS "OnboardingSession_sessionId_fkey";
ALTER TABLE "public"."OnboardingSession"
  ADD CONSTRAINT "OnboardingSession_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "public"."GuestSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
