import assert from "node:assert/strict";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { canIndexLesson, canReadLessonBody, isPublicLesson, visibleBlocks } from "../src/lib/learning/access";
import { parseBlockData, RESULT_FIELD_MAX, resultResponseSchema, resultValuesError } from "../src/lib/learning/blocks";
import { firstCourseSeed, DEMO_LESSON_SLUG } from "../src/lib/learning/first-course";
import { lesson01Blocks } from "../src/lib/learning/lesson-01";
import { mergeLessonProgress, furthestBlockKey, parseLocalStore } from "../src/lib/learning/local-progress";
import { belongsToUser, ownedLesson, ownedRecord } from "../src/lib/learning/ownership";
import {
  hasUnreadEarlierReading,
  isBlockComplete,
  isLessonComplete,
  lessonProgressEvents,
  progressPercent,
  readingKeysFromUserScroll,
  remainingMinutes,
  savedCheckpointFeedback,
  type ProgressRuleBlock,
  type ReadingSpan,
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
  assert.equal(isLessonComplete(blocks, { "text-caminho": { viewed: true } }, false), false);
  const feedback = savedCheckpointFeedback(blocks, { "checkpoint-quando-anunciar": { optionId: "sem-oferta" } });
  assert.equal(feedback["checkpoint-quando-anunciar"]?.correct, false);
  assert.equal(feedback["checkpoint-quando-anunciar"]?.explanation, "Porque existe destino.");
  assert.equal(savedCheckpointFeedback(blocks, {})["checkpoint-quando-anunciar"], undefined);
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

  const order = ["text-caminho", "example-padaria", "activity-oferta"];
  const reread = mergeLessonProgress(
    { ...server, lastBlockKey: "activity-oferta" },
    { ...newer, lastBlockKey: "text-caminho" },
    order,
  );
  assert.equal(reread.write, true);
  assert.equal(reread.progress?.lastBlockKey, "activity-oferta");
  assert.equal(furthestBlockKey(order, ["text-caminho", "activity-oferta"]), "activity-oferta");

  const serverNewer = mergeLessonProgress(
    { ...server, updatedAt: "2026-10-10T18:00:00.000Z", lastBlockKey: "activity-oferta" },
    { ...older, lastBlockKey: "example-padaria" },
    order,
  );
  assert.equal(serverNewer.write, false);
  assert.equal(serverNewer.progress?.lastBlockKey, "activity-oferta");
  assert.equal(remainingMinutes(12, 50, false), 6);
  assert.equal(remainingMinutes(12, 0, false), null);
  assert.equal(remainingMinutes(12, 40, true), null);
  assert.deepEqual(lessonProgressEvents(0, 50).map((item) => item.bucket), [25, 50]);
  assert.equal(lessonProgressEvents(0, 50).every((item) => item.event === "lesson_progress"), true);
  assert.deepEqual(lessonProgressEvents(80, 100), [{ event: "lesson_completed", bucket: 100 }]);
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

test("resultado aceita mais de 40 caracteres e recusa acima de 200", () => {
  const offer = "Ultrassonografia obstétrica com preparo e horário de atendimento.";
  assert.ok(offer.length > 40);
  assert.ok(offer.length <= RESULT_FIELD_MAX);
  assert.equal(resultResponseSchema.safeParse({ "oferta-inicial": offer }).success, true);
  assert.equal(resultValuesError({ "oferta-inicial": offer }), null);
  const tooLong = "x".repeat(RESULT_FIELD_MAX + 1);
  assert.equal(resultResponseSchema.safeParse({ "oferta-inicial": tooLong }).success, false);
  assert.equal(resultValuesError({ "oferta-inicial": tooLong }), "Cada campo do resultado aceita até 200 caracteres.");
  assert.notEqual(tooLong.slice(0, RESULT_FIELD_MAX), tooLong);
});

test("leitura normal e scroll rápido registram o bloco; salto ao fim não", () => {
  const spans: ReadingSpan[] = [
    { blockKey: "abertura", top: 0, bottom: 420, countsAsReading: true },
    { blockKey: "texto-longo", top: 420, bottom: 2400, countsAsReading: true },
    { blockKey: "fecho", top: 2400, bottom: 2800, countsAsReading: true },
    { blockKey: "titulo", top: 2800, bottom: 2880, countsAsReading: false },
  ];
  const viewportHeight = 800;
  const seen = new Set<string>();
  let y = 0;
  while (y < 2800) {
    const next = Math.min(2800, y + 160);
    for (const key of readingKeysFromUserScroll({
      blocks: spans,
      previousScrollY: y,
      currentScrollY: next,
      viewportHeight,
      jumping: false,
    })) {
      seen.add(key);
    }
    y = next;
  }
  assert.deepEqual([...seen].sort(), ["abertura", "fecho", "texto-longo"]);

  const fast = readingKeysFromUserScroll({
    blocks: spans,
    previousScrollY: 0,
    currentScrollY: 1900,
    viewportHeight,
    jumping: false,
  });
  assert.equal(fast.includes("texto-longo"), true);
  assert.equal(fast.includes("abertura"), true);

  assert.deepEqual(
    readingKeysFromUserScroll({
      blocks: spans,
      previousScrollY: 0,
      currentScrollY: 2400,
      viewportHeight,
      jumping: true,
    }),
    [],
  );
  const landed = readingKeysFromUserScroll({
    blocks: spans,
    previousScrollY: 2400,
    currentScrollY: 2400,
    viewportHeight,
    jumping: false,
  });
  assert.deepEqual(landed, ["fecho"]);
  assert.equal(landed.includes("texto-longo"), false);
  assert.equal(lesson01Blocks.length, 27);
});

test("atalho não conclui e atividades obrigatórias continuam obrigatórias", () => {
  const opening: ProgressRuleBlock = {
    blockKey: "abertura",
    countsForProgress: true,
    required: false,
    retiredAt: null,
    data: { type: "TEXT", body: "Abertura." },
  };
  const middle: ProgressRuleBlock = {
    blockKey: "texto-longo",
    countsForProgress: true,
    required: false,
    retiredAt: null,
    data: { type: "TEXT", body: "Meio." },
  };
  const activity: ProgressRuleBlock = {
    blockKey: "atividade-primeiro-mapa",
    countsForProgress: true,
    required: true,
    retiredAt: null,
    data: { type: "ACTIVITY", prompt: "Mapa", inputType: "long_text" },
  };
  const result: ProgressRuleBlock = {
    blockKey: "resultado-primeiro-mapa",
    countsForProgress: true,
    required: true,
    retiredAt: null,
    data: {
      type: "RESULT",
      title: "Mapa",
      prompt: "Preencha",
      fields: [{ key: "oferta-inicial", label: "Minha oferta" }],
    },
  };
  const blocks = [opening, middle, activity, result];
  const readAll = {
    abertura: { viewed: true },
    "texto-longo": { viewed: true },
  };
  assert.equal(isLessonComplete(blocks, readAll, false), false);
  assert.equal(progressPercent(blocks, readAll, false) < 100, true);
  const withActivity = {
    ...readAll,
    "atividade-primeiro-mapa": { viewed: true, response: { text: "Mapa inicial do negócio." } },
  };
  assert.equal(isLessonComplete(blocks, withActivity, false), false);
  assert.equal(isLessonComplete(blocks, withActivity, true), true);

  const skipped = {
    fecho: { viewed: true },
    "atividade-primeiro-mapa": { viewed: true, response: { text: "Mapa inicial do negócio." } },
  };
  const jumped = [opening, middle, { ...activity, blockKey: "atividade-primeiro-mapa" }, {
    blockKey: "fecho",
    countsForProgress: true,
    required: false,
    retiredAt: null,
    data: { type: "CONCLUSION", body: "Fim." },
  } satisfies ProgressRuleBlock];
  assert.equal(isLessonComplete(jumped, skipped, false), false);
  assert.equal(progressPercent(jumped, skipped, false) < 100, true);
  assert.equal(
    hasUnreadEarlierReading(
      [
        { blockKey: "abertura", position: 1, countsForProgress: true, type: "TEXT" },
        { blockKey: "texto-longo", position: 2, countsForProgress: true, type: "TEXT" },
        { blockKey: "fecho", position: 3, countsForProgress: true, type: "CONCLUSION" },
      ],
      ["fecho"],
      "fecho",
    ),
    true,
  );
});

test("recarregar preserva leitura e resultado acima de 40 caracteres", () => {
  const offer = "Consulta de ultrassonografia com orientação antes do exame.";
  assert.ok(offer.length > 40);
  const raw = JSON.stringify({
    [DEMO_LESSON_SLUG]: {
      updatedAt: "2026-10-13T12:00:00.000Z",
      lastBlockKey: "conclusao-aula-01",
      viewedBlockKeys: ["trafego-pago-nao-e-so-anunciar", "conclusao-aula-01"],
      responses: { "atividade-primeiro-mapa": { text: "Mapa da clínica." } },
      result: { "oferta-inicial": offer },
    },
  });
  const restored = parseLocalStore(raw)[DEMO_LESSON_SLUG];
  assert.deepEqual(restored?.viewedBlockKeys, ["trafego-pago-nao-e-so-anunciar", "conclusao-aula-01"]);
  assert.equal(restored?.result?.["oferta-inicial"], offer);
  const rejected = parseLocalStore(
    JSON.stringify({
      [DEMO_LESSON_SLUG]: {
        updatedAt: "2026-10-13T12:00:00.000Z",
        lastBlockKey: "resultado-primeiro-mapa",
        viewedBlockKeys: ["trafego-pago-nao-e-so-anunciar"],
        responses: {},
        result: { "oferta-inicial": "x".repeat(RESULT_FIELD_MAX + 1) },
      },
    }),
  )[DEMO_LESSON_SLUG];
  assert.equal(rejected?.result, null);
  assert.deepEqual(rejected?.viewedBlockKeys, ["trafego-pago-nao-e-so-anunciar"]);
});

test("payload inválido não vira bloco e o curso de demonstração tem 12 aulas", () => {
  assert.equal(parseBlockData({ type: "TEXT", body: "<script>alert(1)</script>" })?.type, "TEXT");
  assert.equal(parseBlockData({ type: "HTML", body: "x" }), null);
  const lessons = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons);
  assert.equal(lessons.length, 12);
  assert.equal(lessons.filter((lesson) => lesson.blocks.length > 0).length, 3);
  assert.equal(lessons.find((lesson) => lesson.slug === "como-funciona-o-trafego-pago")?.blocks.length, 27);
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
    const resultB = await prisma.lessonResult.findFirst({ where: { ...ownedLesson(userB, lessonId), projectId: null } });
    assert.equal(resultB, null);
  } finally {
    await prisma.course.delete({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  }
});
