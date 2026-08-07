-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."SessionStatus" AS ENUM ('STARTED', 'ACCEPTED', 'REDIRECTED', 'BLOCKED_REDIRECT', 'ERROR', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."AuditEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GuestSession" (
    "id" TEXT NOT NULL,
    "status" "public"."SessionStatus" NOT NULL DEFAULT 'STARTED',
    "clientMac" TEXT,
    "apMac" TEXT,
    "ssid" TEXT,
    "wlan" TEXT,
    "vlan" TEXT,
    "site" TEXT,
    "controller" TEXT,
    "nasId" TEXT,
    "sessionToken" TEXT,
    "controllerSessionId" TEXT,
    "userIp" TEXT,
    "sourceIp" TEXT,
    "userAgent" TEXT,
    "redirectUrl" TEXT,
    "successUrl" TEXT,
    "rawQuery" JSONB,
    "rawHeaders" JSONB,
    "acceptedTerms" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ap" TEXT,
    "aploc" TEXT,
    "dest" TEXT,
    "hwcIp" TEXT,
    "hwcPort" TEXT,
    "role" TEXT,
    "sn" TEXT,

    CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestSession_clientMac_idx" ON "public"."GuestSession"("clientMac" ASC);

-- CreateIndex
CREATE INDEX "GuestSession_createdAt_idx" ON "public"."GuestSession"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "GuestSession_ssid_idx" ON "public"."GuestSession"("ssid" ASC);

-- CreateIndex
CREATE INDEX "GuestSession_status_idx" ON "public"."GuestSession"("status" ASC);

-- AddForeignKey
ALTER TABLE "public"."AuditEvent" ADD CONSTRAINT "AuditEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

