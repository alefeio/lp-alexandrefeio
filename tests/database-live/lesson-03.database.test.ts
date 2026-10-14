import assert from "node:assert/strict";
import test from "node:test";
import { config as loadEnv } from "dotenv";

import { LESSON_01_SLUG } from "../../src/lib/learning/lesson-01";
import { LESSON_02_SLUG } from "../../src/lib/learning/lesson-02";
import { LESSON_03_SLUG, lesson03Blocks } from "../../src/lib/learning/lesson-03";

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
  q12: "none",
  q13: "up-to-300",
  q14: "yes",
  q15: "yes",
};

test("seed da aula 3 é idempotente e preserva as outras aulas", async () => {
  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { seedLesson03Content } = await import("../../src/lib/learning/seed-lesson-03");
  const prisma = getPrisma();
  const untouched = [LESSON_01_SLUG, LESSON_02_SLUG, "palavras-chave-com-intencao", "anuncios-alinhados-a-conversao", "criativos-que-comunicam"];
  const select = { slug: true, title: true, summary: true, priceCents: true, commerceStatus: true, accessType: true, publicPreview: true } as const;
  const before = (await prisma.lesson.findMany({
    where: { slug: { in: untouched } },
    select,
  })).sort((a, b) => a.slug.localeCompare(b.slug));
  const first = await seedLesson03Content(prisma);
  const second = await seedLesson03Content(prisma);
  assert.equal(first.ready, true);
  assert.equal(second.activeBlocks, 27);
  assert.equal(await prisma.lesson.count({ where: { slug: LESSON_03_SLUG } }), 1);
  const active = await prisma.lessonBlock.findMany({
    where: { lesson: { slug: LESSON_03_SLUG }, retiredAt: null },
    orderBy: { position: "asc" },
    select: { blockKey: true, position: true, type: true },
  });
  assert.deepEqual(active.map((block) => block.blockKey), lesson03Blocks.map((block) => block.blockKey));
  assert.equal(active.filter((block) => block.type === "TOOL").length, 1);
  assert.equal(active.filter((block) => block.type === "RESULT").length, 0);
  const stored = await prisma.lesson.findUniqueOrThrow({
    where: { slug: LESSON_03_SLUG },
    select: { accessType: true, commerceStatus: true, status: true, priceCents: true, estimatedMinutes: true },
  });
  assert.equal(stored.accessType, "FREE");
  assert.equal(stored.commerceStatus, "NOT_FOR_SALE");
  assert.equal(stored.status, "PUBLISHED");
  assert.equal(stored.priceCents, null);
  assert.equal(stored.estimatedMinutes, 20);
  const after = (await prisma.lesson.findMany({
    where: { slug: { in: untouched } },
    select,
  })).sort((a, b) => a.slug.localeCompare(b.slug));
  assert.deepEqual(after, before);
});

