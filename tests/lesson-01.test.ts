import assert from "node:assert/strict";
import test from "node:test";
import { config as loadEnv } from "dotenv";
import { assessLesson } from "../src/lib/editorial/readiness";
import { parseBlockData } from "../src/lib/learning/blocks";
import { canReadLessonBody } from "../src/lib/learning/access";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { LESSON_01_SLUG, lesson01Blocks, lesson01Meta } from "../src/lib/learning/lesson-01";

loadEnv({ path: ".env.local" });

const requiredKeys = [
  "checkpoint-clique-conversao",
  "checkpoint-quando-anunciar",
  "atividade-primeiro-mapa",
  "resultado-primeiro-mapa",
  "checkpoint-final-modelo",
];

test("aula 1 definitiva tem 27 blocos válidos e passa na validação", () => {
  assert.equal(lesson01Blocks.length, 27);
  assert.equal(new Set(lesson01Blocks.map((block) => block.blockKey)).size, 27);
  assert.deepEqual(
    lesson01Blocks.map((block) => block.position),
    lesson01Blocks.map((_, index) => index + 1),
  );
  for (const block of lesson01Blocks) {
    assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  }
  assert.equal(lesson01Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 3);
  assert.equal(lesson01Blocks.filter((block) => block.data.type === "IMAGE").length, 0);
  assert.equal(lesson01Blocks.find((block) => block.blockKey === "atividade-primeiro-mapa")?.required, true);
  assert.equal(lesson01Blocks.find((block) => block.blockKey === "resultado-primeiro-mapa")?.required, true);
  assert.equal(lesson01Blocks.some((block) => block.data.type === "CONCLUSION"), true);
  assert.equal(lesson01Blocks.find((block) => block.blockKey === "checklist-faz-sentido")?.countsForProgress, false);
  assert.equal(lesson01Blocks.filter((block) => block.data.type === "HEADING").every((block) => !block.countsForProgress), true);
  for (const key of requiredKeys) {
    assert.equal(lesson01Blocks.find((block) => block.blockKey === key)?.required, true);
  }
  const result = lesson01Blocks.find((block) => block.blockKey === "resultado-primeiro-mapa");
  assert.equal(result?.data.type, "RESULT");
  if (result?.data.type === "RESULT") {
    assert.deepEqual(
      result.data.fields.map((field) => field.key),
      ["oferta-inicial", "objetivo-inicial", "destino-inicial", "conversao-inicial", "bloqueio-inicial"],
    );
  }
  assert.equal(lesson01Meta.accessType, "FREE");
  assert.equal(lesson01Meta.priceCents, null);
  assert.equal(lesson01Meta.estimatedMinutes, 25);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "FREE" }), true);
  const lessons = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons);
  assert.equal(lessons.filter((lesson) => lesson.slug === LESSON_01_SLUG).length, 1);
  assert.equal(lessons.filter((lesson) => lesson.blocks.length > 0).length, 1);
  const ready = assessLesson(
    {
      title: lesson01Meta.title,
      summary: lesson01Meta.summary,
      publicPreview: lesson01Meta.publicPreview,
      estimatedMinutes: lesson01Meta.estimatedMinutes,
      accessType: "FREE",
      status: "PUBLISHED",
      priceCents: null,
      commerceStatus: "NOT_FOR_SALE",
    },
    lesson01Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.deepEqual(ready.issues, []);
  assert.equal(ready.ready, true);
});

test("seed da aula 1 é idempotente e não reescreve as outras", async () => {
  const { assertMigrationTargetAllowed } = await import("../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../src/lib/db/prisma");
  const { seedLesson01Content } = await import("../src/lib/learning/seed-lesson-01");
  const prisma = getPrisma();
  const otherBefore = await prisma.lesson.findUnique({
    where: { slug: "objetivo-oferta-orcamento" },
    select: { summary: true, priceCents: true, commerceStatus: true, accessType: true },
  });
  assert.ok(otherBefore);
  const first = await seedLesson01Content(prisma);
  const second = await seedLesson01Content(prisma);
  assert.equal(first.ready, true);
  assert.equal(second.activeBlocks, 27);
  assert.equal(await prisma.lesson.count({ where: { slug: LESSON_01_SLUG } }), 1);
  const active = await prisma.lessonBlock.findMany({
    where: { lesson: { slug: LESSON_01_SLUG }, retiredAt: null },
    orderBy: { position: "asc" },
    select: { blockKey: true, position: true },
  });
  assert.deepEqual(
    active.map((block) => block.blockKey),
    lesson01Blocks.map((block) => block.blockKey),
  );
  assert.equal(await prisma.lessonBlock.count({ where: { lesson: { slug: LESSON_01_SLUG }, type: "IMAGE", retiredAt: null } }), 0);
  const stored = await prisma.lesson.findUniqueOrThrow({
    where: { slug: LESSON_01_SLUG },
    select: { accessType: true, commerceStatus: true, status: true, priceCents: true, estimatedMinutes: true },
  });
  assert.equal(stored.accessType, "FREE");
  assert.equal(stored.commerceStatus, "NOT_FOR_SALE");
  assert.equal(stored.status, "PUBLISHED");
  assert.equal(stored.priceCents, null);
  assert.equal(stored.estimatedMinutes, 25);
  const otherAfter = await prisma.lesson.findUnique({
    where: { slug: "objetivo-oferta-orcamento" },
    select: { summary: true, priceCents: true, commerceStatus: true, accessType: true },
  });
  assert.deepEqual(otherAfter, otherBefore);

  const stamp = Date.now();
  const user = await prisma.user.create({
    data: {
      id: `lesson01-${stamp}`,
      name: "Uso temporário",
      email: `lesson01-${stamp}@example.com`,
      emailVerified: true,
      role: "USER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { slug: LESSON_01_SLUG }, select: { id: true } });
  await prisma.lessonProgress.create({ data: { userId: user.id, lessonId: lesson.id, percent: 10 } });
  const guarded = await seedLesson01Content(prisma);
  assert.equal(guarded.skipped, true);
  assert.equal(await prisma.lessonBlock.count({ where: { lessonId: lesson.id, retiredAt: null } }), 27);
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
});
