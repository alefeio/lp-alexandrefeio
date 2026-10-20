import assert from "node:assert/strict";
import test from "node:test";
import { assessLesson } from "../src/lib/editorial/readiness";
import { parseBlockData } from "../src/lib/learning/blocks";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { LESSON_11_SLUG } from "../src/lib/learning/lesson-11";
import { LESSON_12_SLUG, lesson12Blocks, lesson12Meta } from "../src/lib/learning/lesson-12";
import { LESSON_12_PUBLIC_PREVIEW_KEYS, PUBLIC_PREVIEW_TYPES } from "../src/lib/learning/public-preview";
import { planLessonEnable } from "../src/lib/commerce/product-activation";

test("aula 12 definitiva tem 36 blocos e continua fora de venda", () => {
  assert.equal(lesson12Blocks.length, 36);
  assert.equal(new Set(lesson12Blocks.map((block) => block.blockKey)).size, 36);
  assert.deepEqual(
    lesson12Blocks.map((block) => block.position),
    lesson12Blocks.map((_, index) => index + 1),
  );
  for (const block of lesson12Blocks) assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  const tool = lesson12Blocks.find((block) => block.data.type === "TOOL");
  assert.equal(tool?.data.type === "TOOL" && tool.data.toolKey, "CAMPAIGN_NEXT_ACTION_PLAN_V1");
  assert.equal(LESSON_12_PUBLIC_PREVIEW_KEYS.length, 6);
  for (const key of LESSON_12_PUBLIC_PREVIEW_KEYS) {
    const block = lesson12Blocks.find((item) => item.blockKey === key);
    assert.ok(block);
    assert.equal((PUBLIC_PREVIEW_TYPES as readonly string[]).includes(block.data.type), true);
  }
  assert.equal((LESSON_12_PUBLIC_PREVIEW_KEYS as readonly string[]).includes("plano-proxima-acao"), false);
  assert.equal(lesson12Meta.accessType, "PAID");
  assert.equal(lesson12Meta.priceCents, 3990);
  assert.equal(lesson12Meta.commerceStatus, "NOT_FOR_SALE");
  const ready = assessLesson(
    {
      title: lesson12Meta.title,
      summary: lesson12Meta.summary,
      publicPreview: lesson12Meta.publicPreview,
      estimatedMinutes: lesson12Meta.estimatedMinutes,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: lesson12Meta.priceCents,
      commerceStatus: "NOT_FOR_SALE",
    },
    lesson12Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.equal(ready.ready, true, ready.issues.join(" "));
  const lessons = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_12_SLUG)?.blocks.length, 36);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_11_SLUG)?.blocks.length, 36);
  const moduleFinal = firstCourseSeed.modules.find((moduleRow) => moduleRow.slug === "entenda-e-melhore");
  assert.equal(moduleFinal?.bundlePriceCents, 6790);
  const sale = planLessonEnable({
    slug: LESSON_12_SLUG,
    title: lesson12Meta.title,
    priceCents: 3990,
    commerceStatus: "NOT_FOR_SALE",
    accessType: "PAID",
    status: "PUBLISHED",
    publicPreview: lesson12Meta.publicPreview,
    hasPublicPreviewBlocks: true,
    contentReady: true,
    contentIssues: [],
  });
  assert.equal(sale.allowed, true);
  assert.equal(sale.intended, "AVAILABLE");
});
