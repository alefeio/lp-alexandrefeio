-- Hardening do runtime público. Tabela nova e coluna opcional.
-- Não apaga lead, métrica, mídia nem publicação.

ALTER TABLE "landing_page_lead" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE TABLE "landing_page_rate_limit_bucket" (
    "id" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "windowBucket" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landing_page_rate_limit_bucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "landing_page_rate_limit_bucket_key" ON "landing_page_rate_limit_bucket"("namespace", "hashedKey", "windowBucket");

CREATE INDEX "landing_page_rate_limit_bucket_expiresAt_idx" ON "landing_page_rate_limit_bucket"("expiresAt");
