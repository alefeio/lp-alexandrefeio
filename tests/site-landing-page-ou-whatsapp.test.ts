import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assessLesson } from "../src/lib/editorial/readiness";
import { canIndexLesson, canReadLessonBody, isPublicLesson } from "../src/lib/learning/access";
import { parseBlockData } from "../src/lib/learning/blocks";
import {
  DIGITAL_PRESENCE_DECISION_TOOL,
  decideDigitalPresence,
  digitalPresenceDecisionSchema,
  digitalPresenceLocalKey,
  digitalPresenceResponseSchema,
  parseDigitalPresenceForm,
  prefillFromJourneyMap,
} from "../src/lib/learning/digital-presence-decision";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { isBlockComplete } from "../src/lib/learning/progress";
import { SITE_LESSON_01_SLUG } from "../src/lib/learning/site-ajuda-a-vender";
import { SITE_LESSON_02_SLUG, siteLesson02Blocks, siteLesson02Meta } from "../src/lib/learning/site-landing-page-ou-whatsapp";
import { SITES_COURSE_SLUG, sitesCourseSeed } from "../src/lib/learning/sites-course";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";

const baseInputs = {
  offer: "Consultoria contábil",
  numberOfOffers: "ONE" as const,
  explanationNeed: "MEDIUM" as const,
  trustNeed: "MEDIUM" as const,
  trafficSources: ["GOOGLE_ADS" as const],
  primaryAction: "WHATSAPP" as const,
  currentStructure: "NO_STRUCTURE" as const,
  contentNeed: "LOW" as const,
};

