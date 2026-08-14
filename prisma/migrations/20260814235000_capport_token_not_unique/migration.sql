-- The CAPPORT per-client token is derived from the station MAC, so it is stable
-- across visits by design — that stability is what lets a DHCP server compute
-- the same URI without coordinating with the portal.
--
-- Indexing it as UNIQUE therefore made a guest's *second* connection fail: the
-- insert collided, the portal could not find a matching redirect signature, and
-- the visit ended on "the portal is temporarily unavailable". A returning guest
-- could never get online again.
--
-- It identifies a device across visits rather than one session, so the lookup
-- takes the most recent session and the index becomes an ordinary one.

DROP INDEX IF EXISTS "GuestSession_capportTokenHash_key";

CREATE INDEX IF NOT EXISTS "GuestSession_capportTokenHash_idx"
  ON "public"."GuestSession"("capportTokenHash");
