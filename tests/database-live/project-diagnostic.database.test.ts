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

test("projeto, diagnóstico e resultado por negócio ficam isolados no banco de desenvolvimento", async () => {
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

    const started = await resumeDiagnosticForUser(userA, projectId);
    assert.ok(started);
    if (!started) return;
    assert.equal(await resumeDiagnosticForUser(userB, projectId), null);
    const saved = await saveDiagnosticProgress(userA, projectId, started.id, { q1: "leads" }, 1);
    assert.equal(saved.ok, true);
    const resumed = await resumeDiagnosticForUser(userA, projectId);
    assert.equal(resumed?.id, started.id);
    assert.equal((resumed?.answers as { q1?: string }).q1, "leads");

    const firstComplete = await saveDiagnosticProgress(userA, projectId, started.id, full, 15);
    assert.equal(firstComplete.ok, true);
    const done = await completeDiagnosticForUser(userA, projectId, started.id);
    assert.equal(done.ok, true);
    const first = await getDiagnosticForUser(userA, projectId, started.id);
    assert.equal(first?.status, "COMPLETED");
    assert.equal(first?.overallScore, 100);
    assert.equal(await getDiagnosticForUser(userB, projectId, started.id), null);

    const second = await resumeDiagnosticForUser(userA, projectId);
    assert.ok(second);
    assert.notEqual(second?.id, started.id);
    await saveDiagnosticProgress(userA, projectId, second!.id, { ...full, q1: "unknown", q2: "no" }, 15);
    await completeDiagnosticForUser(userA, projectId, second!.id);
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
