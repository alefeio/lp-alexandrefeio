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
  assert.equal(lessons.filter((lesson) => lesson.blocks.length > 0).length, 11);
  assert.equal(lessons.find((lesson) => lesson.slug === "como-funciona-o-trafego-pago")?.blocks.length, 27);
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

