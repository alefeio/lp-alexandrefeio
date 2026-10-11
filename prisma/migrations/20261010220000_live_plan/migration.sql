-- CreateEnum
CREATE TYPE "TaskSourceType" AS ENUM ('USER', 'DIAGNOSTIC', 'LESSON', 'PLANNING', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('DEADLINE', 'REVIEW', 'BUDGET', 'PLANNING');

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "lessonResultId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" "TaskSourceType" NOT NULL,
    "priority" "TaskPriority" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "type" "ReminderType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_budget_plan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "currentBalanceCents" INTEGER NOT NULL,
    "plannedDailyBudgetCents" INTEGER NOT NULL,
    "balanceAsOf" TIMESTAMP(3) NOT NULL,
    "reminderLeadDays" INTEGER NOT NULL,
    "emailReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_budget_plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_projectId_status_idx" ON "task"("projectId", "status");

-- CreateIndex
CREATE INDEX "task_recommendationId_idx" ON "task"("recommendationId");

-- CreateIndex
CREATE INDEX "task_lessonResultId_idx" ON "task"("lessonResultId");

-- Uma Recommendation só pode ter uma Task ativa. Concluída ou cancelada não bloqueia outra.
CREATE UNIQUE INDEX "task_active_recommendation_key" ON "task"("recommendationId") WHERE "recommendationId" IS NOT NULL AND "status" IN ('TODO', 'IN_PROGRESS');

-- CreateIndex
CREATE INDEX "reminder_projectId_remindAt_idx" ON "reminder"("projectId", "remindAt");

-- CreateIndex
CREATE INDEX "reminder_taskId_idx" ON "reminder"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "project_budget_plan_projectId_key" ON "project_budget_plan"("projectId");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_lessonResultId_fkey" FOREIGN KEY ("lessonResultId") REFERENCES "lesson_result"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_budget_plan" ADD CONSTRAINT "project_budget_plan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
