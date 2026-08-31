-- Employee sponsorship: a guest names an employee, the employee decides, and
-- an approval releases the same presigned gateway callback the consent flow
-- issues. This table records the request, the decision, and the audit trail.
--
-- The approval credential itself is never stored: `tokenHash` is the SHA-256
-- of a 32-byte random token that exists only inside the emailed URL. Guest
-- name and email follow the session's storage prohibition — under
-- `personalDataAllowed = false` those columns are never written.

CREATE TYPE "public"."SponsorshipStatus" AS ENUM (
  'PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'CANCELLED'
);

CREATE TABLE "public"."SponsorshipRequest" (
  "id"                    TEXT NOT NULL,
  "status"                "public"."SponsorshipStatus" NOT NULL DEFAULT 'PENDING',
  "tokenHash"             TEXT NOT NULL,
  "sessionId"             TEXT NOT NULL,
  "clientMac"             TEXT,
  "guestName"             TEXT,
  "guestEmail"            TEXT,
  "sponsorEmail"          TEXT NOT NULL,
  "ssid"                  TEXT,
  "apName"                TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,
  "expiresAt"             TIMESTAMP(3) NOT NULL,
  "emailSentAt"           TIMESTAMP(3),
  "viewedAt"              TIMESTAMP(3),
  "decidedAt"             TIMESTAMP(3),
  "approvedAt"            TIMESTAMP(3),
  "deniedAt"              TIMESTAMP(3),
  "decisionIp"            TEXT,
  "decisionUserAgent"     TEXT,
  "authorizationIssuedAt" TIMESTAMP(3),
  "checkCount"            INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "SponsorshipRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SponsorshipRequest_tokenHash_key"
  ON "public"."SponsorshipRequest"("tokenHash");
CREATE INDEX "SponsorshipRequest_sessionId_idx"
  ON "public"."SponsorshipRequest"("sessionId");
CREATE INDEX "SponsorshipRequest_status_idx"
  ON "public"."SponsorshipRequest"("status");
CREATE INDEX "SponsorshipRequest_clientMac_idx"
  ON "public"."SponsorshipRequest"("clientMac");
CREATE INDEX "SponsorshipRequest_sponsorEmail_idx"
  ON "public"."SponsorshipRequest"("sponsorEmail");
CREATE INDEX "SponsorshipRequest_expiresAt_idx"
  ON "public"."SponsorshipRequest"("expiresAt");
CREATE INDEX "SponsorshipRequest_createdAt_idx"
  ON "public"."SponsorshipRequest"("createdAt");
CREATE INDEX "SponsorshipRequest_status_expiresAt_idx"
  ON "public"."SponsorshipRequest"("status", "expiresAt");

ALTER TABLE "public"."SponsorshipRequest"
  ADD CONSTRAINT "SponsorshipRequest_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "public"."GuestSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