test("TOOL só vincula diagnóstico concluído do próprio aluno", async () => {
  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { completeDiagnosticForUser, resumeDiagnosticForUser, saveDiagnosticProgress } = await import("../../src/lib/diagnostic/service");
  const { linkTrafficReadiness, loadTrafficToolPanel } = await import("../../src/lib/learning/tool");
  const { loadRuleBlocks, loadSnapshot } = await import("../../src/lib/learning/state");
  const prisma = getPrisma();
  const stamp = Date.now();
  const owner = await prisma.user.create({
    data: { id: `lesson03-a-${stamp}`, name: "Dono", email: `lesson03-a-${stamp}@example.com`, emailVerified: true, role: "USER", createdAt: new Date(), updatedAt: new Date() },
  });
  const other = await prisma.user.create({
    data: { id: `lesson03-b-${stamp}`, name: "Outro", email: `lesson03-b-${stamp}@example.com`, emailVerified: true, role: "USER", createdAt: new Date(), updatedAt: new Date() },
  });
  const clinic = await prisma.project.create({ data: { userId: owner.id, name: "Clínica", status: "ACTIVE" } });
  const store = await prisma.project.create({ data: { userId: owner.id, name: "Loja", status: "ACTIVE" } });
  const foreign = await prisma.project.create({ data: { userId: other.id, name: "Outra empresa", status: "ACTIVE" } });
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { slug: LESSON_03_SLUG }, select: { id: true } });
  const rules = await loadRuleBlocks(lesson.id);
  const anonymous = await loadTrafficToolPanel({ userId: null, blocks: rules });
  assert.equal(anonymous?.mode, "live");
  if (anonymous?.mode === "live") {
    assert.equal(anonymous.authenticated, false);
    assert.match(decodeURIComponent(anonymous.signupHref), /#diagnostico/);
    assert.equal(anonymous.projects.length, 0);
  }

  const progress = await resumeDiagnosticForUser(owner.id, clinic.id);
  assert.ok(progress);
  const rejected = await linkTrafficReadiness({
    userId: owner.id,
    slug: LESSON_03_SLUG,
    blockKey: "diagnostico-prontidao-trafego",
    projectId: clinic.id,
    diagnosticId: progress.id,
  });
  assert.equal(rejected.ok, false);
  assert.equal(await prisma.lessonResponse.count({ where: { userId: owner.id, lessonId: lesson.id } }), 0);

  await saveDiagnosticProgress(owner.id, clinic.id, progress.id, full, 15);
  const completed = await completeDiagnosticForUser(owner.id, clinic.id, progress.id);
  assert.equal(completed.ok, true);
  const foreignDiagnostic = await resumeDiagnosticForUser(other.id, foreign.id);
  assert.ok(foreignDiagnostic);
  await saveDiagnosticProgress(other.id, foreign.id, foreignDiagnostic.id, full, 15);
  await completeDiagnosticForUser(other.id, foreign.id, foreignDiagnostic.id);
  const stolen = await linkTrafficReadiness({
    userId: owner.id,
    slug: LESSON_03_SLUG,
    blockKey: "diagnostico-prontidao-trafego",
    projectId: foreign.id,
    diagnosticId: foreignDiagnostic.id,
  });
  assert.equal(stolen.ok, false);

  const linked = await linkTrafficReadiness({
    userId: owner.id,
    slug: LESSON_03_SLUG,
    blockKey: "diagnostico-prontidao-trafego",
    projectId: clinic.id,
    diagnosticId: progress.id,
  });
  assert.equal(linked.ok, true);
  const again = await linkTrafficReadiness({
    userId: owner.id,
    slug: LESSON_03_SLUG,
    blockKey: "diagnostico-prontidao-trafego",
    projectId: clinic.id,
    diagnosticId: progress.id,
  });
  assert.equal(again.ok, true);
  assert.equal(await prisma.lessonResponse.count({ where: { userId: owner.id, lessonId: lesson.id, blockKey: "diagnostico-prontidao-trafego" } }), 1);
  assert.equal(await prisma.lessonResult.count({ where: { userId: owner.id, lessonId: lesson.id } }), 0);
  const snapshot = await loadSnapshot(owner.id, lesson.id, rules);
  assert.equal(snapshot.completedBlockKeys.includes("diagnostico-prontidao-trafego"), true);
  assert.equal(snapshot.completedBlockKeys.includes("campanha-comeca-antes-gerenciador"), false);
  const reloaded = await loadSnapshot(owner.id, lesson.id, rules);
  assert.equal(reloaded.completedBlockKeys.includes("diagnostico-prontidao-trafego"), true);

  const panel = await loadTrafficToolPanel({ userId: owner.id, blocks: rules });
  assert.equal(panel?.mode, "live");
  if (panel?.mode === "live") {
    assert.equal(panel.chooseProject, true);
    assert.equal(panel.projects.some((item) => item.id === store.id), true);
    assert.deepEqual(panel.projects.map((item) => item.name).sort(), ["Clínica", "Loja"]);
    assert.equal(panel.projects.some((item) => item.name === "Outra empresa"), false);
    assert.equal(panel.linked?.diagnosticId, progress.id);
    assert.equal(panel.linked?.bottleneckLabel, "Mensuração");
    assert.equal(panel.linked?.overallScore, (await prisma.diagnostic.findUniqueOrThrow({ where: { id: progress.id }, select: { overallScore: true } })).overallScore);
    assert.match(panel.linked?.channelExplanation ?? "", /Google Ads|inicial/i);
  }
  const fresh = await resumeDiagnosticForUser(owner.id, clinic.id);
  assert.ok(fresh);
  assert.notEqual(fresh.id, progress.id);
  assert.equal(fresh.status, "IN_PROGRESS");

  await prisma.user.delete({ where: { id: owner.id } });
  await prisma.user.delete({ where: { id: other.id } });
  await prisma.$disconnect();
});