test("aula 2 sites definitiva tem 29 blocos, 4 checkpoints e tool", () => {
  assert.equal(siteLesson02Blocks.length, 29);
  assert.equal(new Set(siteLesson02Blocks.map((block) => block.blockKey)).size, 29);
  assert.deepEqual(
    siteLesson02Blocks.map((block) => block.position),
    siteLesson02Blocks.map((_, index) => index + 1),
  );
  for (const block of siteLesson02Blocks) {
    assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  }
  assert.equal(siteLesson02Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 4);
  assert.equal(siteLesson02Blocks.filter((block) => block.data.type === "TOOL").length, 1);
  assert.equal(siteLesson02Blocks.filter((block) => block.data.type === "ACTIVITY").length, 1);
  assert.equal(siteLesson02Blocks.some((block) => block.data.type === "CONCLUSION"), true);
  const tool = siteLesson02Blocks.find((block) => block.blockKey === "tool-estrutura-digital");
  assert.equal(tool?.required, true);
  assert.equal(tool?.data.type, "TOOL");
  if (tool?.data.type === "TOOL") {
    assert.equal(tool.data.toolKey, DIGITAL_PRESENCE_DECISION_TOOL);
    assert.match(tool.data.title, /estrutura digital ideal/i);
  }
  const conclusion = siteLesson02Blocks.find((block) => block.data.type === "CONCLUSION");
  assert.equal(conclusion?.data.type, "CONCLUSION");
  if (conclusion?.data.type === "CONCLUSION") {
    assert.match(conclusion.data.body, /pronta para converter/i);
  }
  const next = siteLesson02Blocks.find((block) => block.blockKey === "proxima-aula-prontidao");
  assert.equal(next?.data.type, "TEXT");
  if (next?.data.type === "TEXT") {
    assert.match(next.data.body, /Aula 3/i);
  }
  assert.equal(siteLesson02Meta.accessType, "FREE");
  assert.equal(siteLesson02Meta.priceCents, null);
  assert.equal(siteLesson02Meta.estimatedMinutes, 25);
  const ready = assessLesson(
    {
      title: siteLesson02Meta.title,
      summary: siteLesson02Meta.summary,
      publicPreview: siteLesson02Meta.publicPreview,
      estimatedMinutes: siteLesson02Meta.estimatedMinutes,
      accessType: "FREE",
      status: "PUBLISHED",
      priceCents: null,
      commerceStatus: "NOT_FOR_SALE",
    },
    siteLesson02Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.deepEqual(ready.issues, []);
  assert.equal(ready.ready, true);
});

test("DIGITAL_PRESENCE_DECISION_V1: landing, institutional, whatsapp, mixed, needs context", () => {
  const landing = decideDigitalPresence({
    ...baseInputs,
    numberOfOffers: "ONE",
    explanationNeed: "MEDIUM",
    trustNeed: "LOW",
    trafficSources: ["GOOGLE_ADS"],
    primaryAction: "FORM_SUBMIT",
    contentNeed: "LOW",
  });
  assert.equal(landing.recommendedStructure, "LANDING_PAGE");
  assert.ok(landing.reasons.length >= 1);
  assert.ok(["STRONG", "MODERATE", "LIMITED"].includes(landing.confidenceLevel));

  const institutional = decideDigitalPresence({
    ...baseInputs,
    numberOfOffers: "MANY",
    explanationNeed: "HIGH",
    trustNeed: "HIGH",
    trafficSources: ["GOOGLE_ORGANIC", "INSTAGRAM"],
    primaryAction: "QUOTE_REQUEST",
    currentStructure: "WEBSITE",
    contentNeed: "HIGH",
  });
  assert.ok(["INSTITUTIONAL_SITE", "MIXED"].includes(institutional.recommendedStructure));
  assert.ok(institutional.secondaryStructures.length <= 3);

  const whatsapp = decideDigitalPresence({
    ...baseInputs,
    numberOfOffers: "ONE",
    explanationNeed: "LOW",
    trustNeed: "LOW",
    trafficSources: ["REFERRAL"],
    primaryAction: "WHATSAPP",
    currentStructure: "WHATSAPP_ONLY",
    contentNeed: "LOW",
  });
  assert.equal(whatsapp.recommendedStructure, "WHATSAPP_FIRST");

  const highTrustBlocksWhatsapp = decideDigitalPresence({
    ...baseInputs,
    numberOfOffers: "ONE",
    explanationNeed: "HIGH",
    trustNeed: "HIGH",
    trafficSources: ["INSTAGRAM"],
    primaryAction: "WHATSAPP",
    contentNeed: "LOW",
  });
  assert.notEqual(highTrustBlocksWhatsapp.recommendedStructure, "WHATSAPP_FIRST");

  const mixed = decideDigitalPresence({
    ...baseInputs,
    numberOfOffers: "FEW",
    explanationNeed: "MEDIUM",
    trustNeed: "HIGH",
    trafficSources: ["GOOGLE_ADS"],
    primaryAction: "WHATSAPP",
    currentStructure: "WEBSITE",
    contentNeed: "MEDIUM",
  });
  assert.ok(["MIXED", "INSTITUTIONAL_SITE", "SERVICE_PAGE"].includes(mixed.recommendedStructure));

  const needs = decideDigitalPresence({
    ...baseInputs,
    numberOfOffers: "UNKNOWN",
    explanationNeed: "UNKNOWN",
    trustNeed: "UNKNOWN",
    trafficSources: ["UNKNOWN"],
  });
  assert.equal(needs.recommendedStructure, "NEEDS_MORE_CONTEXT");
  assert.equal(needs.confidenceLevel, "LIMITED");
});

test("DIGITAL_PRESENCE_DECISION_V1: form, progresso, prefill e chave local", () => {
  const parsed = parseDigitalPresenceForm({
    offer: "Ultrassonografia",
    numberOfOffers: "FEW",
    explanationNeed: "HIGH",
    trustNeed: "HIGH",
    trafficSources: ["GOOGLE_ORGANIC"],
    primaryAction: "BOOKING",
    currentStructure: "WEBSITE",
    contentNeed: "MEDIUM",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(digitalPresenceDecisionSchema.safeParse(parsed.decision).success, true);
  const response = digitalPresenceResponseSchema.parse({ kind: "personal", projectId: null, decision: parsed.decision });
  const toolBlock = {
    blockKey: "tool-estrutura-digital",
    countsForProgress: true,
    required: true,
    retiredAt: null,
    data: siteLesson02Blocks.find((block) => block.blockKey === "tool-estrutura-digital")!.data,
  };
  assert.equal(isBlockComplete(toolBlock, { viewed: true, response }, false), true);
  assert.equal(isBlockComplete(toolBlock, { viewed: true, response: { kind: "personal" } }, false), false);
  assert.equal(digitalPresenceLocalKey(), `af_${SITES_COURSE_SLUG}_${SITE_LESSON_02_SLUG}_digital_presence_decision_v1`);

  const prefill = prefillFromJourneyMap({
    offer: "Cozinhas planejadas",
    trafficSource: "META_ADS",
    trafficSourceOther: null,
    destinationType: "LANDING_PAGE",
    destinationDescription: "Landing da campanha",
    destinationUrl: null,
    primaryAction: "WHATSAPP",
    businessOutcome: "QUOTE",
    currentFriction: "OFFER_UNCLEAR",
    reflection: null,
  });
  assert.equal(prefill.offer, "Cozinhas planejadas");
  assert.deepEqual(prefill.trafficSources, ["META_ADS"]);
  assert.equal(prefill.primaryAction, "WHATSAPP");
});

test("privacidade: analytics/UI admin sem vazamento estratégico; seed wired", () => {
  const analytics = readFileSync(new URL("../src/lib/learning/analytics-events.ts", import.meta.url), "utf8");
  assert.equal(analytics.includes("recommendedStructure"), false);
  assert.equal(analytics.includes("DIGITAL_PRESENCE_DECISION"), false);
  assert.equal(analytics.includes("numberOfOffers"), false);
  const toolUi = readFileSync(new URL("../src/components/learning/DigitalPresenceDecisionTool.tsx", import.meta.url), "utf8");
  assert.match(toolUi, /pré-visualização não cria progresso/i);
  const deploy = readFileSync(new URL("../src/lib/learning/catalog-deploy.ts", import.meta.url), "utf8");
  assert.match(deploy, /seedSiteLandingWhatsappContent/);
  assert.match(deploy, /SITE_LESSON_02_SLUG/);
});

test("curso sites público NFS; aula 2 indexável com corpo; curso 1 intacto", () => {
  assert.equal(sitesCourseSeed.status, "PUBLISHED");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(isPublicLesson({ status: "PUBLISHED" }), true);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "FREE" }), true);
  assert.equal(canIndexLesson({ status: "PUBLISHED", accessType: "FREE", publicPreview: "x" }, true), true);
  assert.equal(canIndexLesson({ status: "PUBLISHED", accessType: "FREE", publicPreview: "x" }, false), false);
  const sitemap = buildPublicSitemap("https://alexandrefeio.com.br", {
    courses: [
      { slug: firstCourseSeed.slug, updatedAt: new Date() },
      { slug: SITES_COURSE_SLUG, updatedAt: new Date() },
    ],
    lessons: [
      { slug: SITE_LESSON_01_SLUG, updatedAt: new Date(), indexable: true },
      { slug: SITE_LESSON_02_SLUG, updatedAt: new Date(), indexable: true },
    ],
  });
  assert.equal(sitemap.some((entry) => entry.url.endsWith(`/cursos/${SITES_COURSE_SLUG}`)), true);
  assert.equal(sitemap.some((entry) => entry.url.endsWith(`/aulas/${SITE_LESSON_02_SLUG}`)), true);
  assert.equal(firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons).length, 12);
  assert.equal(firstCourseSeed.bundlePriceCents, 24990);
  const lesson2Seed = sitesCourseSeed.modules[0]!.lessons[1]!;
  assert.equal(lesson2Seed.slug, SITE_LESSON_02_SLUG);
  assert.equal(lesson2Seed.plannedTool, DIGITAL_PRESENCE_DECISION_TOOL);
  assert.ok(lesson2Seed.publicPreview);
});
