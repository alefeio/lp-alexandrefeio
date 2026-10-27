import assert from "node:assert/strict";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import type { DiagnosticAnswers } from "../../src/lib/diagnostic/score";

loadEnv({ path: ".env.local" });

const full: DiagnosticAnswers = {
  q1: "leads",
  q2: "clear",
  q3: "yes",
  q4: "yes",
  q5: "clear",
  q6: "clear",
  q7: "searches",
  q8: "instagram",
  q9: "yes",
  q10: "works",
  q11: "yes",
  q12: "both",
  q13: "up-to-300",
  q14: "yes",
  q15: "yes",
};

const fourteen: DiagnosticAnswers = {
  q1: "leads",
  q2: "clear",
  q3: "yes",
  q4: "yes",
  q5: "clear",
  q6: "clear",
  q7: "searches",
  q8: "instagram",
  q9: "yes",
  q10: "works",
  q11: "yes",
  q12: "both",
  q13: "up-to-300",
  q14: "yes",
};

test("transições de telemetria do diagnóstico são atômicas e idempotentes", async () => {
  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { resumeDiagnosticForUser, saveDiagnosticProgress, completeDiagnosticForUser } = await import("../../src/lib/diagnostic/service");
  const prisma = getPrisma();
  const stamp = Date.now();
  const userId = `diag-telemetry-${stamp}`;

  await prisma.user.create({
    data: {
      id: userId,
      name: "Diagnostic telemetry",
      email: `diag-telemetry-${stamp}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  const project = await prisma.project.create({ data: { userId, name: "Projeto telemetria" } });

  try {
    // Abrir/criar sem responder não significa início.
    const diagnostic = await resumeDiagnosticForUser(userId, project.id);
    assert.ok(diagnostic);
    if (!diagnostic) return;
    assert.deepEqual(diagnostic.answers, {});

    // Observação isolada não é resposta válida e não consome a transição de início.
    const noteOnly = await saveDiagnosticProgress(userId, project.id, diagnostic.id, { q5Note: "rascunho" }, 0);
    assert.equal(noteOnly.ok, true);
    if (!noteOnly.ok) return;
    assert.equal(noteOnly.startedNow, false);

    // Primeira resposta válida persistida: exatamente um start.
    const first = await saveDiagnosticProgress(userId, project.id, diagnostic.id, { q5Note: "rascunho", q1: "leads" }, 0);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.startedNow, true);

    const second = await saveDiagnosticProgress(userId, project.id, diagnostic.id, { q1: "leads", q2: "clear" }, 1);
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.startedNow, false);

    const resumed = await resumeDiagnosticForUser(userId, project.id);
    assert.equal(resumed?.id, diagnostic.id);
    const afterResume = await saveDiagnosticProgress(userId, project.id, diagnostic.id, { q1: "leads", q2: "clear", q3: "yes" }, 2);
    assert.equal(afterResume.ok, true);
    if (!afterResume.ok) return;
    assert.equal(afterResume.startedNow, false);

    // Concorrência no primeiro save: só uma requisição ganha startedNow=true.
    const concurrentStart = await prisma.diagnostic.create({
      data: { projectId: project.id, userId, version: "traffic-readiness-v1", status: "IN_PROGRESS", answers: {}, currentStep: 0 },
    });
    const startRace = await Promise.all([
      saveDiagnosticProgress(userId, project.id, concurrentStart.id, { q1: "leads" }, 0),
      saveDiagnosticProgress(userId, project.id, concurrentStart.id, { q1: "whatsapp" }, 0),
    ]);
    assert.equal(startRace.every((item) => item.ok), true);
    assert.equal(startRace.filter((item) => item.ok && item.startedNow).length, 1);
    await prisma.diagnostic.delete({ where: { id: concurrentStart.id } });

    // 14/15 não conclui.
    const incomplete = await prisma.diagnostic.create({
      data: { projectId: project.id, userId, version: "traffic-readiness-v1", status: "IN_PROGRESS", answers: {}, currentStep: 0 },
    });
    const incompleteSaved = await saveDiagnosticProgress(userId, project.id, incomplete.id, fourteen, 14);
    assert.equal(incompleteSaved.ok, true);
    const incompleteDone = await completeDiagnosticForUser(userId, project.id, incomplete.id);
    assert.equal(incompleteDone.ok, false);
    const incompleteRecord = await prisma.diagnostic.findUnique({ where: { id: incomplete.id } });
    assert.equal(incompleteRecord?.status, "IN_PROGRESS");
    await prisma.diagnostic.delete({ where: { id: incomplete.id } });

    // Conclusão real: uma vez. Repetição/revisita não produz nova transição.
    const ready = await saveDiagnosticProgress(userId, project.id, diagnostic.id, full, 15);
    assert.equal(ready.ok, true);
    const completed = await completeDiagnosticForUser(userId, project.id, diagnostic.id);
    assert.equal(completed.ok, true);
    if (!completed.ok) return;
    assert.equal(completed.completedNow, true);
    assert.equal(completed.resultBand, "ready");

    const repeated = await completeDiagnosticForUser(userId, project.id, diagnostic.id);
    assert.equal(repeated.ok, true);
    if (!repeated.ok) return;
    assert.equal(repeated.completedNow, false);
    assert.equal(await prisma.recommendation.count({ where: { diagnosticId: diagnostic.id } }), 1);

    // Concorrência na conclusão: somente uma transição verdadeira e uma recomendação.
    const concurrentComplete = await prisma.diagnostic.create({
      data: { projectId: project.id, userId, version: "traffic-readiness-v1", status: "IN_PROGRESS", answers: {}, currentStep: 0 },
    });
    const concurrentReady = await saveDiagnosticProgress(userId, project.id, concurrentComplete.id, full, 15);
    assert.equal(concurrentReady.ok, true);
    const completionRace = await Promise.all([
      completeDiagnosticForUser(userId, project.id, concurrentComplete.id),
      completeDiagnosticForUser(userId, project.id, concurrentComplete.id),
    ]);
    assert.equal(completionRace.every((item) => item.ok), true);
    assert.equal(completionRace.filter((item) => item.ok && item.completedNow).length, 1);
    assert.equal(await prisma.recommendation.count({ where: { diagnosticId: concurrentComplete.id } }), 1);
  } finally {
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.delete({ where: { id: userId } });
  }
});
