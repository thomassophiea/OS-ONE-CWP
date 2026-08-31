-- The sponsor now chooses how long their approval stands (1h/8h/24h/1w or the
-- network default). Recorded on the request at decision time; applied to the
-- guest ledger's expiresAt when the gateway confirms the grant.

ALTER TABLE "public"."SponsorshipRequest"
  ADD COLUMN IF NOT EXISTS "accessDurationSeconds" INTEGER;
