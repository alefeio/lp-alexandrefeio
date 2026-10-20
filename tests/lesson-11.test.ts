import assert from "node:assert/strict";
import test from "node:test";
import { planLessonEnable } from "../src/lib/commerce/product-activation";
import { assessLesson } from "../src/lib/editorial/readiness";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { LESSON_11_SLUG, LESSON_12_SLUG, lesson11Blocks, lesson11Meta } from "../src/lib/learning/lesson-11";
import { LESSON_11_PUBLIC_PREVIEW_KEYS, PUBLIC_PREVIEW_TYPES } from "../src/lib/learning/public-preview";
import { parseBlockData } from "../src/lib/learning/blocks";

test("aula 11 definitiva tem 36 blocos e continua fora de venda", () => {
  assert.equal(lesson11Blocks.length, 36);
  assert.equal(new Set(lesson11Blocks.map((block) => block.blockKey)).size, 36);
  assert.deepEqual(lesson11Blocks.map((block) => block.position), lesson11Blocks.map((_, index) => index + 1));
  for (const block of lesson11Blocks) assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  assert.equal(lesson11Meta.accessType, "PAID");
  assert.equal(lesson11Meta.priceCents, 3490);
  assert.equal(lesson11Meta.commerceStatus, "NOT_FOR_SALE");
  const tool = lesson11Blocks.find((block) => block.data.type === "TOOL");
  assert.equal(tool?.data.type === "TOOL" && tool.data.toolKey, "CAMPAIGN_PERFORMANCE_DIAGNOSIS_V1");
  const preview = new Set<string>(PUBLIC_PREVIEW_TYPES);
  for (const key of LESSON_11_PUBLIC_PREVIEW_KEYS) {
    const block = lesson11Blocks.find((item) => item.blockKey === key);
    assert.ok(block);
    assert.equal(preview.has(block.data.type), true, key);
  }
  assert.equal((LESSON_11_PUBLIC_PREVIEW_KEYS as readonly string[]).includes("diagnostico-de-resultados"), false);
  const ready = assessLesson(
    {
      title: lesson11Meta.title,
      summary: lesson11Meta.summary,
      publicPreview: lesson11Meta.publicPreview,
      estimatedMinutes: lesson11Meta.estimatedMinutes,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: lesson11Meta.priceCents,
      commerceStatus: "NOT_FOR_SALE",
    },
    lesson11Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.equal(ready.ready, true, ready.issues.join(" "));
  const lessons = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_11_SLUG)?.blocks.length, 36);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_12_SLUG)?.blocks.length, 36);
  const moduleFinal = firstCourseSeed.modules.find((moduleRow) => moduleRow.slug === "entenda-e-melhore");
  assert.equal(moduleFinal?.bundlePriceCents, 6790);
  const sale = planLessonEnable({
    slug: LESSON_11_SLUG,
    title: lesson11Meta.title,
    priceCents: 3490,
    commerceStatus: "NOT_FOR_SALE",
    accessType: "PAID",
    status: "PUBLISHED",
    publicPreview: lesson11Meta.publicPreview,
    hasPublicPreviewBlocks: true,
    contentReady: true,
    contentIssues: [],
  });
  assert.equal(sale.allowed, true);
  assert.equal(sale.intended, "AVAILABLE");
});
