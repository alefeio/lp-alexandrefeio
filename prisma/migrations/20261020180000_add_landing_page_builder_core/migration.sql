-- CreateEnum
CREATE TYPE "LandingPageStatus" AS ENUM ('DRAFT', 'READY_TO_PREVIEW', 'PUBLISHED', 'UNPUBLISHED');

-- CreateTable
CREATE TABLE "landing_page_project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "courseId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "LandingPageStatus" NOT NULL DEFAULT 'DRAFT',
    "draftDocument" JSONB NOT NULL,
    "draftRevision" INTEGER NOT NULL DEFAULT 1,
    "publishedPublicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_page_project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_page_publication" (
    "id" TEXT NOT NULL,
    "landingPageProjectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "publishedSlug" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landing_page_publication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "landing_page_project_slug_key" ON "landing_page_project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "landing_page_project_publishedPublicationId_key" ON "landing_page_project"("publishedPublicationId");

-- CreateIndex
CREATE INDEX "landing_page_project_userId_updatedAt_idx" ON "landing_page_project"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "landing_page_project_projectId_idx" ON "landing_page_project"("projectId");

-- CreateIndex
CREATE INDEX "landing_page_project_courseId_idx" ON "landing_page_project"("courseId");

-- CreateIndex
CREATE INDEX "landing_page_publication_landingPageProjectId_publishedAt_idx" ON "landing_page_publication"("landingPageProjectId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "landing_page_publication_landingPageProjectId_version_key" ON "landing_page_publication"("landingPageProjectId", "version");

-- AddForeignKey
ALTER TABLE "landing_page_project" ADD CONSTRAINT "landing_page_project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_page_project" ADD CONSTRAINT "landing_page_project_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_page_project" ADD CONSTRAINT "landing_page_project_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_page_publication" ADD CONSTRAINT "landing_page_publication_landingPageProjectId_fkey" FOREIGN KEY ("landingPageProjectId") REFERENCES "landing_page_project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_page_project" ADD CONSTRAINT "landing_page_project_publishedPublicationId_fkey" FOREIGN KEY ("publishedPublicationId") REFERENCES "landing_page_publication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
