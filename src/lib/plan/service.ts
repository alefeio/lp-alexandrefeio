import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { parseMoneyToCents } from "@/lib/project/schema";
import { budgetRemindAt, coverageDays } from "@/lib/plan/budget";
import { chooseNextAction, type NextAction } from "@/lib/plan/next-action";
import { ownedProject } from "@/lib/project/service";

const OPEN = ["TODO", "IN_PROGRESS"] as const;
const title = z.string().trim().min(2, "Dê um título à ação.").max(140);
const description = z.string().trim().max(500).optional().transform((value) => (value ? value : null));
const priority = z.enum(["HIGH", "MEDIUM", "LOW"]);

export function parseWhen(value: string | undefined): Date | null | "invalid" {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "invalid";
  return date;
}

async function ownedActiveProject(userId: string, projectId: string) {
  const project = await getPrisma().project.findFirst({ where: ownedProject(userId, projectId) });
  if (!project) return { ok: false as const, message: "Projeto não encontrado." };
  if (project.status !== "ACTIVE") return { ok: false as const, message: "Projeto arquivado não recebe ação nova." };
  return { ok: true as const, project };
}

async function ownedTask(userId: string, taskId: string) {
  return getPrisma().task.findFirst({
    where: { id: taskId, project: { userId } },
    include: { project: true },
  });
}

export async function createManualTaskForUser(userId: string, projectId: string, raw: unknown) {
  const gate = await ownedActiveProject(userId, projectId);
  if (!gate.ok) return gate;
  const parsed = z.object({ title, description, priority, dueAt: z.string().optional() }).safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Revise a ação." };
  const dueAt = parseWhen(parsed.data.dueAt);
  if (dueAt === "invalid") return { ok: false as const, message: "Data inválida." };
  const task = await getPrisma().task.create({
    data: {
      projectId,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      dueAt,
      sourceType: "USER",
    },
  });
  return { ok: true as const, task, already: false };
}

export async function createTaskFromRecommendationForUser(userId: string, projectId: string, recommendationId: string) {
  const gate = await ownedActiveProject(userId, projectId);
  if (!gate.ok) return gate;
  const prisma = getPrisma();
  const recommendation = await prisma.recommendation.findFirst({
    where: { id: recommendationId, projectId, project: { userId } },
  });
  if (!recommendation) return { ok: false as const, message: "Recomendação não encontrada." };
  if (recommendation.type === "WAIT") return { ok: false as const, message: "Esta orientação pede espera, não uma tarefa agora." };

  try {
    const task = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findFirst({
        where: { recommendationId, status: { in: [...OPEN] } },
      });
      if (existing) return { task: existing, already: true };
      const created = await tx.task.create({
        data: {
          projectId,
          recommendationId,
          title: recommendation.title,
          description: recommendation.description,
          priority: recommendation.priority,
          sourceType: "DIAGNOSTIC",
        },
      });
      return { task: created, already: false };
    });
    return { ok: true as const, ...task };
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      const existing = await prisma.task.findFirst({ where: { recommendationId, status: { in: [...OPEN] } } });
      if (existing) return { ok: true as const, task: existing, already: true };
    }
    throw error;
  }
}

export async function createLessonTaskForUser(userId: string, projectId: string, lessonResultId: string, rawTitle: unknown) {
  const gate = await ownedActiveProject(userId, projectId);
  if (!gate.ok) return gate;
  const parsed = title.safeParse(rawTitle);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Dê um título à ação." };
  const result = await getPrisma().lessonResult.findFirst({
    where: { id: lessonResultId, userId, projectId },
  });
  if (!result) return { ok: false as const, message: "Resultado não encontrado." };
  const task = await getPrisma().task.create({
    data: {
      projectId,
      lessonResultId,
      title: parsed.data,
      sourceType: "LESSON",
      priority: "MEDIUM",
    },
  });
  return { ok: true as const, task };
}

export async function setTaskStatusForUser(userId: string, taskId: string, status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED") {
  const task = await ownedTask(userId, taskId);
  if (!task) return { ok: false as const, message: "Ação não encontrada." };
  if (task.project.status !== "ACTIVE" && status !== "DONE" && status !== "CANCELLED") {
    return { ok: false as const, message: "Projeto arquivado não recebe ação nova." };
  }
  const now = new Date();
  const data: Prisma.TaskUpdateInput =
    status === "DONE"
      ? { status, completedAt: now, cancelledAt: null }
      : status === "CANCELLED"
        ? { status, cancelledAt: now }
        : status === "IN_PROGRESS"
          ? { status, startedAt: task.startedAt ?? now, completedAt: null, cancelledAt: null }
          : { status, completedAt: null, cancelledAt: null };
  const updated = await getPrisma().task.update({ where: { id: task.id }, data });
  return { ok: true as const, task: updated };
}

