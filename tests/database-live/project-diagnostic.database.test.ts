import assert from "node:assert/strict";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { type DiagnosticAnswers } from "../../src/lib/diagnostic/score";

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

test("projeto, diagnóstico e telemetria de domínio ficam isolados e idempotentes no banco de desenvolvimento", async () => {
  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { createProjectForUser, updateProjectForUser, archiveProjectForUser, getProjectForUser, listProjectsForUser } = await import("../../src/lib/project/service");
  const { resumeDiagnosticForUser, saveDiagnosticProgress, completeDiagnosticForUser, getDiagnosticForUser } = await import("../../src/lib/diagnostic/service");
  const prisma = getPrisma();
  const stamp = Date.now();
  const userA = `proj-a-${stamp}`;
  const userB = `proj-b-${stamp}`;
  const courseId = `course-proj-${stamp}`;
  const lessonId = `lesson-proj-${stamp}`;

  await prisma.user.create({ data: { id: userA, name: "A", email: `sprint3-a-${stamp}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() } });
  await prisma.user.create({ data: { id: userB, name: "B", email: `sprint3-b-${stamp}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() } });
  await prisma.course.create({
    data: {
      id: courseId,
      slug: `rascunho-proj-${stamp}`,
      title: "Rascunho",
      description: "Não publicar",
      status: "DRAFT",
      modules: {
        create: {
          slug: "rascunho",
          title: "Rascunho",
          description: "Não publicar",
          status: "DRAFT",
          lessons: { create: { id: lessonId, slug: `rascunho-proj-${stamp}`, title: "Rascunho", summary: "Não publicar", status: "DRAFT", accessType: "PAID", priceCents: 1000 } },
        },
      },
    },
  });

  try {
    const created = await createProjectForUser(userA, { name: "Padaria do bairro", segment: "Alimentação" });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const projectId = created.project.id;
    assert.equal((await listProjectsForUser(userA)).some((item) => item.id === projectId), true);
    assert.equal((await listProjectsForUser(userB)).some((item) => item.id === projectId), false);
    assert.equal(await getProjectForUser(userB, projectId), null);

    assert.equal((await updateProjectForUser(userB, projectId, { name: "Não é seu" })).ok, false);
    const edited = await updateProjectForUser(userA, projectId, { name: "Padaria da esquina", segment: "Alimentação", monthlyMediaBudgetCents: "600" });
    assert.equal(edited.ok, true);
    if (edited.ok) assert.equal(edited.project.monthlyMediaBudgetCents, 60000);

    // Abrir/criar o diagnóstico não é início real.
    const started = await resumeDiagnosticForUser(userA, projectId);
    assert.ok(started);
    if (!started) return;
    assert.deepEqual(started.answers, {});
    assert.equal(await resumeDiagnosticForUser(userB, projectId), null);

    // Primeira resposta persistida é a única transição de início.
    const firstSave = await saveDiagnosticProgress(userA, projectId, started.id, { q1: "leads" }, 0);
    assert.equal(firstSave.ok, true);
    if (!firstSave.ok) return;
    assert.equal(firstSave.startedNow, true);

    const secondSave = await saveDiagnosticProgress(userA, projectId, started.id, { q1: "leads", q2: "clear" }, 1);
    assert.equal(secondSave.ok, true);
    if (!secondSave.ok) return;
    assert.equal(secondSave.startedNow, false);

    const resumed = await resumeDiagnosticForUser(userA, projectId);
    assert.equal(resumed?.id, started.id);
    assert.equal((resumed?.answers as { q1?: string }).q1, "leads");
    const afterResume = await saveDiagnosticProgress(userA, projectId, started.id, { q1: "leads", q2: "clear", q3: "yes" }, 2);
    assert.equal(afterResume.ok, true);
    if (!afterResume.ok) return;
    assert.equal(afterResume.startedNow, false);

    // Duas primeiras respostas concorrentes: somente uma vence a transição {} -> respondido.
    const concurrentStart = await prisma.diagnostic.create({
      data: { projectId, userId: userA, version: "traffic-readiness-v1", status: "IN_PROGRESS", answers: {}, currentStep: 0 },
    });
    const concurrentStarts = await Promise.all([
      saveDiagnosticProgress(userA, projectId, concurrentStart.id, { q1: "leads" }, 0),
      saveDiagnosticProgress(userA, projectId, concurrentStart.id, { q1: "whatsapp" }, 0),
    ]);
    assert.equal(concurrentStarts.every((item) => item.ok), true);
    assert.equal(concurrentStarts.filter((item) => item.ok && item.startedNow).length, 1);

    // 14/15 respostas não concluem.
    const incomplete = await prisma.diagnostic.create({
      data: { projectId, userId: userA, version: "traffic-readiness-v1", status: "IN_PROGRESS", answers: {}, currentStep: 0 },
    });
    const incompleteSave = await saveDiagnosticProgress(userA, projectId, incomplete.id, fourteen, 14);
    assert.equal(incompleteSave.ok, true);
    if (!incompleteSave.ok) return;
    assert.equal(incompleteSave.startedNow, true);
    const incompleteDone = await completeDiagnosticForUser(userA, projectId, incomplete.id);
    assert.equal(incompleteDone.ok, false);
    const incompleteRecord = await prisma.diagnostic.findUnique({ where: { id: incomplete.id } });
    assert.equal(incompleteRecord?.status, "IN_PROGRESS");

    // Conclusão válida ocorre uma vez; revisita/reexecução não conclui de novo.
    const firstComplete = await saveDiagnosticProgress(userA, projectId, started.id, full, 15);
    assert.equal(firstComplete.ok, true);
    if (!firstComplete.ok) return;
    assert.equal(firstComplete.startedNow, false);
    const done = await completeDiagnosticForUser(userA, projectId, started.id);
    assert.equal(done.ok, true);
    if (!done.ok) return;
    assert.equal(done.completedNow, true);
    assert.equal(done.resultBand, "ready");

    const repeatedDone = await completeDiagnosticForUser(userA, projectId, started.id);
    assert.equal(repeatedDone.ok, true);
    if (!repeatedDone.ok) return;
    assert.equal(repeatedDone.completedNow, false);
    assert.equal(repeatedDone.resultBand, "ready");

    const first = await getDiagnosticForUser(userA, projectId, started.id);
    assert.equal(first?.status, "COMPLETED");
    assert.equal(first?.overallScore, 100);
    assert.equal(first?.recommendations.length, 1);
    assert.equal(await getDiagnosticForUser(userB, projectId, started.id), null);

    // Duas conclusões concorrentes: somente uma faz IN_PROGRESS -> COMPLETED e cria recomendação.
    const concurrentComplete = await prisma.diagnostic.create({
      data: { projectId, userId: userA, version: "traffic-readiness-v1", status: "IN_PROGRESS", answers: {}, currentStep: 0 },
    });
    const readyForConcurrentComplete = await saveDiagnosticProgress(userA, projectId, concurrentComplete.id, full, 15);
    assert.equal(readyForConcurrentComplete.ok, true);
    const concurrentCompletions = await Promise.all([
      completeDiagnosticForUser(userA, projectId, concurrentComplete.id),
      completeDiagnosticForUser(userA, projectId, concurrentComplete.id),
    ]);
    assert.equal(concurrentCompletions.every((item) => item.ok), true);
    assert.equal(concurrentCompletions.filter((item) => item.ok && item.completedNow).length, 1);
    assert.equal(await prisma.recommendation.count({ where: { diagnosticId: concurrentComplete.id } }), 1);

    // Um novo diagnóstico continua independente dos anteriores.
    const second = await resumeDiagnosticForUser(userA, projectId);
    assert.ok(second);
    assert.notEqual(second?.id, started.id);
    const secondSaved = await saveDiagnosticProgress(userA, projectId, second!.id, { ...full, q1: "unknown", q2: "no" }, 15);
    assert.equal(secondSaved.ok, true);
    if (!secondSaved.ok) return;
    assert.equal(secondSaved.startedNow, true);
    const secondDone = await completeDiagnosticForUser(userA, projectId, second!.id);
    assert.equal(secondDone.ok, true);
    if (!secondDone.ok) return;
    assert.equal(secondDone.completedNow, true);

    const preserved = await getDiagnosticForUser(userA, projectId, started.id);
    assert.equal(preserved?.overallScore, 100);
    assert.equal((preserved?.answers as { q1?: string }).q1, "leads");
    const latest = await getDiagnosticForUser(userA, projectId, second!.id);
    assert.equal(latest?.primaryBottleneck, "OBJECTIVE");
    assert.equal(latest?.recommendations[0]?.title, "Defina o objetivo principal da campanha.");
    const lesson = await prisma.lesson.findFirst({ where: { slug: "objetivo-oferta-orcamento", status: "PUBLISHED" } });
    assert.ok(lesson);
    assert.equal(latest?.recommendations[0]?.lessonId, lesson.id);

    const projectOne = await prisma.project.create({ data: { userId: userA, name: "Outro negócio" } });
    await prisma.lessonResult.create({ data: { userId: userA, lessonId, payload: { pessoal: "sim" }, projectId: null } });
    await prisma.lessonResult.create({ data: { userId: userA, lessonId, projectId, payload: { negocio: "um" } } });
    await prisma.lessonResult.create({ data: { userId: userA, lessonId, projectId: projectOne.id, payload: { negocio: "dois" } } });
    assert.equal(await prisma.lessonResult.count({ where: { userId: userA, lessonId } }), 3);
    await assert.rejects(prisma.lessonResult.create({ data: { userId: userA, lessonId, projectId: null, payload: { pessoal: "duplicado" } } }));

    const archived = await archiveProjectForUser(userA, projectId);
    assert.equal(archived.ok, true);
    if (archived.ok) assert.equal(archived.project.status, "ARCHIVED");
    assert.equal(await resumeDiagnosticForUser(userA, projectId), null);
  } finally {
    await prisma.course.delete({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  }
});
