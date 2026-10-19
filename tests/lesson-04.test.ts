import assert from "node:assert/strict";
import test from "node:test";
import { config as loadEnv } from "dotenv";
import { assessLesson } from "../src/lib/editorial/readiness";
import { canReadLessonBody, visibleBlocks } from "../src/lib/learning/access";
import { lessonAnalyticsPayload } from "../src/lib/learning/analytics-events";
import { dailyBudgetReferenceCents } from "../src/lib/learning/campaign-brief";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { LESSON_01_SLUG, lesson01Blocks } from "../src/lib/learning/lesson-01";
import { LESSON_02_SLUG, lesson02Blocks } from "../src/lib/learning/lesson-02";
import { LESSON_03_SLUG, lesson03Blocks } from "../src/lib/learning/lesson-03";
import { LESSON_04_SLUG, lesson04Blocks, lesson04Meta } from "../src/lib/learning/lesson-04";
import { parseBlockData } from "../src/lib/learning/blocks";
import { isLessonComplete, type ProgressRuleBlock } from "../src/lib/learning/progress";

loadEnv({ path: ".env.local" });

const required = ["checkpoint-objetivo-negocio", "checkpoint-oferta-especifica", "checkpoint-orcamento", "brief-inicial-campanha", "checkpoint-final-brief"];

test("aula 4 definitiva tem 30 blocos e passa na validação", () => {
  assert.equal(lesson04Blocks.length, 30);
  assert.equal(new Set(lesson04Blocks.map((block) => block.blockKey)).size, 30);
  assert.deepEqual(
    lesson04Blocks.map((block) => block.position),
    lesson04Blocks.map((_, index) => index + 1),
  );
  for (const block of lesson04Blocks) assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  const tools = lesson04Blocks.filter((block) => block.data.type === "TOOL");
  assert.equal(tools.length, 1);
  assert.equal(tools[0]?.data.type === "TOOL" && tools[0].data.toolKey, "CAMPAIGN_BRIEF_V1");
  assert.equal(lesson04Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 4);
  assert.equal(lesson04Blocks.filter((block) => block.data.type === "RESULT").length, 0);
  assert.equal(lesson04Blocks.some((block) => block.data.type === "CONCLUSION"), true);
  assert.equal(lesson04Blocks.filter((block) => block.data.type === "HEADING").every((block) => !block.countsForProgress), true);
  for (const key of required) assert.equal(lesson04Blocks.find((block) => block.blockKey === key)?.required, true);
  assert.equal(lesson04Meta.accessType, "PAID");
  assert.equal(lesson04Meta.priceCents, 2990);
  assert.equal(lesson04Meta.commerceStatus, "NOT_FOR_SALE");
  assert.equal(lesson04Meta.estimatedMinutes, 30);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }), false);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }, { entitled: true }), true);
  assert.equal(visibleBlocks({ status: "PUBLISHED", accessType: "PAID" }, lesson04Blocks).length, 0);
  const lessons = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons);
  assert.equal(lessons.filter((lesson) => lesson.slug === LESSON_04_SLUG).length, 1);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_01_SLUG)?.blocks.length, lesson01Blocks.length);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_02_SLUG)?.blocks.length, lesson02Blocks.length);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_03_SLUG)?.blocks.length, lesson03Blocks.length);
  assert.equal(lessons.find((lesson) => lesson.slug === "anuncios-alinhados-a-conversao")?.blocks.length, 0);
  const ready = assessLesson(
    {
      title: lesson04Meta.title,
      summary: lesson04Meta.summary,
      publicPreview: lesson04Meta.publicPreview,
      estimatedMinutes: lesson04Meta.estimatedMinutes,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: 2990,
      commerceStatus: "NOT_FOR_SALE",
    },
    lesson04Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.deepEqual(ready.issues, []);
  assert.equal(ready.ready, true);
  const trafficOnly = assessLesson(
    {
      title: "Paga sem resultado",
      summary: "Resumo",
      publicPreview: "Preview",
      estimatedMinutes: 10,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: 1000,
      commerceStatus: "NOT_FOR_SALE",
    },
    [
      { blockKey: "texto", retiredAt: null, payload: { type: "TEXT", body: "Conteúdo da aula." } },
      { blockKey: "fim", retiredAt: null, payload: { type: "CONCLUSION", body: "Fim." } },
      { blockKey: "ferramenta", retiredAt: null, payload: { type: "TOOL", toolKey: "TRAFFIC_READINESS_V1", title: "Diagnóstico", description: "Abrir." } },
    ],
  );
  assert.equal(trafficOnly.ready, false);
  assert.equal(dailyBudgetReferenceCents(60000), 2000);
  assert.equal(dailyBudgetReferenceCents(15), 1);
  assert.equal(dailyBudgetReferenceCents(14), 0);
  assert.equal(dailyBudgetReferenceCents(100), 3);
  const payload = lessonAnalyticsPayload({ lessonSlug: LESSON_04_SLUG, courseSlug: "trafego-pago-na-pratica", accessType: "PAID" });
  assert.deepEqual(Object.keys(payload).sort(), ["access_type", "course_slug", "lesson_slug"]);
  const rules: ProgressRuleBlock[] = lesson04Blocks.map((block) => ({ ...block, retiredAt: null }));
  const answers = Object.fromEntries(
    lesson04Blocks.map((block) => {
      if (block.data.type === "CHECKPOINT") return [block.blockKey, { viewed: true, response: { optionId: block.data.correctOptionId } }];
      if (block.data.type === "TOOL") return [block.blockKey, { viewed: true, response: { projectId: "projeto-1" } }];
      return [block.blockKey, { viewed: true }];
    }),
  );
  assert.equal(isLessonComplete(rules, answers, false, new Set()), false);
  assert.equal(isLessonComplete(rules, answers, false, new Set(["projeto-1"])), true);
});
