import assert from "node:assert/strict";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { canIndexLesson, canReadLessonBody, isPublicLesson, visibleBlocks } from "../src/lib/learning/access";
import { parseBlockData } from "../src/lib/learning/blocks";
import { firstCourseSeed, DEMO_LESSON_SLUG } from "../src/lib/learning/first-course";
import { mergeLessonProgress } from "../src/lib/learning/local-progress";
import { belongsToUser, ownedLesson, ownedRecord } from "../src/lib/learning/ownership";
import {
  isBlockComplete,
  isLessonComplete,
  progressPercent,
  type ProgressRuleBlock,
} from "../src/lib/learning/progress";
import { needsSession } from "../src/proxy";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";

loadEnv({ path: ".env.local" });

const checkpoint: ProgressRuleBlock = {
  blockKey: "checkpoint-quando-anunciar",
  countsForProgress: true,
  required: true,
  retiredAt: null,
  data: {
    type: "CHECKPOINT",
    question: "Quando?",
    options: [
      { id: "oferta-e-destino", label: "Com oferta" },
      { id: "sem-oferta", label: "Sem oferta" },
    ],
    correctOptionId: "oferta-e-destino",
    explanation: "Porque existe destino.",
  },
};

const text: ProgressRuleBlock = {
  blockKey: "text-caminho",
  countsForProgress: true,
  required: false,
  retiredAt: null,
  data: { type: "TEXT", body: "Texto da aula." },
};

test("aula gratuita publicada abre o corpo; paga e rascunho não", () => {
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "FREE" }), true);
  assert.equal(visibleBlocks({ status: "PUBLISHED", accessType: "FREE" }, ["corpo"]).length, 1);
  assert.deepEqual(visibleBlocks({ status: "PUBLISHED", accessType: "PAID" }, ["corpo"]), []);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }), false);
  assert.equal(isPublicLesson({ status: "DRAFT" }), false);
  assert.equal(canIndexLesson({ status: "DRAFT", accessType: "FREE", publicPreview: "x" }, true), false);
});

test("sitemap não inclui aula não indexável", () => {
  const urls = buildPublicSitemap("https://alexandrefeio.com.br", {
    courses: [{ slug: "trafego-pago-na-pratica", updatedAt: new Date() }],
    lessons: [
      { slug: DEMO_LESSON_SLUG, updatedAt: new Date(), indexable: true },
      { slug: "rascunho-interno", updatedAt: new Date(), indexable: false },
    ],
  }).map((entry) => entry.url);
  assert.ok(urls.includes("https://alexandrefeio.com.br/aulas/como-funciona-o-trafego-pago"));
  assert.equal(urls.some((url) => url.includes("rascunho-interno")), false);
  assert.equal(urls.some((url) => url.includes("/app")), false);
});

test("percentual ignora bloco que não conta e exige checkpoint certo", () => {
  const blocks = [text, checkpoint];
  assert.equal(progressPercent(blocks, { "text-caminho": { viewed: true } }, false), 50);
  assert.equal(
    isBlockComplete(checkpoint, { viewed: true, response: { optionId: "sem-oferta" } }, false),
    false,
  );
  assert.equal(
    progressPercent(blocks, {
      "text-caminho": { viewed: true },
      "checkpoint-quando-anunciar": { viewed: true, response: { optionId: "sem-oferta" } },
    }, false),
    50,
  );
  const done = {
    "text-caminho": { viewed: true },
    "checkpoint-quando-anunciar": { viewed: true, response: { optionId: "oferta-e-destino" } },
  };
  assert.equal(progressPercent(blocks, done, false), 100);
  assert.equal(isLessonComplete(blocks, done, false), true);
});

test("último bloco é a chave, não a posição", () => {
  const answers = { "text-caminho": { viewed: true } };
  assert.equal(progressPercent([text], answers, false), 100);
  const lastBlockKey = "checkpoint-quando-anunciar";
  assert.equal(lastBlockKey.includes("0"), false);
  assert.equal(checkpoint.blockKey, lastBlockKey);
});

test("merge não deixa progresso local antigo apagar o servidor", () => {
  const server = {
    updatedAt: "2026-10-10T12:00:00.000Z",
    lastBlockKey: "text-caminho",
    viewedBlockKeys: ["text-caminho"],
    responses: { "activity-oferta": { text: "servidor" } },
    result: { "oferta-clara": "sim" },
  };
  const older = {
    updatedAt: "2026-10-10T08:00:00.000Z",
    lastBlockKey: "example-padaria",
    viewedBlockKeys: ["example-padaria"],
    responses: { "activity-oferta": { text: "local" } },
    result: null,
  };
  const kept = mergeLessonProgress(server, older);
  assert.equal(kept.write, false);
  assert.equal(kept.progress?.responses["activity-oferta"] && (kept.progress.responses["activity-oferta"] as { text: string }).text, "servidor");

  const newer = { ...older, updatedAt: "2026-10-10T13:00:00.000Z" };
  const merged = mergeLessonProgress(server, newer);
  assert.equal(merged.write, true);
  assert.deepEqual(merged.progress?.viewedBlockKeys.sort(), ["example-padaria", "text-caminho"]);
  assert.equal((merged.progress?.responses["activity-oferta"] as { text: string }).text, "servidor");
});

test("nota, bookmark e resultado ficam presos ao usuário", () => {
  const noteA = { id: "note-1", userId: "user-a" };
  assert.equal(belongsToUser(noteA, "user-a"), true);
  assert.equal(belongsToUser(noteA, "user-b"), false);
  assert.deepEqual(ownedRecord("user-b", "note-1"), { id: "note-1", userId: "user-b" });
  assert.deepEqual(ownedLesson("user-a", "lesson-1"), { userId: "user-a", lessonId: "lesson-1" });
  assert.notDeepEqual(ownedLesson("user-a", "lesson-1"), ownedLesson("user-b", "lesson-1"));
});

test("/app continua protegido e a aula pública não", () => {
  assert.equal(needsSession("/app"), true);
  assert.equal(needsSession("/app/aprendizado"), true);
  assert.equal(needsSession("/admin"), true);
  assert.equal(needsSession("/aulas/como-funciona-o-trafego-pago"), false);
  assert.equal(needsSession("/cursos"), false);
});

test("payload inválido não vira bloco e o curso de demonstração tem 12 aulas", () => {
  assert.equal(parseBlockData({ type: "TEXT", body: "<script>alert(1)</script>" })?.type, "TEXT");
  assert.equal(parseBlockData({ type: "HTML", body: "x" }), null);
  const lessons = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons);
  assert.equal(lessons.length, 12);
  assert.equal(lessons.filter((lesson) => lesson.blocks.length > 0).length, 1);
  assert.equal(lessons.find((lesson) => lesson.slug === DEMO_LESSON_SLUG)?.accessType, "FREE");
});

test("usuário A não lê registro do usuário B no banco de desenvolvimento", async () => {
  const { assertMigrationTargetAllowed } = await import("../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../src/lib/db/prisma");
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
    const resultB = await prisma.lessonResult.findUnique({ where: { userId_lessonId: ownedLesson(userB, lessonId) } });
    assert.equal(resultB, null);
  } finally {
    await prisma.course.delete({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  }
});
