import assert from "node:assert/strict";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { needsSession } from "../src/proxy";
import { budgetRemindAt, coverageDays, coverageLabel } from "../src/lib/plan/budget";
import { chooseNextAction } from "../src/lib/plan/next-action";
import { reminderEmail } from "../src/lib/email/reminder-mail";

loadEnv({ path: ".env.local" });

const now = new Date("2026-10-10T15:00:00.000Z");

test("cobertura usa divisão inteira e recusa diária zero", () => {
  assert.equal(coverageDays(10000, 1000), 10);
  assert.equal(coverageDays(15050, 1000), 15);
  assert.equal(coverageDays(999, 1000), 0);
  assert.equal(coverageDays(1000, 0), null);
  assert.equal(coverageDays(-1, 1000), null);
  assert.equal(coverageLabel(10), "aproximadamente 10 dias");
  const remind = budgetRemindAt(new Date("2026-10-01T00:00:00.000Z"), 10, 2, new Date("2026-10-08T00:00:00.000Z"));
  assert.equal(remind.toISOString(), "2026-10-09T12:00:00.000Z");
  assert.equal(budgetRemindAt(new Date("2026-10-01T00:00:00.000Z"), 10, 2, now).toISOString(), now.toISOString());
});

test("próxima ação segue a ordem de prazo, prioridade e espera", () => {
  const highOverdue = { id: "high-late", priority: "HIGH" as const, status: "TODO" as const, dueAt: new Date("2026-10-01T00:00:00.000Z"), updatedAt: now };
  const mediumOverdue = { id: "med-late", priority: "MEDIUM" as const, status: "TODO" as const, dueAt: new Date("2026-10-02T00:00:00.000Z"), updatedAt: now };
  const first = chooseNextAction({ tasks: [mediumOverdue, highOverdue], recommendations: [], reminders: [], hasCompletedDiagnostic: true, now });
  assert.deepEqual(first, { kind: "task", taskId: "high-late", reason: "overdue-high" });

  const inProgress = { id: "doing", priority: "MEDIUM" as const, status: "IN_PROGRESS" as const, dueAt: null, updatedAt: now };
  const todo = { id: "later", priority: "LOW" as const, status: "TODO" as const, dueAt: null, updatedAt: now };
  const doing = chooseNextAction({ tasks: [todo, inProgress], recommendations: [], reminders: [], hasCompletedDiagnostic: true, now });
  assert.equal(doing.kind === "task" && doing.taskId, "doing");

  const recommendation = chooseNextAction({
    tasks: [],
    recommendations: [{ id: "rec", priority: "HIGH", type: "EXECUTE", hasActiveTask: false }],
    reminders: [],
    hasCompletedDiagnostic: true,
    now,
  });
  assert.deepEqual(recommendation, { kind: "recommendation", recommendationId: "rec" });

  const waiting = chooseNextAction({
    tasks: [],
    recommendations: [{ id: "wait", priority: "LOW", type: "WAIT", hasActiveTask: false }],
    reminders: [{ id: "rev", type: "REVIEW", remindAt: new Date("2026-10-12T12:00:00.000Z"), dismissedAt: null }],
    hasCompletedDiagnostic: true,
    now,
  });
  assert.deepEqual(waiting, { kind: "wait", reminderId: "rev" });
  assert.equal(chooseNextAction({ tasks: [], recommendations: [], reminders: [], hasCompletedDiagnostic: false, now }).kind, "diagnostic");
});

test("e-mail de lembrete não leva orçamento nem resposta", () => {
  const message = reminderEmail({ projectName: "Padaria", title: "Revisar termos", planUrl: "http://localhost:3000/app/projetos/1/plano" });
  assert.match(message.subject, /Lembrete/);
  assert.equal(message.text.includes("R$"), false);
  assert.match(message.text, /não inclui respostas/);
  assert.match(message.text, /Ver meu plano/);
});

test("/app, aprendizado, plano e alertas continuam protegidos", () => {
  assert.equal(needsSession("/app"), true);
  assert.equal(needsSession("/app/aprendizado"), true);
  assert.equal(needsSession("/app/alertas"), true);
  assert.equal(needsSession("/app/projetos/abc/plano"), true);
});

