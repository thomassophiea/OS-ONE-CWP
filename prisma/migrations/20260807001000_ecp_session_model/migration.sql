-- Reshape GuestSession around the ECP protocol actually spoken by the gateway.
--
-- Written by hand rather than generated so existing rows keep their data:
-- every field that has an equivalent in the new model is RENAMEd, not dropped
-- and recreated. Only genuinely dead columns (leftovers from an earlier design
-- that assumed a RADIUS/NAC-style handshake) are removed.

-- ----------------------------------------------------------------- enum swap
-- 'REDIRECTED' is retired; the four new states describe the authorization
-- exchange that the old model had no vocabulary for.
CREATE TYPE "public"."SessionStatus_new" AS ENUM (
  'STARTED', 'ACCEPTED', 'AUTHORIZED', 'AUTH_FAILED', 'REJECTED',
  'BLOCKED_REDIRECT', 'ERROR', 'EXPIRED', 'DISCONNECTED'
);

ALTER TABLE "public"."GuestSession" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "public"."GuestSession"
  ALTER COLUMN "status" TYPE "public"."SessionStatus_new"
  USING (
    CASE "status"::text
      WHEN 'REDIRECTED' THEN 'ACCEPTED'
      ELSE "status"::text
    END
  )::"public"."SessionStatus_new";

DROP TYPE "public"."SessionStatus";
ALTER TYPE "public"."SessionStatus_new" RENAME TO "SessionStatus";

ALTER TABLE "public"."GuestSession"
  ALTER COLUMN "status" SET DEFAULT 'STARTED';

-- ------------------------------------------------------------ column renames
ALTER TABLE "public"."GuestSession" RENAME COLUMN "sessionToken" TO "gatewayToken";
ALTER TABLE "public"."GuestSession" RENAME COLUMN "hwcIp"        TO "gatewayHost";
ALTER TABLE "public"."GuestSession" RENAME COLUMN "hwcPort"      TO "gatewayPort";
ALTER TABLE "public"."GuestSession" RENAME COLUMN "userIp"       TO "clientIp";
ALTER TABLE "public"."GuestSession" RENAME COLUMN "dest"         TO "originalDest";
ALTER TABLE "public"."GuestSession" RENAME COLUMN "role"         TO "preAuthRole";
ALTER TABLE "public"."GuestSession" RENAME COLUMN "ap"           TO "apName";
ALTER TABLE "public"."GuestSession" RENAME COLUMN "aploc"        TO "apLocation";
ALTER TABLE "public"."GuestSession" RENAME COLUMN "sn"           TO "apSerial";
ALTER TABLE "public"."GuestSession" RENAME COLUMN "rawQuery"     TO "gatewayParams";
ALTER TABLE "public"."GuestSession" RENAME COLUMN "rawHeaders"   TO "requestHeaders";

-- --------------------------------------------------------------- dead columns
-- None of these were ever populated by the gateway: the XCC ECP redirect
-- carries no site, controller, NAS-id or separate success URL.
ALTER TABLE "public"."GuestSession" DROP COLUMN IF EXISTS "site";
ALTER TABLE "public"."GuestSession" DROP COLUMN IF EXISTS "controller";
ALTER TABLE "public"."GuestSession" DROP COLUMN IF EXISTS "nasId";
ALTER TABLE "public"."GuestSession" DROP COLUMN IF EXISTS "controllerSessionId";
ALTER TABLE "public"."GuestSession" DROP COLUMN IF EXISTS "redirectUrl";
ALTER TABLE "public"."GuestSession" DROP COLUMN IF EXISTS "successUrl";

-- ---------------------------------------------------------------- new columns
ALTER TABLE "public"."GuestSession"
  ADD COLUMN "clientMacRaw"             TEXT,
  ADD COLUMN "bssid"                    TEXT,
  ADD COLUMN "vns"                      TEXT,
  ADD COLUMN "redirectSignature"        TEXT,
  ADD COLUMN "redirectSignedAt"         TIMESTAMP(3),
  ADD COLUMN "redirectExpiresAt"        TIMESTAMP(3),
  ADD COLUMN "sanitizedDest"            TEXT,
  ADD COLUMN "destRejectionReason"      TEXT,
  ADD COLUMN "csrfTokenHash"            TEXT,
  ADD COLUMN "authorizationAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "authorizedAt"             TIMESTAMP(3),
  ADD COLUMN "authorizationResult"      TEXT,
  ADD COLUMN "failureReason"            TEXT,
  ADD COLUMN "authorizedRole"           TEXT,
  ADD COLUMN "disconnectedAt"           TIMESTAMP(3);

-- -------------------------------------------------------------------- indexes
-- Unique on the redirect signature: a captured redirect URL cannot be replayed
-- into a second portal session.
CREATE UNIQUE INDEX "GuestSession_redirectSignature_key"
  ON "public"."GuestSession"("redirectSignature");
CREATE INDEX "GuestSession_gatewayToken_idx"
  ON "public"."GuestSession"("gatewayToken");
CREATE INDEX "GuestSession_authorizedAt_idx"
  ON "public"."GuestSession"("authorizedAt");
CREATE INDEX "GuestSession_status_createdAt_idx"
  ON "public"."GuestSession"("status", "createdAt");

-- ----------------------------------------------------------------- AuditEvent
ALTER TABLE "public"."AuditEvent"
  ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'info';

CREATE INDEX "AuditEvent_sessionId_idx" ON "public"."AuditEvent"("sessionId");
CREATE INDEX "AuditEvent_action_idx"    ON "public"."AuditEvent"("action");
CREATE INDEX "AuditEvent_createdAt_idx" ON "public"."AuditEvent"("createdAt");
CREATE INDEX "AuditEvent_severity_idx"  ON "public"."AuditEvent"("severity");

-- Audit rows follow their session when it is purged.
ALTER TABLE "public"."AuditEvent" DROP CONSTRAINT "AuditEvent_sessionId_fkey";
ALTER TABLE "public"."AuditEvent"
  ADD CONSTRAINT "AuditEvent_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "public"."GuestSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
