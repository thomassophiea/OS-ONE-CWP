-- CAPPORT (RFC 8908) per-client API token.
--
-- The Captive Portal API has to answer "is *this* client captive?", and this
-- portal runs off-network behind the site's NAT — every guest arrives with the
-- same public source address, so the station cannot be identified from the
-- request itself. RFC 8908 §4 anticipates this: "If the API server needs
-- information about the client identity that is not otherwise visible to it,
-- the URI provided to the client during provisioning SHOULD be distinct per
-- client."
--
-- Additive and nullable: sessions created before this migration simply have no
-- token, and the API falls back to the safe answer.

ALTER TABLE "public"."GuestSession"
  ADD COLUMN IF NOT EXISTS "capportTokenHash" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "GuestSession_capportTokenHash_key"
  ON "public"."GuestSession"("capportTokenHash");
