-- Carrying a portal session from the OS captive-portal window into the real
-- browser.
--
-- Measured on 2026-08-14 against macOS: the Captive Network Assistant and
-- Safari are separate applications with separate cookie stores. A guest handed
-- from one to the other arrives with no `cwp_session` cookie and lands on
-- "Your session has ended", however fresh the session actually is. A
-- single-use token in the hand-off link is the only thing that can cross that
-- boundary.
--
-- Additive: every column is nullable, so existing rows and the open guest path
-- are untouched.

ALTER TABLE "public"."GuestSession"
  ADD COLUMN IF NOT EXISTS "handoffTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "handoffExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "handoffUsedAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "handoffUsedIp"    TEXT;

-- Unique so a token can only ever select one session, and so redemption can be
-- a single conditional UPDATE rather than a read-then-write race.
CREATE UNIQUE INDEX IF NOT EXISTS "GuestSession_handoffTokenHash_key"
  ON "public"."GuestSession"("handoffTokenHash");
