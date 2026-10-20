import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assessLesson } from "../src/lib/editorial/readiness";
import { canIndexLesson, canReadLessonBody, isPublicLesson } from "../src/lib/learning/access";
import { parseBlockData } from "../src/lib/learning/blocks";
import {
  BUSINESS_OUTCOMES,
  CONVERSION_JOURNEY_MAP_TOOL,
  TRAFFIC_SOURCES,
  conversionJourneyLocalKey,
  conversionJourneyMapSchema,
  journeyMapNotices,
  journeyMapResponseSchema,
  parseConversionJourneyMapForm,
} from "../src/lib/learning/conversion-journey-map";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { isBlockComplete } from "../src/lib/learning/progress";
import { SITE_LESSON_01_SLUG, siteLesson01Blocks, siteLesson01Meta } from "../src/lib/learning/site-ajuda-a-vender";
import { SITES_COURSE_SLUG, sitesCourseSeed } from "../src/lib/learning/sites-course";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";

const sampleMap = {
  offer: "Consultoria contábil",
  trafficSource: "GOOGLE_ORGANIC" as const,
  trafficSourceOther: null,
  destinationType: "SERVICE_PAGE" as const,
  destinationDescription: "Página de serviços",
  destinationUrl: null,
  primaryAction: "QUOTE_REQUEST" as const,
  businessOutcome: "QUOTE" as const,
  currentFriction: "CTA_UNCLEAR" as const,
  reflection: null,
};

