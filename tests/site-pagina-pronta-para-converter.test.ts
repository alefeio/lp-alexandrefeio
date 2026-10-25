import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assessLesson } from "../src/lib/editorial/readiness";
import { canIndexLesson, canReadLessonBody, isPublicLesson } from "../src/lib/learning/access";
import { parseBlockData } from "../src/lib/learning/blocks";
import {
  CONVERSION_PAGE_READINESS_TOOL,
  DIMENSION_WEIGHTS,
  READINESS_DIMENSIONS,
  READINESS_QUESTIONS,
  decidePageReadiness,
  pageReadinessLocalKey,
  pageReadinessResponseSchema,
  parsePageReadinessForm,
  scoreDimension,
} from "../src/lib/learning/conversion-page-readiness";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { isBlockComplete } from "../src/lib/learning/progress";
import { SITE_LESSON_03_SLUG, siteLesson03Blocks, siteLesson03Meta } from "../src/lib/learning/site-pagina-pronta-para-converter";
import { SITES_COURSE_SLUG, sitesCourseSeed } from "../src/lib/learning/sites-course";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";

function allYes() {
  return Object.fromEntries(READINESS_QUESTIONS.map((question) => [question.id, "YES" as const]));
}

function allNo() {
  return Object.fromEntries(READINESS_QUESTIONS.map((question) => [question.id, "NO" as const]));
}

