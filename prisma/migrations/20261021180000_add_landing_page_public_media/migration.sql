-- CreateEnum
CREATE TYPE "LandingPageMediaType" AS ENUM ('LOGO', 'HERO_IMAGE', 'PORTFOLIO_IMAGE', 'TRUST_IMAGE', 'TESTIMONIAL_AVATAR', 'CREDENTIAL_IMAGE', 'GENERAL_IMAGE');

-- CreateEnum
CREATE TYPE "LandingPageMediaStatus" AS ENUM ('UPLOADING', 'READY', 'FAILED', 'DELETED');

-- CreateTable
CREATE TABLE "landing_page_media" (
    "id" TEXT NOT NULL,
    "landingPageProjectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LandingPageMediaType" NOT NULL,
    "status" "LandingPageMediaStatus" NOT NULL DEFAULT 'UPLOADING',
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_page_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "landing_page_media_storageKey_key" ON "landing_page_media"("storageKey");

-- CreateIndex
CREATE INDEX "landing_page_media_landingPageProjectId_status_idx" ON "landing_page_media"("landingPageProjectId", "status");

-- CreateIndex
CREATE INDEX "landing_page_media_userId_idx" ON "landing_page_media"("userId");

-- AddForeignKey
ALTER TABLE "landing_page_media" ADD CONSTRAINT "landing_page_media_landingPageProjectId_fkey" FOREIGN KEY ("landingPageProjectId") REFERENCES "landing_page_project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_page_media" ADD CONSTRAINT "landing_page_media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
