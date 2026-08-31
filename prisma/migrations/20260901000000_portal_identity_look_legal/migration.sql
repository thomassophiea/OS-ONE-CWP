-- Portal identity (admin-only), look, offered languages, and legal documents.
-- Every column nullable; null preserves pre-existing behaviour exactly.
ALTER TABLE "public"."PortalConfig" ADD COLUMN "displayName" TEXT;
ALTER TABLE "public"."PortalConfig" ADD COLUMN "description" TEXT;
ALTER TABLE "public"."PortalConfig" ADD COLUMN "brandColor" TEXT;
ALTER TABLE "public"."PortalConfig" ADD COLUMN "brandAlignment" TEXT;
ALTER TABLE "public"."PortalConfig" ADD COLUMN "brandFooterEnabled" BOOLEAN;
ALTER TABLE "public"."PortalConfig" ADD COLUMN "localesEnabled" TEXT;
ALTER TABLE "public"."PortalConfig" ADD COLUMN "termsText" TEXT;
ALTER TABLE "public"."PortalConfig" ADD COLUMN "privacyPolicyEnabled" BOOLEAN;
ALTER TABLE "public"."PortalConfig" ADD COLUMN "privacyPolicyText" TEXT;
ALTER TABLE "public"."PortalConfig" ADD COLUMN "marketingEnabled" BOOLEAN;
ALTER TABLE "public"."PortalConfig" ADD COLUMN "marketingText" TEXT;

-- Consent flags on the session record: choices, not personal data.
ALTER TABLE "public"."GuestSession" ADD COLUMN "privacyPolicyAccepted" BOOLEAN;
ALTER TABLE "public"."GuestSession" ADD COLUMN "marketingConsent" BOOLEAN;
