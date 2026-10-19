import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { planLessonEnable } from "../src/lib/commerce/product-activation";
import { isProductForSale } from "../src/lib/commerce/config";
import { assessLesson } from "../src/lib/editorial/readiness";
import { canIndexLesson, canReadLessonBody, visibleBlocks } from "../src/lib/learning/access";
import { lessonAnalyticsPayload } from "../src/lib/learning/analytics-events";
import { parseBlockData } from "../src/lib/learning/blocks";
import { parseCampaignBriefForm } from "../src/lib/learning/campaign-brief";
import { parseDestinationPlanForm } from "../src/lib/learning/destination-plan";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { LESSON_09_SLUG, lesson09Blocks, lesson09Meta } from "../src/lib/learning/lesson-09";
import {
  META_OBJECTIVES,
  buildMetaCampaignPrefill,
  measurementFromDestination,
  metaCampaignPlanSchema,
  metaCampaignProjectIdsFrom,
  parseMetaCampaignForm,
  type MetaCampaignFormInput,
} from "../src/lib/learning/meta-campaign";
import { isBlockComplete, type ProgressRuleBlock } from "../src/lib/learning/progress";
import { LESSON_09_PUBLIC_PREVIEW_KEYS, PUBLIC_PREVIEW_TYPES } from "../src/lib/learning/public-preview";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";

const allowedPreview = new Set<string>(PUBLIC_PREVIEW_TYPES);

function set(patch: Partial<MetaCampaignFormInput["adSets"][number]> = {}): MetaCampaignFormInput["adSets"][number] {
  return {
    name: "Orçamentos em Belém",
    purpose: "Pedir orçamento de móveis planejados",
    audienceApproaches: ["AUTOMATED_BROAD"],
    location: "Belém e região atendida",
    minimumAge: "18",
    ageNotes: "Não atendo menores.",
    language: "Português",
    audienceSuggestions: ["decoração"],
    customAudienceStrategy: "",
    lookalikeStrategy: "",
    exclusions: [],
    placementStrategy: "ADVANTAGE_PLUS",
    manualPlacementReason: "",
    surfaces: ["FEED", "STORIES", "REELS"],
    optimizationIntent: "Pedido de orçamento",
    budgetAllocation: "",
    ...patch,
  };
}

function input(patch: Partial<MetaCampaignFormInput> = {}): MetaCampaignFormInput {
  return {
    projectId: "projeto-a",
    campaignName: "Meta | Móveis planejados",
    offer: "Móveis planejados sob medida",
    businessGoal: "GENERATE_LEADS",
    businessGoalDetail: "Pedidos de orçamento",
    desiredConversion: "Pedido de orçamento registrado",
    metaObjective: "LEADS",
    conversionPath: "WEBSITE",
    destination: "Página de orçamento",
    monthlyBudget: "600",
    budgetStrategy: "CAMPAIGN_LEVEL",
    adSets: [set()],
    preLaunchIssue: "",
    representsOffer: true,
    audienceLogicReviewed: true,
    placementsAndBudgetReviewed: true,
    claimsReviewed: true,
    ...patch,
  };
}

