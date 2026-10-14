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

