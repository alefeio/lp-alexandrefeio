import assert from "node:assert/strict";
import { config as loadEnv } from "dotenv";
import test from "node:test";

loadEnv({ path: ".env.local" });
import { needsSession } from "../src/proxy";
import { diagnosticAnalyticsPayload, diagnosticPayloadIsPublic } from "../src/lib/diagnostic/analytics";
import { DIAGNOSTIC_VERSION, DIMENSIONS, LESSON_BY_DIMENSION } from "../src/lib/diagnostic/definition";
import {
  answersComplete,
  channelHint,
  dimensionScore,
  isCritical,
  overallScore,
  primaryBottleneck,
  scoreDiagnostic,
  type DiagnosticAnswers,
} from "../src/lib/diagnostic/score";
import { parseMoneyToCents, projectInputSchema } from "../src/lib/project/schema";

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

test("nota máxima, orçamento baixo e Instagram não reduzem a dimensão", () => {
  assert.equal(answersComplete(full), true);
  for (const dimension of DIMENSIONS) assert.equal(dimensionScore(dimension, full), 100);
  assert.equal(overallScore(Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, 100])) as Record<(typeof DIMENSIONS)[number], number>), 100);
  const result = scoreDiagnostic(full);
  assert.equal(result.overallScore, 100);
  assert.equal(result.primaryBottleneck, null);
  assert.equal(result.band, "ready");
  assert.equal(dimensionScore("DESTINATION", full), 100);
  assert.equal(dimensionScore("OPERATIONS", full), 100);
});

test("nota geral não esconde gargalo crítico e a prioridade segue a dependência", () => {
  const answers: DiagnosticAnswers = { ...full, q1: "unknown", q11: "no", q12: "none" };
  const result = scoreDiagnostic(answers);
  assert.equal(isCritical("OBJECTIVE", answers), true);
  assert.equal(isCritical("MEASUREMENT", answers), true);
  assert.ok(result.overallScore >= 60);
  assert.equal(result.primaryBottleneck, "OBJECTIVE");
  assert.equal(result.recommendationPriority, "HIGH");
  assert.equal(result.nextStepTitle, "Defina o objetivo principal da campanha.");
  assert.equal(result.lessonSlug, LESSON_BY_DIMENSION.OBJECTIVE);
});

test("regras críticas por dimensão", () => {
  assert.equal(isCritical("OFFER", { ...full, q3: "no" }), true);
  assert.equal(isCritical("AUDIENCE", { ...full, q6: "no" }), true);
  assert.equal(isCritical("DESTINATION", { ...full, q8: "undefined" }), true);
  assert.equal(isCritical("DESTINATION", { ...full, q9: "no" }), true);
  assert.equal(isCritical("DESTINATION", { ...full, q9: "unsure" }), true);
  assert.equal(isCritical("MEASUREMENT", { ...full, q12: "unknown" }), true);
  assert.equal(isCritical("OPERATIONS", { ...full, q14: "none" }), true);
  assert.equal(primaryBottleneck({ ...full, q3: "no", q14: "none" }, scoreDiagnostic({ ...full, q3: "no", q14: "none" }).dimensionScores), "OFFER");
});

test("indicação inicial de canal não trata WhatsApp como Meta", () => {
  assert.equal(channelHint({ ...full, q7: "searches", q1: "whatsapp" }).hint, "google");
  assert.equal(channelHint({ ...full, q7: "discovers" }).hint, "meta");
  assert.equal(channelHint({ ...full, q7: "both" }).hint, "both");
  assert.equal(channelHint({ ...full, q7: "unknown" }).hint, "none");
  assert.match(channelHint(full).explanation, /inicial/i);
});

test("analytics do diagnóstico não leva dado do negócio", () => {
  const payload = diagnosticAnalyticsPayload({ band: "incomplete" });
  assert.equal(diagnosticPayloadIsPublic(payload), true);
  assert.equal(payload.diagnostic_version, DIAGNOSTIC_VERSION);
  assert.equal("projectId" in payload, false);
  assert.equal("answers" in payload, false);
  assert.equal("overallScore" in payload, false);
});

test("dinheiro fica em centavos e URL inválida não passa", () => {
  assert.equal(parseMoneyToCents("300"), 30000);
  assert.equal(parseMoneyToCents("10,50"), 1050);
  assert.equal(parseMoneyToCents(""), null);
  assert.equal(parseMoneyToCents("1.2.3"), "invalid");
  const created = projectInputSchema.safeParse({ name: "Padaria" });
  assert.equal(created.success, true);
  if (created.success) assert.equal(created.data.monthlyMediaBudgetCents, null);
  const badUrl = projectInputSchema.safeParse({ name: "Padaria", websiteUrl: "javascript:alert(1)" });
  assert.equal(badUrl.success, false);
});

test("/app, projetos e aprendizado continuam protegidos", () => {
  assert.equal(needsSession("/app"), true);
  assert.equal(needsSession("/app/aprendizado"), true);
  assert.equal(needsSession("/app/projetos"), true);
  assert.equal(needsSession("/app/projetos/novo"), true);
  assert.equal(needsSession("/aulas/como-funciona-o-trafego-pago"), false);
});

test("projeto, diagnóstico e resultado por negócio ficam isolados no banco de desenvolvimento", async () => {
  const { assertMigrationTargetAllowed } = await import("../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../src/lib/db/prisma");
  const { createProjectForUser, updateProjectForUser, archiveProjectForUser, getProjectForUser, listProjectsForUser } = await import("../src/lib/project/service");
  const { resumeDiagnosticForUser, saveDiagnosticProgress, completeDiagnosticForUser, getDiagnosticForUser } = await import("../src/lib/diagnostic/service");
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