test("aula 9 definitiva permanece paga e fora de venda", () => {
  assert.equal(lesson09Blocks.length >= 34 && lesson09Blocks.length <= 38, true);
  assert.equal(new Set(lesson09Blocks.map((block) => block.blockKey)).size, lesson09Blocks.length);
  assert.deepEqual(lesson09Blocks.map((block) => block.position), lesson09Blocks.map((_, index) => index + 1));
  for (const block of lesson09Blocks) assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  const tool = lesson09Blocks.find((block) => block.data.type === "TOOL");
  assert.equal(tool?.data.type === "TOOL" && tool.data.toolKey, "META_CAMPAIGN_BLUEPRINT_V1");
  assert.equal(tool?.data.type === "TOOL" && tool.data.title, "Plano inicial de campanha Meta");
  assert.equal(lesson09Meta.accessType, "PAID");
  assert.equal(lesson09Meta.priceCents, 3990);
  assert.equal(lesson09Meta.commerceStatus, "NOT_FOR_SALE");
  assert.equal(isProductForSale("NOT_FOR_SALE", 3990, true), false);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }), false);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }, { entitled: true }), true);
  assert.equal(visibleBlocks({ status: "PUBLISHED", accessType: "PAID" }, lesson09Blocks).length, 0);
  const lesson = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons).find((item) => item.slug === LESSON_09_SLUG);
  assert.equal(lesson?.blocks.length, lesson09Blocks.length);
  assert.equal(lesson?.priceCents, 3990);
  const blocked = planLessonEnable({
    slug: LESSON_09_SLUG,
    title: lesson09Meta.title,
    status: "PUBLISHED",
    accessType: "PAID",
    priceCents: 3990,
    commerceStatus: "NOT_FOR_SALE",
    publicPreview: lesson09Meta.publicPreview,
    contentReady: true,
    contentIssues: [],
    hasPublicPreviewBlocks: true,
  });
  assert.equal(blocked.allowed, false);
  const ready = assessLesson(
    {
      title: lesson09Meta.title,
      summary: lesson09Meta.summary,
      publicPreview: lesson09Meta.publicPreview,
      estimatedMinutes: lesson09Meta.estimatedMinutes,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: 3990,
      commerceStatus: "NOT_FOR_SALE",
    },
    lesson09Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.deepEqual(ready.issues, []);
  for (const key of LESSON_09_PUBLIC_PREVIEW_KEYS) {
    const block = lesson09Blocks.find((item) => item.blockKey === key);
    assert.ok(block);
    assert.equal(allowedPreview.has(block.data.type), true, key);
  }
  const previewKeys = LESSON_09_PUBLIC_PREVIEW_KEYS as readonly string[];
  assert.equal(previewKeys.includes("plano-inicial-meta"), false);
  assert.equal(previewKeys.includes("checkpoint-objetivo"), false);
  const published = { status: "PUBLISHED" as const, accessType: "PAID" as const, publicPreview: lesson09Meta.publicPreview };
  assert.equal(canIndexLesson(published, true, false), false);
  assert.equal(canIndexLesson(published, true, true), true);
  const sitemap = buildPublicSitemap("https://alexandrefeio.com.br", {
    courses: [],
    lessons: [{ slug: LESSON_09_SLUG, updatedAt: new Date("2026-10-19"), indexable: true }],
  });
  assert.equal(sitemap.some((entry) => entry.url.endsWith(`/aulas/${LESSON_09_SLUG}`)), true);
  assert.deepEqual([...META_OBJECTIVES], ["AWARENESS", "TRAFFIC", "ENGAGEMENT", "LEADS", "APP_PROMOTION", "SALES"]);
});

