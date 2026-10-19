import assert from "node:assert/strict";
import test from "node:test";
import { config as loadEnv } from "dotenv";
import { assessLesson } from "../src/lib/editorial/readiness";
import { lessonToolReturnPath, safeReturnPath } from "../src/lib/auth/messages";
import { parseBlockData } from "../src/lib/learning/blocks";
import { canReadLessonBody } from "../src/lib/learning/access";
import { lessonAnalyticsEntries, lessonAnalyticsPayload } from "../src/lib/learning/analytics-events";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { LESSON_01_SLUG, lesson01Blocks } from "../src/lib/learning/lesson-01";
import { LESSON_02_SLUG, lesson02Blocks } from "../src/lib/learning/lesson-02";
import { LESSON_03_SLUG, lesson03Blocks, lesson03Meta } from "../src/lib/learning/lesson-03";
import { trafficToolPreviewState } from "../src/lib/learning/tool";

loadEnv({ path: ".env.local" });

test("aula 3 definitiva tem 27 blocos e passa na validação", () => {
  assert.equal(lesson03Blocks.length, 27);
  assert.equal(new Set(lesson03Blocks.map((block) => block.blockKey)).size, 27);
  assert.deepEqual(
    lesson03Blocks.map((block) => block.position),
    lesson03Blocks.map((_, index) => index + 1),
  );
  for (const block of lesson03Blocks) assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  const tools = lesson03Blocks.filter((block) => block.data.type === "TOOL");
  assert.equal(tools.length, 1);
  assert.equal(tools[0]?.data.type === "TOOL" && tools[0].data.toolKey, "TRAFFIC_READINESS_V1");
  assert.equal(tools[0]?.required, true);
  assert.equal(lesson03Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 2);
  assert.equal(lesson03Blocks.filter((block) => block.data.type === "RESULT").length, 0);
  assert.equal(lesson03Blocks.filter((block) => block.data.type === "IMAGE").length, 0);
  assert.equal(lesson03Blocks.some((block) => block.data.type === "CONCLUSION"), true);
  assert.equal(lesson03Blocks.find((block) => block.blockKey === "checklist-depois-diagnostico")?.countsForProgress, false);
  assert.equal(lesson03Blocks.filter((block) => block.data.type === "HEADING").every((block) => !block.countsForProgress), true);
  for (const key of ["checkpoint-prontidao-estrutura", "diagnostico-prontidao-trafego", "checkpoint-score-gargalo"]) {
    assert.equal(lesson03Blocks.find((block) => block.blockKey === key)?.required, true);
  }
  assert.equal(lesson03Meta.accessType, "FREE");
  assert.equal(lesson03Meta.priceCents, null);
  assert.equal(lesson03Meta.estimatedMinutes, 20);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "FREE" }), true);
  const lessons = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons);
  assert.equal(lessons.filter((lesson) => lesson.slug === LESSON_03_SLUG).length, 1);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_01_SLUG)?.blocks.length, lesson01Blocks.length);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_02_SLUG)?.blocks.length, lesson02Blocks.length);
  assert.equal(lessons.find((lesson) => lesson.slug === "o-que-mudar")?.blocks.length, 36);
  const ready = assessLesson(
    {
      title: lesson03Meta.title,
      summary: lesson03Meta.summary,
      publicPreview: lesson03Meta.publicPreview,
      estimatedMinutes: lesson03Meta.estimatedMinutes,
      accessType: "FREE",
      status: "PUBLISHED",
      priceCents: null,
      commerceStatus: "NOT_FOR_SALE",
    },
    lesson03Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.deepEqual(ready.issues, []);
  const entries = lessonAnalyticsEntries(lessonAnalyticsPayload({ lessonSlug: LESSON_03_SLUG, courseSlug: "trafego-pago-na-pratica", accessType: "FREE", progressBucket: 25 }));
  for (const key of Object.keys(entries)) {
    assert.equal(["lesson_slug", "course_slug", "access_type", "progress_bucket"].includes(key), true);
  }
  assert.equal(trafficToolPreviewState().mode, "preview");
});

test("retorno do diagnóstico só aceita caminho interno", () => {
  const lesson = lessonToolReturnPath(LESSON_03_SLUG);
  assert.equal(safeReturnPath(lesson), lesson);
  assert.equal(safeReturnPath("https://externo.example"), null);
  assert.equal(safeReturnPath("//externo.example"), null);
  assert.equal(safeReturnPath("javascript:alert(1)"), null);
  assert.equal(safeReturnPath("/aulas/negocio-pronto-para-anunciar#javascript:alert(1)"), null);
  assert.equal(safeReturnPath("/\\externo"), null);
  const signup = `/cadastro?next=${encodeURIComponent(lesson)}`;
  assert.match(decodeURIComponent(signup), new RegExp(`${LESSON_03_SLUG}#diagnostico`));
});

