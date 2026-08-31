-- Operator switch for the secure-onboarding offer. Null preserves the
-- pre-existing behaviour exactly: offered whenever a secure WLAN is
-- configured and readable.
ALTER TABLE "public"."PortalConfig" ADD COLUMN "secureAccessEnabled" BOOLEAN;
