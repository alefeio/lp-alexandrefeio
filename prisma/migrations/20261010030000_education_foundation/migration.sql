-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('TEXT', 'HEADING', 'CALLOUT', 'EXAMPLE', 'CHECKPOINT', 'ACTIVITY', 'CHECKLIST', 'RESULT', 'CONCLUSION', 'IMAGE');

-- CreateTable
CREATE TABLE "course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "bundlePriceCents" INTEGER,
    "coverImageUrl" TEXT,
    "coverImagePublicId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "bundlePriceCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "publicPreview" TEXT,
    "estimatedMinutes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "accessType" "AccessType" NOT NULL,
    "priceCents" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_block" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "blockKey" TEXT NOT NULL,
    "type" "BlockType" NOT NULL,
    "position" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "countsForProgress" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastBlockKey" TEXT,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_block_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "blockKey" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_block_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_response" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "blockKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "blockKey" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "blockKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_result" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_slug_key" ON "course"("slug");

-- CreateIndex
CREATE INDEX "module_courseId_idx" ON "module"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "module_courseId_slug_key" ON "module"("courseId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_slug_key" ON "lesson"("slug");

-- CreateIndex
CREATE INDEX "lesson_moduleId_idx" ON "lesson"("moduleId");

-- CreateIndex
CREATE INDEX "lesson_status_idx" ON "lesson"("status");

-- CreateIndex
CREATE INDEX "lesson_block_lessonId_position_idx" ON "lesson_block"("lessonId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_block_lessonId_blockKey_key" ON "lesson_block"("lessonId", "blockKey");

-- CreateIndex
CREATE INDEX "lesson_progress_userId_idx" ON "lesson_progress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_userId_lessonId_key" ON "lesson_progress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "lesson_block_progress_userId_lessonId_idx" ON "lesson_block_progress"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_block_progress_userId_lessonId_blockKey_key" ON "lesson_block_progress"("userId", "lessonId", "blockKey");

-- CreateIndex
CREATE INDEX "lesson_response_userId_lessonId_idx" ON "lesson_response"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_response_userId_lessonId_blockKey_key" ON "lesson_response"("userId", "lessonId", "blockKey");

-- CreateIndex
CREATE INDEX "lesson_note_userId_idx" ON "lesson_note"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_note_userId_lessonId_blockKey_key" ON "lesson_note"("userId", "lessonId", "blockKey");

-- CreateIndex
CREATE INDEX "lesson_bookmark_userId_idx" ON "lesson_bookmark"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_bookmark_userId_lessonId_blockKey_key" ON "lesson_bookmark"("userId", "lessonId", "blockKey");

-- CreateIndex
CREATE INDEX "lesson_result_userId_idx" ON "lesson_result"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_result_userId_lessonId_key" ON "lesson_result"("userId", "lessonId");

-- AddForeignKey
ALTER TABLE "module" ADD CONSTRAINT "module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_block" ADD CONSTRAINT "lesson_block_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_block_progress" ADD CONSTRAINT "lesson_block_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_block_progress" ADD CONSTRAINT "lesson_block_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_response" ADD CONSTRAINT "lesson_response_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_response" ADD CONSTRAINT "lesson_response_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_note" ADD CONSTRAINT "lesson_note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_note" ADD CONSTRAINT "lesson_note_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_bookmark" ADD CONSTRAINT "lesson_bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_bookmark" ADD CONSTRAINT "lesson_bookmark_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_result" ADD CONSTRAINT "lesson_result_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_result" ADD CONSTRAINT "lesson_result_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
