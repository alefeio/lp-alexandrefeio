-- CreateEnum
CREATE TYPE "CampaignSourcePlatform" AS ENUM ('GOOGLE_ADS', 'META_ADS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CampaignFileFormat" AS ENUM ('CSV', 'XLSX');

-- CreateEnum
CREATE TYPE "CampaignImportStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'NEEDS_SHEET_SELECTION', 'NEEDS_MAPPING', 'PROCESSING', 'READY', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "CampaignNumberLocale" AS ENUM ('PT_BR', 'EN_US');

-- CreateEnum
CREATE TYPE "CampaignCurrency" AS ENUM ('BRL', 'USD', 'OTHER');

-- CreateTable
CREATE TABLE "campaign_data_import" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourcePlatform" "CampaignSourcePlatform" NOT NULL,
    "fileFormat" "CampaignFileFormat" NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "rawStoragePath" TEXT NOT NULL,
    "normalizedStoragePath" TEXT,
    "status" "CampaignImportStatus" NOT NULL,
    "sheetNames" JSONB,
    "selectedSheet" TEXT,
    "rowCount" INTEGER,
    "columnCount" INTEGER,
    "columnMapping" JSONB,
    "availableDimensions" JSONB,
    "availableMetrics" JSONB,
    "warnings" JSONB,
    "numberLocale" "CampaignNumberLocale",
    "currency" "CampaignCurrency",
    "failureCode" TEXT,
    "parsedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_data_import_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_data_import_projectId_createdAt_idx" ON "campaign_data_import"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "campaign_data_import_userId_projectId_sha256_idx" ON "campaign_data_import"("userId", "projectId", "sha256");

-- AddForeignKey
ALTER TABLE "campaign_data_import" ADD CONSTRAINT "campaign_data_import_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_data_import" ADD CONSTRAINT "campaign_data_import_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