test("plano Meta separa objetivo, público, posicionamento e orçamento", () => {
  const ready = parseMetaCampaignForm(input(), { measurementReadiness: "READY" });
  assert.equal(ready.ok, true);
  if (!ready.ok) return;
  assert.equal(ready.plan.readinessStatus, "READY_FOR_META_SETUP");
  assert.equal(ready.plan.businessGoal, "GENERATE_LEADS");
  assert.equal(ready.plan.metaObjective, "LEADS");
  assert.equal(ready.plan.conversionPath, "WEBSITE");
  assert.equal(ready.plan.adSets[0]?.location, "Belém e região atendida");
  assert.equal(ready.plan.adSets[0]?.audienceSuggestions[0], "decoração");
  assert.equal(ready.plan.budgetStrategy, "CAMPAIGN_LEVEL");
  assert.equal(metaCampaignPlanSchema.safeParse(ready.plan).success, true);

  const forced = parseMetaCampaignForm({ ...input(), representsOffer: false }, { measurementReadiness: "READY" });
  assert.equal(forced.ok && forced.plan.readinessStatus, "NEEDS_PREPARATION");

  const traffic = parseMetaCampaignForm(input({ metaObjective: "TRAFFIC", businessGoal: "GENERATE_SALES", desiredConversion: "Compra no site" }), { measurementReadiness: "READY" });
  assert.equal(traffic.ok && traffic.plan.readinessStatus, "NEEDS_PREPARATION");
  const manual = parseMetaCampaignForm(input({ adSets: [set({ placementStrategy: "MANUAL", manualPlacementReason: "" })] }), { measurementReadiness: "READY" });
  assert.equal(manual.ok && manual.plan.readinessStatus, "NEEDS_PREPARATION");
  const justified = parseMetaCampaignForm(input({ adSets: [set({ placementStrategy: "MANUAL", manualPlacementReason: "O único arquivo é horizontal." })] }), { measurementReadiness: "READY" });
  assert.equal(justified.ok && justified.plan.readinessStatus, "READY_FOR_META_SETUP");
  const lookalike = parseMetaCampaignForm(input({ adSets: [set({ audienceApproaches: ["LOOKALIKE"], lookalikeStrategy: "" })] }), { measurementReadiness: "READY" });
  assert.equal(lookalike.ok && lookalike.plan.readinessStatus, "NEEDS_PREPARATION");
  const custom = parseMetaCampaignForm(input({ adSets: [set({ audienceApproaches: ["FIRST_PARTY"], customAudienceStrategy: "Visitantes do site, sem enviar a lista." })] }), { measurementReadiness: "READY" });
  assert.equal(custom.ok && custom.plan.readinessStatus, "READY_FOR_META_SETUP");
  const split = parseMetaCampaignForm(input({ adSets: [set(), set({ name: "Dois" }), set({ name: "Três" }), set({ name: "Quatro" })] }), { measurementReadiness: "READY" });
  assert.equal(split.ok && split.plan.readinessStatus, "NEEDS_PREPARATION");
  const measured = parseMetaCampaignForm(input(), { measurementReadiness: "NEEDS_WORK" });
  assert.equal(measured.ok && measured.plan.readinessStatus, "NEEDS_PREPARATION");
  assert.equal(parseMetaCampaignForm(input({ destination: "javascript:alert(1)" })).ok, false);
  assert.equal(parseMetaCampaignForm(input({ offer: "cliente@exemplo.com" })).ok, false);
  assert.equal(parseMetaCampaignForm(input({ adSets: [set({ audienceSuggestions: Array.from({ length: 11 }, (_, index) => `sinal ${index}`) })] })).ok, false);

  const tool = lesson09Blocks.find((block) => block.blockKey === "plano-inicial-meta");
  const rule = tool ? ({ ...tool, retiredAt: null } as ProgressRuleBlock) : null;
  assert.ok(rule);
  if (rule) {
    const answer = { viewed: true, response: { projectId: "projeto-a" } };
    assert.equal(isBlockComplete(rule, answer, false), false);
    assert.equal(isBlockComplete(rule, answer, false, new Set(), new Set(), new Set(), new Set(), new Set(), new Set(["projeto-a"])), true);
    assert.equal(metaCampaignProjectIdsFrom([{ projectId: "projeto-a", payload: ready.plan }]).has("projeto-a"), true);
  }
});

