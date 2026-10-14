import assert from "node:assert/strict";
import test from "node:test";
import { config as loadEnv } from "dotenv";

import { LESSON_01_SLUG, lesson01Blocks, lesson01Meta } from "../../src/lib/learning/lesson-01";
import { LESSON_02_SLUG, lesson02Blocks, lesson02Meta } from "../../src/lib/learning/lesson-02";

loadEnv({ path: ".env.local" });

test("seed da aula 2 é idempotente e preserva as outras aulas", async () => {
  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { seedLesson02Content } = await import("../../src/lib/learning/seed-lesson-02");
  const prisma = getPrisma();
  const untouched = ["negocio-pronto-para-anunciar", "palavras-chave-com-intencao", "anuncios-alinhados-a-conversao", "criativos-que-comunicam", "leitura-do-resultado"];
  const select = { slug: true, title: true, summary: true, priceCents: true, commerceStatus: true, accessType: true, publicPreview: true } as const;
  const before = (await prisma.lesson.findMany({
    where: { slug: { in: [LESSON_01_SLUG, ...untouched] } },
    select,
  })).sort((a, b) => a.slug.localeCompare(b.slug));
  const lesson01Keys = (
    await prisma.lessonBlock.findMany({
      where: { lesson: { slug: LESSON_01_SLUG }, retiredAt: null },
      orderBy: { position: "asc" },
      select: { blockKey: true },
    })
  ).map((block) => block.blockKey);

  const first = await seedLesson02Content(prisma);
  const second = await seedLesson02Content(prisma);
  assert.equal(first.ready, true);
  assert.equal(first.issues.length, 0);
  assert.equal(second.skipped || second.applied, true);
  assert.equal(second.activeBlocks, 28);
  assert.equal(await prisma.lesson.count({ where: { slug: LESSON_02_SLUG } }), 1);
  const active = await prisma.lessonBlock.findMany({
    where: { lesson: { slug: LESSON_02_SLUG }, retiredAt: null },
    orderBy: { position: "asc" },
    select: { blockKey: true, position: true, type: true, required: true },
  });
  assert.deepEqual(
    active.map((block) => block.blockKey),
    lesson02Blocks.map((block) => block.blockKey),
  );
  assert.deepEqual(
    active.map((block) => block.position),
    lesson02Blocks.map((block) => block.position),
  );
  assert.equal(active.filter((block) => block.type === "CHECKPOINT").length, 4);
  assert.equal(active.filter((block) => block.type === "IMAGE").length, 0);
  const stored = await prisma.lesson.findUniqueOrThrow({
    where: { slug: LESSON_02_SLUG },
    select: { accessType: true, commerceStatus: true, status: true, priceCents: true, estimatedMinutes: true, title: true, summary: true, publicPreview: true },
  });
  assert.equal(stored.title, lesson02Meta.title);
  assert.equal(stored.summary, lesson02Meta.summary);
  assert.equal(stored.publicPreview, lesson02Meta.publicPreview);
  assert.equal(stored.accessType, "FREE");
  assert.equal(stored.commerceStatus, "NOT_FOR_SALE");
  assert.equal(stored.status, "PUBLISHED");
  assert.equal(stored.priceCents, null);
  assert.equal(stored.estimatedMinutes, 25);

  const after = (await prisma.lesson.findMany({
    where: { slug: { in: [LESSON_01_SLUG, ...untouched] } },
    select,
  })).sort((a, b) => a.slug.localeCompare(b.slug));
  assert.deepEqual(after, before);
  const lesson01KeysAfter = (
    await prisma.lessonBlock.findMany({
      where: { lesson: { slug: LESSON_01_SLUG }, retiredAt: null },
      orderBy: { position: "asc" },
      select: { blockKey: true },
    })
  ).map((block) => block.blockKey);
  assert.deepEqual(lesson01KeysAfter, lesson01Keys);
  assert.deepEqual(lesson01KeysAfter, lesson01Blocks.map((block) => block.blockKey));
  assert.equal(lesson01Meta.title, before.find((lesson) => lesson.slug === LESSON_01_SLUG)?.title);

  const stamp = Date.now();
  const user = await prisma.user.create({
    data: {
      id: `lesson02-${stamp}`,
      name: "Uso temporário",
      email: `lesson02-${stamp}@example.com`,
      emailVerified: true,
      role: "USER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { slug: LESSON_02_SLUG }, select: { id: true } });
  await prisma.lessonProgress.create({ data: { userId: user.id, lessonId: lesson.id, percent: 10 } });
  const guarded = await seedLesson02Content(prisma);
  assert.equal(guarded.skipped, true);
  assert.equal(await prisma.lessonBlock.count({ where: { lessonId: lesson.id, retiredAt: null } }), 28);
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
});
