-- How guests get on: 'open' | 'terms' | 'form' | 'sponsored'. Null preserves
-- pre-existing behaviour exactly (derived: 'form' when guest fields are
-- enabled, otherwise 'terms').
ALTER TABLE "public"."PortalConfig" ADD COLUMN "accessPolicy" TEXT;