export async function createReminderForUser(userId: string, projectId: string, raw: unknown) {
  const gate = await ownedActiveProject(userId, projectId);
  if (!gate.ok) return gate;
  const parsed = z
    .object({
      title,
      message: z.string().trim().max(280).optional().transform((value) => (value ? value : null)),
      remindAt: z.string(),
      type: z.enum(["DEADLINE", "REVIEW", "BUDGET", "PLANNING"]),
      taskId: z.string().optional(),
      emailEnabled: z.boolean().optional(),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Revise o lembrete." };
  const remindAt = parseWhen(parsed.data.remindAt);
  if (!remindAt || remindAt === "invalid") return { ok: false as const, message: "Informe quando lembrar." };
  if (parsed.data.taskId) {
    const task = await ownedTask(userId, parsed.data.taskId);
    if (!task || task.projectId !== projectId) return { ok: false as const, message: "Ação não encontrada." };
  }
  const reminder = await getPrisma().reminder.create({
    data: {
      projectId,
      taskId: parsed.data.taskId || null,
      type: parsed.data.type,
      title: parsed.data.title,
      message: parsed.data.message,
      remindAt,
      emailEnabled: parsed.data.emailEnabled ?? false,
    },
  });
  return { ok: true as const, reminder };
}

export async function createReviewReminderForUser(userId: string, projectId: string, recommendationId: string, remindAtRaw: string) {
  const gate = await ownedActiveProject(userId, projectId);
  if (!gate.ok) return gate;
  const recommendation = await getPrisma().recommendation.findFirst({
    where: { id: recommendationId, projectId, project: { userId }, type: "WAIT" },
  });
  if (!recommendation) return { ok: false as const, message: "Orientação não encontrada." };
  const remindAt = parseWhen(remindAtRaw);
  if (!remindAt || remindAt === "invalid") return { ok: false as const, message: "Informe quando revisar." };
  const existing = await getPrisma().reminder.findFirst({
    where: { projectId, type: "REVIEW", dismissedAt: null, title: recommendation.title, remindAt },
  });
  if (existing) return { ok: true as const, reminder: existing, already: true };
  const reminder = await getPrisma().reminder.create({
    data: {
      projectId,
      type: "REVIEW",
      title: recommendation.title,
      message: recommendation.description,
      remindAt,
      emailEnabled: false,
    },
  });
  return { ok: true as const, reminder, already: false };
}

export async function markReminderReadForUser(userId: string, reminderId: string) {
  const reminder = await getPrisma().reminder.findFirst({ where: { id: reminderId, project: { userId } } });
  if (!reminder) return { ok: false as const, message: "Lembrete não encontrado." };
  if (reminder.readAt) return { ok: true as const, reminder };
  const updated = await getPrisma().reminder.update({ where: { id: reminder.id }, data: { readAt: new Date() } });
  return { ok: true as const, reminder: updated };
}

export async function dismissReminderForUser(userId: string, reminderId: string) {
  const reminder = await getPrisma().reminder.findFirst({ where: { id: reminderId, project: { userId } } });
  if (!reminder) return { ok: false as const, message: "Lembrete não encontrado." };
  if (reminder.dismissedAt) return { ok: true as const, reminder };
  const now = new Date();
  const updated = await getPrisma().reminder.update({
    where: { id: reminder.id },
    data: { dismissedAt: now, readAt: reminder.readAt ?? now },
  });
  return { ok: true as const, reminder: updated };
}

export async function saveBudgetPlanForUser(userId: string, projectId: string, raw: unknown) {
  const gate = await ownedActiveProject(userId, projectId);
  if (!gate.ok) return gate;
  const parsed = z
    .object({
      currentBalance: z.string(),
      plannedDaily: z.string(),
      balanceAsOf: z.string(),
      reminderLeadDays: z.enum(["1", "2", "3"]),
      emailReminderEnabled: z.boolean().optional(),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: "Revise o planejamento." };
  const balance = parseMoneyToCents(parsed.data.currentBalance);
  const daily = parseMoneyToCents(parsed.data.plannedDaily);
  if (balance === "invalid" || balance === null || balance < 0) return { ok: false as const, message: "Informe o saldo em reais." };
  if (daily === "invalid" || daily === null || daily <= 0) return { ok: false as const, message: "O valor por dia precisa ser maior que zero." };
  const balanceAsOf = parseWhen(parsed.data.balanceAsOf);
  if (!balanceAsOf || balanceAsOf === "invalid") return { ok: false as const, message: "Informe a data do saldo." };
  const days = coverageDays(balance, daily);
  if (days === null) return { ok: false as const, message: "Não foi possível estimar a cobertura." };
  const leadDays = Number(parsed.data.reminderLeadDays);
  const emailReminderEnabled = parsed.data.emailReminderEnabled ?? false;
  const remindAt = budgetRemindAt(balanceAsOf, days, leadDays);

  const plan = await getPrisma().$transaction(async (tx) => {
    const saved = await tx.projectBudgetPlan.upsert({
      where: { projectId },
      create: {
        projectId,
        currentBalanceCents: balance,
        plannedDailyBudgetCents: daily,
        balanceAsOf,
        reminderLeadDays: leadDays,
        emailReminderEnabled,
      },
      update: {
        currentBalanceCents: balance,
        plannedDailyBudgetCents: daily,
        balanceAsOf,
        reminderLeadDays: leadDays,
        emailReminderEnabled,
      },
    });
    await tx.reminder.updateMany({
      where: { projectId, type: "BUDGET", dismissedAt: null },
      data: { dismissedAt: new Date() },
    });
    await tx.reminder.create({
      data: {
        projectId,
        type: "BUDGET",
        title: "Planejar recarga",
        remindAt,
        emailEnabled: emailReminderEnabled,
      },
    });
    return saved;
  });
  return { ok: true as const, plan, days };
}

export async function getPlanForUser(userId: string, projectId: string) {
  const project = await getPrisma().project.findFirst({
    where: ownedProject(userId, projectId),
    include: {
      diagnostics: { where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" }, take: 1 },
      recommendations: { orderBy: { createdAt: "desc" }, include: { tasks: { where: { status: { in: [...OPEN] } } } } },
      tasks: { orderBy: { updatedAt: "desc" } },
      reminders: { orderBy: { remindAt: "asc" } },
      budgetPlan: true,
      lessonResults: { where: { projectId }, take: 5, orderBy: { updatedAt: "desc" } },
    },
  });
  if (!project) return null;
  const latest = project.diagnostics[0] ?? null;
  const next = chooseNextAction({
    tasks: project.tasks.map((task) => ({
      id: task.id,
      priority: task.priority,
      status: task.status,
      dueAt: task.dueAt,
      updatedAt: task.updatedAt,
    })),
    recommendations: project.recommendations.map((item) => ({
      id: item.id,
      priority: item.priority,
      type: item.type,
      hasActiveTask: item.tasks.length > 0,
    })),
    reminders: project.reminders.map((item) => ({
      id: item.id,
      type: item.type,
      remindAt: item.remindAt,
      dismissedAt: item.dismissedAt,
    })),
    hasCompletedDiagnostic: Boolean(latest),
  });
  return { project, latest, next };
}

export async function listAlertsForUser(userId: string, now = new Date()) {
  const reminders = await getPrisma().reminder.findMany({
    where: { project: { userId, status: "ACTIVE" } },
    include: { project: { select: { id: true, name: true } } },
    orderBy: { remindAt: "asc" },
  });
  return {
    due: reminders.filter((item) => !item.dismissedAt && item.remindAt.getTime() <= now.getTime()),
    upcoming: reminders.filter((item) => !item.dismissedAt && item.remindAt.getTime() > now.getTime()),
    read: reminders.filter((item) => item.readAt),
  };
}

export async function homeGuidance(userId: string) {
  const project = await getPrisma().project.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    include: {
      diagnostics: { orderBy: { createdAt: "desc" } },
      tasks: { where: { status: { in: [...OPEN] } } },
      recommendations: { orderBy: { createdAt: "desc" }, take: 8, include: { tasks: { where: { status: { in: [...OPEN] } } } } },
      reminders: { where: { dismissedAt: null, type: "REVIEW" } },
    },
  });
  if (!project) {
    return { projectId: null as string | null, projectName: null as string | null, next: { kind: "none" } as NextAction, taskTitle: null as string | null, recommendationTitle: null as string | null, completed: null, inProgress: false };
  }
  const completed = project.diagnostics.find((item) => item.status === "COMPLETED") ?? null;
  const next = chooseNextAction({
    tasks: project.tasks.map((task) => ({ id: task.id, priority: task.priority, status: task.status, dueAt: task.dueAt, updatedAt: task.updatedAt })),
    recommendations: project.recommendations.map((item) => ({ id: item.id, priority: item.priority, type: item.type, hasActiveTask: item.tasks.length > 0 })),
    reminders: project.reminders.map((item) => ({ id: item.id, type: item.type, remindAt: item.remindAt, dismissedAt: item.dismissedAt })),
    hasCompletedDiagnostic: Boolean(completed),
  });
  const taskTitle = next.kind === "task" ? project.tasks.find((task) => task.id === next.taskId)?.title ?? null : null;
  const recommendationTitle = next.kind === "recommendation" ? project.recommendations.find((item) => item.id === next.recommendationId)?.title ?? null : null;
  return {
    projectId: project.id,
    projectName: project.name,
    next,
    taskTitle,
    recommendationTitle,
    completed,
    inProgress: project.diagnostics.some((item) => item.status === "IN_PROGRESS"),
  };
}
