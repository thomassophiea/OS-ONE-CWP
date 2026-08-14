-- Session-level personal-data persistence policy, and the guest-supplied
-- values it governs.
--
-- `personalDataAllowed` defaults to true so every existing row keeps exactly
-- the meaning it had before this migration: those sessions were created when
-- no such control existed, and marking them retroactively prohibited would be
-- a claim about a choice nobody made.
--
-- `guestFields` is only ever written when the policy allows it. There is no
-- companion "redacted" column and no cleanup job, because the design is to
-- avoid the write rather than undo it.

ALTER TABLE "public"."GuestSession"
  ADD COLUMN IF NOT EXISTS "personalDataAllowed" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "privacyChoiceAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "guestFields"         JSONB;

-- Operators need to answer "how many guests exercised the control?" without
-- scanning the table.
CREATE INDEX IF NOT EXISTS "GuestSession_personalDataAllowed_idx"
  ON "public"."GuestSession"("personalDataAllowed");