test("tarefas, lembretes e recarga ficam no projeto certo", async () => {
  const { assertMigrationTargetAllowed } = await import("../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../src/lib/db/prisma");
  const {
    createManualTaskForUser,
    createTaskFromRecommendationForUser,
    createReviewReminderForUser,
    setTaskStatusForUser,
    markReminderReadForUser,
    dismissReminderForUser,
    saveBudgetPlanForUser,
    createReminderForUser,
  } = await import("../src/lib/plan/service");
  const { processDueReminders } = await import("../src/lib/plan/reminders");
  const { archiveProjectForUser } = await import("../src/lib/project/service");
  const prisma = getPrisma();
  const stamp = Date.now();
  const userA = `plan-a-${stamp}`;
  const userB = `plan-b-${stamp}`;
  await prisma.user.create({ data: { id: userA, name: "A", email: `sprint4-a-${stamp}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() } });
  await prisma.user.create({ data: { id: userB, name: "B", email: `sprint4-b-${stamp}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() } });
  const project = await prisma.project.create({ data: { userId: userA, name: "Padaria" } });
  const other = await prisma.project.create({ data: { userId: userB, name: "Outra" } });
  const recommendation = await prisma.recommendation.create({
    data: { projectId: project.id, type: "EXECUTE", priority: "HIGH", title: "Defina o objetivo", description: "Escolha um resultado." },
  });
  const wait = await prisma.recommendation.create({
    data: { projectId: project.id, type: "WAIT", priority: "LOW", title: "Aguarde novos dados", description: "Não mexa agora." },
  });

  try {
    const manual = await createManualTaskForUser(userA, project.id, { title: "Revisar landing page", priority: "MEDIUM" });
    assert.equal(manual.ok, true);
    if (manual.ok) assert.equal(manual.task.projectId, project.id);
    assert.equal((await createManualTaskForUser(userB, project.id, { title: "Não pode", priority: "LOW" })).ok, false);

    const added = await createTaskFromRecommendationForUser(userA, project.id, recommendation.id);
    assert.equal(added.ok && added.already, false);
    const again = await createTaskFromRecommendationForUser(userA, project.id, recommendation.id);
    assert.equal(again.ok && again.already, true);
    assert.equal(await prisma.task.count({ where: { recommendationId: recommendation.id } }), 1);
    assert.equal((await createTaskFromRecommendationForUser(userA, project.id, wait.id)).ok, false);

    const review = await createReviewReminderForUser(userA, project.id, wait.id, "2026-10-17T12:00:00.000Z");
    assert.equal(review.ok, true);
    if (review.ok) {
      assert.equal(review.reminder.type, "REVIEW");
      const read = await markReminderReadForUser(userA, review.reminder.id);
      assert.equal(read.ok && read.reminder.readAt instanceof Date, true);
      assert.equal(read.ok && read.reminder.dismissedAt, null);
      const dismissed = await dismissReminderForUser(userB, review.reminder.id);
      assert.equal(dismissed.ok, false);
      const ownDismiss = await dismissReminderForUser(userA, review.reminder.id);
      assert.equal(ownDismiss.ok && ownDismiss.reminder.dismissedAt instanceof Date, true);
    }

    if (manual.ok) {
      const done = await setTaskStatusForUser(userA, manual.task.id, "DONE");
      assert.equal(done.ok && done.task.status, "DONE");
      assert.equal(done.ok && done.task.completedAt instanceof Date, true);
      const reopened = await setTaskStatusForUser(userA, manual.task.id, "TODO");
      assert.equal(reopened.ok && reopened.task.status, "TODO");
      assert.equal(reopened.ok && reopened.task.completedAt, null);
      assert.equal((await setTaskStatusForUser(userB, manual.task.id, "DONE")).ok, false);
    }

    const dueTask = await prisma.task.create({
      data: { projectId: project.id, title: "Fazer recarga", sourceType: "PLANNING", priority: "HIGH", dueAt: new Date("2026-11-03T12:00:00.000Z") },
    });
    const reminder = await createReminderForUser(userA, project.id, {
      title: "Fazer recarga",
      remindAt: "2026-10-27T12:00:00.000Z",
      type: "DEADLINE",
      taskId: dueTask.id,
    });
    assert.equal(reminder.ok, true);

    const budget = await saveBudgetPlanForUser(userA, project.id, {
      currentBalance: "100",
      plannedDaily: "10",
      balanceAsOf: "2026-10-10",
      reminderLeadDays: "2",
      emailReminderEnabled: true,
    });
    assert.equal(budget.ok && budget.days, 10);
    const changed = await saveBudgetPlanForUser(userA, project.id, {
      currentBalance: "50",
      plannedDaily: "10",
      balanceAsOf: "2026-10-10",
      reminderLeadDays: "1",
    });
    assert.equal(changed.ok && changed.days, 5);
    assert.equal(await prisma.reminder.count({ where: { projectId: project.id, type: "BUDGET", dismissedAt: null } }), 1);
    assert.equal((await saveBudgetPlanForUser(userA, project.id, { currentBalance: "50", plannedDaily: "0", balanceAsOf: "2026-10-10", reminderLeadDays: "1" })).ok, false);

    const emailReminder = await prisma.reminder.findFirst({ where: { projectId: project.id, type: "BUDGET", dismissedAt: null } });
    assert.ok(emailReminder);
    await prisma.reminder.update({ where: { id: emailReminder!.id }, data: { remindAt: new Date("2026-10-01T00:00:00.000Z"), emailEnabled: true } });
    let sends = 0;
    const first = await processDueReminders(async () => { sends += 1; }, new Date("2026-10-20T00:00:00.000Z"), project.id);
    const second = await processDueReminders(async () => { sends += 1; }, new Date("2026-10-20T00:00:00.000Z"), project.id);
    assert.equal(first.sent, 1);
    assert.equal(second.sent, 0);
    assert.equal(sends, 1);
    assert.ok(await prisma.reminder.findFirst({ where: { id: emailReminder!.id, emailSentAt: { not: null } } }));

    const archived = await archiveProjectForUser(userA, project.id);
    assert.equal(archived.ok, true);
    assert.equal((await createManualTaskForUser(userA, project.id, { title: "Depois de arquivar", priority: "LOW" })).ok, false);
    assert.equal(await prisma.reminder.count({ where: { projectId: project.id, dismissedAt: null, remindAt: { gt: new Date() } } }), 0);
    assert.equal(other.userId, userB);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  }
});
