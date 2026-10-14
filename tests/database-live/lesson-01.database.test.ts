import assert from "node:assert/strict";
import test from "node:test";
import { config as loadEnv } from "dotenv";

import { LESSON_01_SLUG, lesson01Blocks } from "../../src/lib/learning/lesson-01";

loadEnv({ path: ".env.local" });

test("seed da aula 1 é idempotente e não reescreve as outras", async () => {
  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { seedLesson01Content } = await import("../../src/lib/learning/seed-lesson-01");
  const prisma = getPrisma();
  const otherBefore = await prisma.lesson.findUnique({
    where: { slug: "palavras-chave-com-intencao" },
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
    where: { slug: "palavras-chave-com-intencao" },
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