test("aula 3 sites definitiva tem 30 blocos, 4 checkpoints e tool", () => {
  assert.equal(siteLesson03Blocks.length, 30);
  assert.equal(new Set(siteLesson03Blocks.map((block) => block.blockKey)).size, 30);
  assert.deepEqual(
    siteLesson03Blocks.map((block) => block.position),
    siteLesson03Blocks.map((_, index) => index + 1),
  );
  for (const block of siteLesson03Blocks) {
    assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  }
  assert.equal(siteLesson03Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 4);
  assert.equal(siteLesson03Blocks.filter((block) => block.data.type === "TOOL").length, 1);
  assert.equal(siteLesson03Blocks.filter((block) => block.data.type === "ACTIVITY").length, 1);
  assert.equal(siteLesson03Blocks.some((block) => block.data.type === "CONCLUSION"), true);
  const tool = siteLesson03Blocks.find((block) => block.blockKey === "tool-prontidao-pagina");
  assert.equal(tool?.required, true);
  assert.equal(tool?.data.type, "TOOL");
  if (tool?.data.type === "TOOL") {
    assert.equal(tool.data.toolKey, CONVERSION_PAGE_READINESS_TOOL);
    assert.match(tool.data.title, /prontidão/i);
  }
  const conclusion = siteLesson03Blocks.find((block) => block.data.type === "CONCLUSION");
  assert.equal(conclusion?.data.type, "CONCLUSION");
  if (conclusion?.data.type === "CONCLUSION") {
    assert.match(conclusion.data.body, /próximas aulas|página planejada/i);
  }
  assert.equal(siteLesson03Meta.accessType, "FREE");
  assert.equal(READINESS_QUESTIONS.length, 16);
  assert.equal(READINESS_DIMENSIONS.length, 8);
  assert.equal(
    Object.values(DIMENSION_WEIGHTS).reduce((sum, weight) => sum + weight, 0),
    100,
  );
  const ready = assessLesson(
    {
      title: siteLesson03Meta.title,
      summary: siteLesson03Meta.summary,
      publicPreview: siteLesson03Meta.publicPreview,
      estimatedMinutes: siteLesson03Meta.estimatedMinutes,
      accessType: "FREE",
      status: "PUBLISHED",
      priceCents: null,
      commerceStatus: "NOT_FOR_SALE",
    },
    siteLesson03Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.deepEqual(ready.issues, []);
  assert.equal(ready.ready, true);
});

test("CONVERSION_PAGE_READINESS_V1: scores, coverage, unknown, foundation, critical override", () => {
  const clarity = scoreDimension("CLARITY", { clarity_offer_clear: "YES", clarity_audience_context: "YES" });
  assert.equal(clarity.score, 100);
  assert.equal(clarity.status, "STRONG");

  const unknownDim = scoreDimension("CLARITY", { clarity_offer_clear: "UNKNOWN", clarity_audience_context: "UNKNOWN" });
  assert.equal(unknownDim.score, null);
  assert.equal(unknownDim.status, "INSUFFICIENT_INFORMATION");

  const partialUnknown = scoreDimension("CLARITY", { clarity_offer_clear: "YES", clarity_audience_context: "UNKNOWN" });
  assert.equal(partialUnknown.score, 100);
  assert.equal(partialUnknown.knownAnswers, 1);

  const foundation = decidePageReadiness({ pageExists: "NO", answers: {} });
  assert.equal(foundation.overallReadiness, "FOUNDATION_NOT_BUILT");
  assert.equal(foundation.overallScore, null);
  assert.equal(foundation.primaryBottleneck, "FOUNDATION");
  assert.equal(foundation.dimensionScores.length, 0);

  const strong = decidePageReadiness({ pageExists: "YES", answers: allYes() });
  assert.equal(strong.overallReadiness, "READY_TO_VALIDATE");
  assert.equal(strong.assessmentCoverage.evaluated, 8);
  assert.ok((strong.overallScore ?? 0) >= 75);
  assert.ok(strong.caveats.some((item) => /não significa pronto para performar/i.test(item)));

  const weak = decidePageReadiness({ pageExists: "YES", answers: allNo() });
  assert.equal(weak.overallReadiness, "NEEDS_PREPARATION");
  assert.ok(["CLARITY", "OFFER", "CTA"].includes(weak.primaryBottleneck));
  assert.ok(weak.priorities.length <= 3);
  assert.equal(weak.priorities[0]?.status, "CRITICAL");

  const highScoreCriticalCta = decidePageReadiness({
    pageExists: "YES",
    answers: {
      ...allYes(),
      cta_main_action: "NO",
      cta_visibility: "NO",
    },
  });
  assert.ok((highScoreCriticalCta.overallScore ?? 0) > 60);
  assert.equal(highScoreCriticalCta.overallReadiness, "NEEDS_PREPARATION");
  assert.equal(highScoreCriticalCta.primaryBottleneck, "CTA");

  const clarityCritical = decidePageReadiness({
    pageExists: "YES",
    answers: { ...allYes(), clarity_offer_clear: "NO", clarity_audience_context: "NO" },
  });
  assert.equal(clarityCritical.overallReadiness, "NEEDS_PREPARATION");
  assert.equal(clarityCritical.primaryBottleneck, "CLARITY");

  const offerCritical = decidePageReadiness({
    pageExists: "YES",
    answers: { ...allYes(), offer_defined: "NO", offer_next_step: "NO" },
  });
  assert.equal(offerCritical.overallReadiness, "NEEDS_PREPARATION");
  assert.equal(offerCritical.primaryBottleneck, "OFFER");

  const improve = decidePageReadiness({
    pageExists: "YES",
    answers: {
      ...allYes(),
      trust_identity: "PARTIALLY",
      trust_evidence: "PARTIALLY",
      measurement_action: "PARTIALLY",
      measurement_review: "NO",
    },
  });
  assert.ok(["READY_TO_IMPROVE", "READY_TO_VALIDATE"].includes(improve.overallReadiness));

  const insufficient = decidePageReadiness({
    pageExists: "YES",
    answers: {
      clarity_offer_clear: "UNKNOWN",
      clarity_audience_context: "UNKNOWN",
      offer_defined: "YES",
      offer_next_step: "YES",
    },
  });
  assert.equal(insufficient.overallReadiness, "INSUFFICIENT_INFORMATION");
  assert.equal(insufficient.overallScore, null);

  const partialPage = decidePageReadiness({
    pageExists: "PARTIALLY",
    answers: {
      ...allYes(),
      mobile_reading: "UNKNOWN",
      mobile_forms: "UNKNOWN",
      measurement_action: "UNKNOWN",
      measurement_review: "UNKNOWN",
    },
  });
  assert.ok(partialPage.assessmentCoverage.evaluated < 8);
  assert.ok(partialPage.caveats.some((item) => /parcial/i.test(item)));
});

test("CONVERSION_PAGE_READINESS_V1: form, progresso, chave local", () => {
  const parsed = parsePageReadinessForm({
    pageExists: "YES",
    answers: Object.fromEntries(READINESS_QUESTIONS.map((question) => [question.id, "YES"])),
    context: { offer: "Consultoria", recommendedStructure: "Landing page" },
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const response = pageReadinessResponseSchema.parse({ kind: "personal", projectId: null, readiness: parsed.readiness });
  const toolBlock = {
    blockKey: "tool-prontidao-pagina",
    countsForProgress: true,
    required: true,
    retiredAt: null,
    data: siteLesson03Blocks.find((block) => block.blockKey === "tool-prontidao-pagina")!.data,
  };
  assert.equal(isBlockComplete(toolBlock, { viewed: true, response }, false), true);
  assert.equal(isBlockComplete(toolBlock, { viewed: true, response: { kind: "personal" } }, false), false);
  assert.equal(pageReadinessLocalKey(), `af_${SITES_COURSE_SLUG}_${SITE_LESSON_03_SLUG}_conversion_page_readiness_v1`);

  const noPage = parsePageReadinessForm({ pageExists: "NO", answers: {} });
  assert.equal(noPage.ok, true);
  if (noPage.ok) {
    assert.equal(noPage.readiness.overallScore, null);
    assert.equal(noPage.readiness.overallReadiness, "FOUNDATION_NOT_BUILT");
  }
});

test("privacidade e discovery: analytics sem dados estratégicos; curso DRAFT/NFS", () => {
  const analytics = readFileSync(new URL("../src/lib/learning/analytics-events.ts", import.meta.url), "utf8");
  assert.equal(analytics.includes("primaryBottleneck"), false);
  assert.equal(analytics.includes("CONVERSION_PAGE_READINESS"), false);
  assert.equal(analytics.includes("overallReadiness"), false);
  const toolUi = readFileSync(new URL("../src/components/learning/ConversionPageReadinessTool.tsx", import.meta.url), "utf8");
  assert.match(toolUi, /pré-visualização não cria progresso/i);
  const deploy = readFileSync(new URL("../src/lib/learning/catalog-deploy.ts", import.meta.url), "utf8");
  assert.match(deploy, /seedSitePaginaProntaContent/);
  assert.match(deploy, /publishSitesCourseCatalog/);

  assert.equal(sitesCourseSeed.status, "PUBLISHED");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(isPublicLesson({ status: "DRAFT" }), false);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "FREE" }), true);
  assert.equal(canIndexLesson({ status: "PUBLISHED", accessType: "FREE", publicPreview: "x" }, false), false);
  const sitemap = buildPublicSitemap("https://alexandrefeio.com.br", {
    courses: [{ slug: firstCourseSeed.slug, updatedAt: new Date() }],
    lessons: [{ slug: SITE_LESSON_03_SLUG, updatedAt: new Date(), indexable: false }],
  });
  assert.equal(sitemap.some((entry) => entry.url.includes(SITE_LESSON_03_SLUG)), false);
  assert.equal(firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons).length, 12);
  const lesson3 = sitesCourseSeed.modules[0]!.lessons[2]!;
  assert.equal(lesson3.slug, SITE_LESSON_03_SLUG);
  assert.equal(lesson3.plannedTool, CONVERSION_PAGE_READINESS_TOOL);
  assert.ok(lesson3.publicPreview);
});
