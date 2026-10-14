import assert from "node:assert/strict";
import { config as loadEnv } from "dotenv";
import test from "node:test";

import { ownedLesson, ownedRecord } from "../../src/lib/learning/ownership";

loadEnv({ path: ".env.local" });

test("usuário A não lê registro do usuário B no banco de desenvolvimento", async () => {
  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../../src/lib/db/prisma");
  const prisma = getPrisma();
  const stamp = Date.now();
  const userA = `user-a-${stamp}`;
  const userB = `user-b-${stamp}`;
  const lessonId = `lesson-${stamp}`;
  const moduleId = `module-${stamp}`;
  const courseId = `course-${stamp}`;

  await prisma.user.create({
    data: { id: userA, name: "A", email: `sprint2-a-${stamp}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
  });
  await prisma.user.create({
    data: { id: userB, name: "B", email: `sprint2-b-${stamp}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
  });
  await prisma.course.create({
    data: {
      id: courseId,
      slug: `rascunho-interno-${stamp}`,
      title: "Rascunho",
      description: "Não publicar",
      status: "DRAFT",
      modules: {
        create: {
          id: moduleId,
          slug: "rascunho",
          title: "Rascunho",
          description: "Não publicar",
          status: "DRAFT",
          lessons: {
            create: {
              id: lessonId,
              slug: `rascunho-interno-${stamp}`,
              title: "Rascunho",
              summary: "Não publicar",
              status: "DRAFT",
              accessType: "PAID",
              priceCents: 1000,
            },
          },
        },
      },
    },
  });

  try {
    const hidden = await prisma.lesson.findFirst({ where: { slug: `rascunho-interno-${stamp}`, status: "PUBLISHED" } });
    assert.equal(hidden, null);

    await prisma.lessonProgress.create({
      data: { userId: userA, lessonId, lastBlockKey: "text-caminho", percent: 25 },
    });
    const progressB = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: ownedLesson(userB, lessonId) },
    });
    assert.equal(progressB, null);
    const progressA = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: ownedLesson(userA, lessonId) },
    });
    assert.equal(progressA?.lastBlockKey, "text-caminho");
    assert.equal(progressA?.percent, 25);

    await prisma.lessonResponse.create({
      data: { userId: userA, lessonId, blockKey: "activity-oferta", payload: { text: "oferta da aula" } },
    });
    const responseB = await prisma.lessonResponse.findUnique({
      where: { userId_lessonId_blockKey: { ...ownedLesson(userB, lessonId), blockKey: "activity-oferta" } },
    });
    assert.equal(responseB, null);

    await prisma.lessonNote.create({
      data: { userId: userA, lessonId, blockKey: "text-caminho", body: "nota privada" },
    });
    const noteB = await prisma.lessonNote.findFirst({ where: ownedRecord(userB, "missing") });
    assert.equal(noteB, null);
    const noteForB = await prisma.lessonNote.findFirst({ where: { userId: userB, lessonId } });
    assert.equal(noteForB, null);

    await prisma.lessonBookmark.create({ data: { userId: userA, lessonId, blockKey: "text-caminho" } });
    const bookmarkB = await prisma.lessonBookmark.findFirst({ where: ownedLesson(userB, lessonId) });
    assert.equal(bookmarkB, null);

    await prisma.lessonResult.create({
      data: { userId: userA, lessonId, payload: { "oferta-clara": "sim" } },
    });
    await assert.rejects(
      prisma.lessonResult.create({ data: { userId: userA, lessonId, payload: { "oferta-clara": "nao" } } }),
    );
    const resultB = await prisma.lessonResult.findFirst({ where: { ...ownedLesson(userB, lessonId), projectId: null } });
    assert.equal(resultB, null);
  } finally {
    await prisma.course.delete({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  }
});