test("prefill da aula 4, da aula 5 e do diagnóstico fica no mesmo projeto", () => {
  const briefA = parseCampaignBriefForm({
    projectId: "projeto-a",
    offer: "Móveis planejados",
    objective: "LEADS",
    primaryConversion: "Pedido de orçamento",
    destination: "LANDING_PAGE",
    monthlyBudget: "600",
    initialObservationDays: 14,
    validationBeforeLaunch: "A página mostra o pedido de orçamento.",
  });
  const briefB = parseCampaignBriefForm({
    projectId: "projeto-b",
    offer: "Curso de tráfego pago",
    objective: "SALES",
    primaryConversion: "Matrícula",
    destination: "WEBSITE",
    monthlyBudget: "900",
    initialObservationDays: 14,
    validationBeforeLaunch: "A página mostra a matrícula.",
  });
  const destination = parseDestinationPlanForm({
    projectId: "projeto-a",
    destinationType: "LANDING_PAGE",
    destinationUrl: "https://moveis.example/orcamento",
    primaryCta: "Pedir orçamento",
    primaryConversion: "Pedido de orçamento",
    offerIsClear: true,
    ctaIsVisible: true,
    mobileChecked: true,
    conversionPathTested: true,
    trafficSourceMethod: "PLATFORM",
    platformConversionStatus: "CONFIGURED",
    analyticsStatus: "CONFIGURED",
    businessOutcomeMethod: "SPREADSHEET",
    preLaunchIssue: "",
  });
  const blockedDestination = parseDestinationPlanForm({
    projectId: "projeto-a",
    destinationType: "LANDING_PAGE",
    destinationUrl: "https://moveis.example/orcamento",
    primaryCta: "Pedir orçamento",
    primaryConversion: "Pedido de orçamento",
    offerIsClear: false,
    ctaIsVisible: false,
    mobileChecked: false,
    conversionPathTested: false,
    trafficSourceMethod: "PLATFORM",
    platformConversionStatus: "NOT_CONFIGURED",
    analyticsStatus: "NOT_CONFIGURED",
    businessOutcomeMethod: "NONE",
    preLaunchIssue: "O evento ainda não dispara.",
  });
  assert.equal(briefA.ok && briefB.ok && destination.ok && blockedDestination.ok, true);
  if (!briefA.ok || !briefB.ok || !destination.ok || !blockedDestination.ok) return;
  const prefillA = buildMetaCampaignPrefill({
    projectOffer: "Móveis planejados",
    projectArea: "Belém",
    brief: briefA.brief,
    destination: destination.plan,
    channelHint: "google",
    saved: null,
  });
  const prefillB = buildMetaCampaignPrefill({
    projectOffer: "Curso de tráfego pago",
    projectArea: "Brasil",
    brief: briefB.brief,
    destination: null,
    channelHint: "meta",
    saved: null,
  });
  const alone = buildMetaCampaignPrefill({
    projectOffer: "",
    projectArea: null,
    brief: null,
    destination: null,
    channelHint: null,
    saved: null,
  });
  assert.equal(prefillA.offer, "Móveis planejados");
  assert.equal(prefillA.businessGoal, "GENERATE_LEADS");
  assert.equal(prefillA.desiredConversion, "Pedido de orçamento");
  assert.equal(prefillA.monthlyBudgetCents, 60000);
  assert.equal(prefillA.destination.includes("moveis.example"), true);
  assert.equal(prefillA.channelHint, "google");
  assert.equal(prefillA.hasBrief, true);
  assert.equal(prefillA.hasDestination, true);
  assert.equal(prefillB.offer, "Curso de tráfego pago");
  assert.equal(prefillB.offer.includes("Móveis"), false);
  assert.equal(prefillB.channelHint, "meta");
  assert.equal(alone.hasBrief, false);
  assert.equal(alone.hasDiagnostic, false);
  assert.equal(alone.offer, "");
  assert.equal(measurementFromDestination(blockedDestination.plan), "NEEDS_WORK");
  assert.equal(measurementFromDestination(null), "UNKNOWN");
});

test("texto do plano Meta não entra em analytics nem no preview público", () => {
  const payload = lessonAnalyticsPayload({ lessonSlug: LESSON_09_SLUG, courseSlug: "trafego-pago-na-pratica", accessType: "PAID" });
  assert.deepEqual(Object.keys(payload).sort(), ["access_type", "course_slug", "lesson_slug"]);
  const tool = readFileSync(new URL("../src/components/learning/MetaCampaignTool.tsx", import.meta.url), "utf8");
  const plan = readFileSync(new URL("../src/lib/learning/meta-campaign.ts", import.meta.url), "utf8");
  assert.equal(tool.includes("trackEvent"), false);
  assert.equal(plan.includes("trackEvent"), false);
  const admin = readFileSync(new URL("../src/app/(admin)/admin/aulas/[id]/preview/page.tsx", import.meta.url), "utf8");
  assert.equal(admin.includes("metaCampaignPreviewState"), true);
  assert.equal(admin.includes("ViewEvent"), false);
  const lesson = readFileSync(new URL("../src/lib/learning/lesson-09.ts", import.meta.url), "utf8");
  assert.equal(lesson.includes("CBO"), true);
  assert.equal(lesson.includes("Advantage+ campaign budget"), true);
});
