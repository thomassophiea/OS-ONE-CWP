-- AlterTable
ALTER TABLE "PortalConfig" ADD COLUMN     "backgroundData" BYTEA,
ADD COLUMN     "backgroundMimeType" TEXT,
ADD COLUMN     "backgroundUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "logoData" BYTEA,
ADD COLUMN     "logoMimeType" TEXT,
ADD COLUMN     "logoUpdatedAt" TIMESTAMP(3);
