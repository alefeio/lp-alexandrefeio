-- CreateEnum
CREATE TYPE "LandingPageLeadStatus" AS ENUM ('NEW', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LandingPageMetricEvent" AS ENUM ('PAGE_VIEW', 'CTA_CLICK', 'WHATSAPP_CLICK', 'FORM_START', 'FORM_SUBMIT');

-- CreateTable
CREATE TABLE "landing_page_lead" (
    "id" TEXT NOT NULL,
    "landingPageProjectId" TEXT NOT NULL,
    "publicationId" TEXT,
    "formSectionId" TEXT NOT NULL,
    "submittedData" JSONB NOT NULL,
    "status" "LandingPageLeadStatus" NOT NULL DEFAULT 'NEW',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_page_lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_page_metric_daily" (
    "id" TEXT NOT NULL,
    "landingPageProjectId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "eventType" "LandingPageMetricEvent" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_page_metric_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "landing_page_lead_idempotency_key" ON "landing_page_lead"("landingPageProjectId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "landing_page_lead_landingPageProjectId_createdAt_idx" ON "landing_page_lead"("landingPageProjectId", "createdAt");

-- CreateIndex
CREATE INDEX "landing_page_lead_publicationId_idx" ON "landing_page_lead"("publicationId");

-- CreateIndex
CREATE INDEX "landing_page_lead_landingPageProjectId_status_idx" ON "landing_page_lead"("landingPageProjectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "landing_page_metric_daily_key" ON "landing_page_metric_daily"("landingPageProjectId", "publicationId", "date", "eventType");

-- CreateIndex
CREATE INDEX "landing_page_metric_daily_landingPageProjectId_date_idx" ON "landing_page_metric_daily"("landingPageProjectId", "date");

-- AddForeignKey
ALTER TABLE "landing_page_lead" ADD CONSTRAINT "landing_page_lead_landingPageProjectId_fkey" FOREIGN KEY ("landingPageProjectId") REFERENCES "landing_page_project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_page_lead" ADD CONSTRAINT "landing_page_lead_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "landing_page_publication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_page_metric_daily" ADD CONSTRAINT "landing_page_metric_daily_landingPageProjectId_fkey" FOREIGN KEY ("landingPageProjectId") REFERENCES "landing_page_project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_page_metric_daily" ADD CONSTRAINT "landing_page_metric_daily_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "landing_page_publication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