test("aula 1 sites definitiva tem 28 blocos, 4 checkpoints e tool", () => {
  assert.equal(siteLesson01Blocks.length, 28);
  assert.equal(new Set(siteLesson01Blocks.map((block) => block.blockKey)).size, 28);
  assert.deepEqual(
    siteLesson01Blocks.map((block) => block.position),
    siteLesson01Blocks.map((_, index) => index + 1),
  );
  for (const block of siteLesson01Blocks) {
    assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  }
  assert.equal(siteLesson01Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 4);
  assert.equal(siteLesson01Blocks.filter((block) => block.data.type === "TOOL").length, 1);
  const tool = siteLesson01Blocks.find((block) => block.blockKey === "tool-mapa-conversao");
  assert.equal(tool?.required, true);
  assert.equal(tool?.data.type, "TOOL");
  if (tool?.data.type === "TOOL") {
    assert.equal(tool.data.toolKey, CONVERSION_JOURNEY_MAP_TOOL);
    assert.match(tool.data.title, /mapa de conversão/i);
  }
  assert.equal(siteLesson01Blocks.some((block) => block.data.type === "CONCLUSION"), true);
  assert.equal(siteLesson01Blocks.some((block) => block.data.type === "ACTIVITY"), true);
  const conclusion = siteLesson01Blocks.find((block) => block.data.type === "CONCLUSION");
  assert.equal(conclusion?.data.type, "CONCLUSION");
  if (conclusion?.data.type === "CONCLUSION") {
    assert.match(conclusion.data.body, /Site, landing page ou WhatsApp/);
  }
  assert.equal(siteLesson01Meta.accessType, "FREE");
  assert.equal(siteLesson01Meta.priceCents, null);
  assert.equal(siteLesson01Meta.estimatedMinutes, 25);
  const ready = assessLesson(
    {
      title: siteLesson01Meta.title,
      summary: siteLesson01Meta.summary,
      publicPreview: siteLesson01Meta.publicPreview,
      estimatedMinutes: siteLesson01Meta.estimatedMinutes,
      accessType: "FREE",
      status: "PUBLISHED",
      priceCents: null,
      commerceStatus: "NOT_FOR_SALE",
    },
    siteLesson01Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.deepEqual(ready.issues, []);
  assert.equal(ready.ready, true);
});

test("CONVERSION_JOURNEY_MAP_V1 valida mapa, notices e progresso", () => {
  assert.equal(conversionJourneyMapSchema.safeParse(sampleMap).success, true);
  assert.equal(TRAFFIC_SOURCES.includes("UNKNOWN"), true);
  assert.equal(BUSINESS_OUTCOMES.includes("AWARENESS"), true);
  const unknown = conversionJourneyMapSchema.parse({ ...sampleMap, trafficSource: "UNKNOWN", destinationType: "UNKNOWN" });
  const notices = journeyMapNotices(unknown);
  assert.equal(notices.some((item) => item.code === "unknown_source"), true);
  assert.equal(notices.some((item) => item.code === "unknown_destination"), true);
  const parsed = parseConversionJourneyMapForm({
    offer: "Curso online",
    trafficSource: "OTHER",
    trafficSourceOther: "QR Code na loja",
    destinationType: "LANDING_PAGE",
    destinationDescription: "Landing da oferta",
    primaryAction: "SIGN_UP",
    businessOutcome: "REGISTRATION",
  });
  assert.equal(parsed.ok, true);
  const response = journeyMapResponseSchema.parse({ kind: "personal", projectId: null, map: sampleMap });
  const toolBlock = {
    blockKey: "tool-mapa-conversao",
    countsForProgress: true,
    required: true,
    retiredAt: null,
    data: siteLesson01Blocks.find((block) => block.blockKey === "tool-mapa-conversao")!.data,
  };
  assert.equal(isBlockComplete(toolBlock, { viewed: true, response }, false), true);
  assert.equal(isBlockComplete(toolBlock, { viewed: true, response: { kind: "personal" } }, false), false);
  assert.equal(conversionJourneyLocalKey(), `af_${SITES_COURSE_SLUG}_${SITE_LESSON_01_SLUG}_conversion_journey_map_v1`);
});

test("URL opcional e OTHER exige texto; analytics/seed não vazam oferta", () => {
  const badOther = parseConversionJourneyMapForm({
    offer: "Serviço",
    trafficSource: "OTHER",
    destinationType: "HOME",
    destinationDescription: "Home",
    primaryAction: "CONTACT",
    businessOutcome: "LEAD",
  });
  assert.equal(badOther.ok, false);
  const withUrl = parseConversionJourneyMapForm({
    offer: "Serviço",
    trafficSource: "DIRECT",
    destinationType: "HOME",
    destinationDescription: "Home",
    destinationUrl: "https://exemplo.com/servico",
    primaryAction: "WHATSAPP",
    businessOutcome: "LEAD",
  });
  assert.equal(withUrl.ok, true);
  const analytics = readFileSync(new URL("../src/lib/learning/analytics-events.ts", import.meta.url), "utf8");
  assert.equal(analytics.includes("destinationUrl"), false);
  assert.equal(analytics.includes("currentFriction"), false);
  const toolUi = readFileSync(new URL("../src/components/learning/ConversionJourneyMapTool.tsx", import.meta.url), "utf8");
  assert.match(toolUi, /pré-visualização não cria progresso/i);
});

test("curso sites permanece fora do catálogo/sitemap; curso 1 intacto", () => {
  assert.equal(sitesCourseSeed.status, "DRAFT");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(isPublicLesson({ status: "DRAFT" }), false);
  assert.equal(canIndexLesson({ status: "PUBLISHED", accessType: "FREE", publicPreview: "x" }, true), true);
  assert.equal(canIndexLesson({ status: "DRAFT", accessType: "FREE", publicPreview: "x" }, true), false);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "FREE" }), true);
  const sitemap = buildPublicSitemap("https://alexandrefeio.com.br", {
    courses: [{ slug: firstCourseSeed.slug, updatedAt: new Date() }],
    lessons: [{ slug: SITE_LESSON_01_SLUG, updatedAt: new Date(), indexable: false }],
  });
  assert.equal(sitemap.some((entry) => entry.url.includes(SITES_COURSE_SLUG)), false);
  assert.equal(sitemap.some((entry) => entry.url.includes(SITE_LESSON_01_SLUG)), false);
  assert.equal(firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons).length, 12);
  assert.equal(firstCourseSeed.bundlePriceCents, 24990);
  const deploy = readFileSync(new URL("../src/lib/learning/catalog-deploy.ts", import.meta.url), "utf8");
  assert.match(deploy, /seedSiteAjudaAVenderContent/);
  assert.match(deploy, /deploySitesCourseScaffold/);
});
