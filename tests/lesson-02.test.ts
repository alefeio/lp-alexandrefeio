import assert from "node:assert/strict";
import test from "node:test";
import { config as loadEnv } from "dotenv";
import { assessLesson } from "../src/lib/editorial/readiness";
import { RESULT_FIELD_MAX, parseBlockData, resultResponseSchema } from "../src/lib/learning/blocks";
import { canReadLessonBody } from "../src/lib/learning/access";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { LESSON_01_SLUG, lesson01Blocks } from "../src/lib/learning/lesson-01";
import { LESSON_02_SLUG, lesson02Blocks, lesson02Meta } from "../src/lib/learning/lesson-02";

loadEnv({ path: ".env.local" });

const requiredKeys = [
  "checkpoint-demanda-ativa",
  "checkpoint-descoberta-meta",
  "checkpoint-canais-complementares",
  "atividade-cenario-canal",
  "resultado-indicacao-canal",
  "checkpoint-final-escolha-canal",
];

const correctOptions: Record<string, string> = {
  "checkpoint-demanda-ativa": "pesquisa-ultrassom",
  "checkpoint-descoberta-meta": "colecao-nova",
  "checkpoint-canais-complementares": "papeis-diferentes",
  "checkpoint-final-escolha-canal": "ambos-com-criterio",
};

test("aula 2 definitiva tem 28 blocos válidos e passa na validação", () => {
  assert.equal(lesson02Blocks.length, 28);
  assert.equal(new Set(lesson02Blocks.map((block) => block.blockKey)).size, 28);
  assert.deepEqual(
    lesson02Blocks.map((block) => block.position),
    lesson02Blocks.map((_, index) => index + 1),
  );
  for (const block of lesson02Blocks) {
    assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  }
  const checkpoints = lesson02Blocks.filter((block) => block.data.type === "CHECKPOINT");
  assert.equal(checkpoints.length, 4);
  for (const block of checkpoints) {
    assert.equal(block.required, true);
    assert.equal(block.data.type === "CHECKPOINT" && block.data.correctOptionId, correctOptions[block.blockKey]);
    assert.equal(block.data.type === "CHECKPOINT" && Boolean(block.data.explanation), true);
  }
  assert.equal(lesson02Blocks.filter((block) => block.data.type === "IMAGE").length, 0);
  assert.equal(lesson02Blocks.find((block) => block.blockKey === "atividade-cenario-canal")?.required, true);
  assert.equal(lesson02Blocks.find((block) => block.blockKey === "resultado-indicacao-canal")?.required, true);
  assert.equal(lesson02Blocks.find((block) => block.blockKey === "checklist-indicios-canal")?.countsForProgress, false);
  assert.equal(lesson02Blocks.find((block) => block.blockKey === "checklist-indicios-canal")?.required, false);
  assert.equal(lesson02Blocks.filter((block) => block.data.type === "HEADING").every((block) => !block.countsForProgress), true);
  assert.equal(lesson02Blocks.some((block) => block.data.type === "CONCLUSION"), true);
  for (const key of requiredKeys) {
    assert.equal(lesson02Blocks.find((block) => block.blockKey === key)?.required, true);
  }
  const result = lesson02Blocks.find((block) => block.blockKey === "resultado-indicacao-canal");
  assert.equal(result?.data.type, "RESULT");
  if (result?.data.type === "RESULT") {
    assert.equal(result.data.fields.length, 5);
    assert.deepEqual(
      result.data.fields.map((field) => field.key),
      ["cenario-demanda", "indicacao-inicial", "motivo-escolha", "validacao-antes", "segundo-canal"],
    );
  }
  const values = Object.fromEntries(result?.data.type === "RESULT" ? result.data.fields.map((field) => [field.key, "a".repeat(RESULT_FIELD_MAX)]) : []);
  assert.equal(resultResponseSchema.safeParse(values).success, true);
  assert.equal(resultResponseSchema.safeParse({ ...values, "cenario-demanda": "a".repeat(RESULT_FIELD_MAX + 1) }).success, false);
  assert.equal(lesson02Meta.accessType, "FREE");
  assert.equal(lesson02Meta.priceCents, null);
  assert.equal(lesson02Meta.commerceStatus, "NOT_FOR_SALE");
  assert.equal(lesson02Meta.estimatedMinutes, 25);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "FREE" }), true);
  const lessons = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons);
  assert.equal(lessons.filter((lesson) => lesson.slug === LESSON_02_SLUG).length, 1);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_01_SLUG)?.blocks.length, lesson01Blocks.length);
  assert.equal(lessons.find((lesson) => lesson.slug === "o-que-mudar")?.blocks.length, 36);
  const ready = assessLesson(
    {
      title: lesson02Meta.title,
      summary: lesson02Meta.summary,
      publicPreview: lesson02Meta.publicPreview,
      estimatedMinutes: lesson02Meta.estimatedMinutes,
      accessType: "FREE",
      status: "PUBLISHED",
      priceCents: null,
      commerceStatus: "NOT_FOR_SALE",
    },
    lesson02Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.deepEqual(ready.issues, []);
  assert.equal(ready.ready, true);
});

