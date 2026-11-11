-- Additive: personal notes independent of LessonNote. Existing notes untouched.
CREATE TABLE "personal_note" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "lessonId" TEXT,
    "blockKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "personal_note_userId_updatedAt_idx" ON "personal_note"("userId", "updatedAt");
CREATE INDEX "personal_note_userId_lessonId_idx" ON "personal_note"("userId", "lessonId");

ALTER TABLE "personal_note" ADD CONSTRAINT "personal_note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "personal_note" ADD CONSTRAINT "personal_note_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
