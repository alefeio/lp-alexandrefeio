-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectObjective" AS ENUM ('LEADS', 'SALES', 'WHATSAPP', 'STORE_VISITS', 'AWARENESS', 'UNDEFINED');

-- CreateEnum
CREATE TYPE "DestinationType" AS ENUM ('LANDING_PAGE', 'WEBSITE', 'WHATSAPP', 'INSTAGRAM', 'MARKETPLACE', 'OTHER', 'UNDEFINED');

-- CreateEnum
CREATE TYPE "DiagnosticStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('LEARN', 'EXECUTE', 'ANALYZE', 'WAIT');

-- CreateEnum
CREATE TYPE "RecommendationPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT,
    "primaryOffer" TEXT,
    "objective" "ProjectObjective",
    "usesGoogleAds" BOOLEAN,
    "usesMetaAds" BOOLEAN,
    "destinationType" "DestinationType",
    "monthlyMediaBudgetCents" INTEGER,
    "averageTicketCents" INTEGER,
    "websiteUrl" TEXT,
    "serviceArea" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "DiagnosticStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "answers" JSONB NOT NULL,
    "dimensionScores" JSONB,
    "overallScore" INTEGER,
    "primaryBottleneck" TEXT,
    "resultSnapshot" JSONB,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "diagnosticId" TEXT,
    "type" "RecommendationType" NOT NULL,
    "priority" "RecommendationPriority" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rationale" TEXT,
    "lessonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_pkey" PRIMARY KEY ("id")
);

-- DropIndex
DROP INDEX "lesson_result_userId_lessonId_key";

-- AlterTable
ALTER TABLE "lesson_result" ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE INDEX "project_userId_updatedAt_idx" ON "project"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "diagnostic_projectId_createdAt_idx" ON "diagnostic"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "diagnostic_userId_idx" ON "diagnostic"("userId");

-- CreateIndex
CREATE INDEX "recommendation_projectId_createdAt_idx" ON "recommendation"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "recommendation_diagnosticId_idx" ON "recommendation"("diagnosticId");

-- CreateIndex
CREATE INDEX "lesson_result_userId_lessonId_idx" ON "lesson_result"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "lesson_result_projectId_idx" ON "lesson_result"("projectId");

-- Um resultado pessoal por usuário e aula. Vários com projectId nulo violariam a regra.
CREATE UNIQUE INDEX "lesson_result_personal_key" ON "lesson_result"("userId", "lessonId") WHERE "projectId" IS NULL;

-- Um resultado por projeto para a mesma aula.
CREATE UNIQUE INDEX "lesson_result_project_key" ON "lesson_result"("userId", "lessonId", "projectId") WHERE "projectId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic" ADD CONSTRAINT "diagnostic_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic" ADD CONSTRAINT "diagnostic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_diagnosticId_fkey" FOREIGN KEY ("diagnosticId") REFERENCES "diagnostic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_result" ADD CONSTRAINT "lesson_result_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
