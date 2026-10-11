"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import {
  createLessonTaskForUser,
  createManualTaskForUser,
  createReminderForUser,
  createReviewReminderForUser,
  createTaskFromRecommendationForUser,
  dismissReminderForUser,
  markReminderReadForUser,
  saveBudgetPlanForUser,
  setTaskStatusForUser,
} from "@/lib/plan/service";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createManualTaskAction(projectId: string, formData: FormData) {
  const session = await requireSession();
  const result = await createManualTaskForUser(session.user.id, projectId, {
    title: text(formData, "title"),
    description: text(formData, "description"),
    priority: text(formData, "priority") || "MEDIUM",
    dueAt: text(formData, "dueAt"),
  });
  if (!result.ok) return result;
  redirect(`/app/projetos/${projectId}/plano`);
}

export async function addRecommendationTaskAction(projectId: string, recommendationId: string) {
  const session = await requireSession();
  const result = await createTaskFromRecommendationForUser(session.user.id, projectId, recommendationId);
  if (!result.ok) return result;
  redirect(`/app/projetos/${projectId}/plano`);
}

export async function addReviewReminderAction(projectId: string, recommendationId: string, formData: FormData) {
  const session = await requireSession();
  const result = await createReviewReminderForUser(session.user.id, projectId, recommendationId, text(formData, "remindAt"));
  if (!result.ok) return result;
  redirect(`/app/projetos/${projectId}/plano`);
}

export async function createReminderAction(projectId: string, formData: FormData) {
  const session = await requireSession();
  const lead = text(formData, "leadDays");
  const dueAt = text(formData, "dueAt");
  let remindAt = text(formData, "remindAt");
  if (!remindAt && dueAt && lead) {
    const due = new Date(dueAt);
    if (!Number.isNaN(due.getTime())) {
      due.setUTCDate(due.getUTCDate() - Number(lead));
      remindAt = due.toISOString();
    }
  }
  const result = await createReminderForUser(session.user.id, projectId, {
    title: text(formData, "title"),
    message: text(formData, "message"),
    remindAt,
    type: text(formData, "type") || "PLANNING",
    taskId: text(formData, "taskId") || undefined,
    emailEnabled: formData.get("emailEnabled") === "on",
  });
  if (!result.ok) return result;
  redirect(`/app/projetos/${projectId}/plano`);
}

export async function saveBudgetAction(projectId: string, formData: FormData) {
  const session = await requireSession();
  const result = await saveBudgetPlanForUser(session.user.id, projectId, {
    currentBalance: text(formData, "currentBalance"),
    plannedDaily: text(formData, "plannedDaily"),
    balanceAsOf: text(formData, "balanceAsOf"),
    reminderLeadDays: text(formData, "reminderLeadDays"),
    emailReminderEnabled: formData.get("emailReminderEnabled") === "on",
  });
  if (!result.ok) return result;
  redirect(`/app/projetos/${projectId}/plano`);
}

export async function taskStatusAction(projectId: string, taskId: string, status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED") {
  const session = await requireSession();
  await setTaskStatusForUser(session.user.id, taskId, status);
  redirect(`/app/projetos/${projectId}/plano`);
}

export async function readReminderAction(reminderId: string) {
  const session = await requireSession();
  await markReminderReadForUser(session.user.id, reminderId);
  redirect("/app/alertas");
}

export async function dismissReminderAction(reminderId: string) {
  const session = await requireSession();
  await dismissReminderForUser(session.user.id, reminderId);
  redirect("/app/alertas");
}

export async function lessonTaskAction(projectId: string, lessonResultId: string, formData: FormData) {
  const session = await requireSession();
  const result = await createLessonTaskForUser(session.user.id, projectId, lessonResultId, text(formData, "title"));
  if (!result.ok) return result;
  redirect(`/app/projetos/${projectId}/plano`);
}
