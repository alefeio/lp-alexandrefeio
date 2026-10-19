import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { planLessonEnable } from "../src/lib/commerce/product-activation";
import { isProductForSale } from "../src/lib/commerce/config";
import { assessLesson } from "../src/lib/editorial/readiness";
import { canIndexLesson, canReadLessonBody, visibleBlocks } from "../src/lib/learning/access";
import { lessonAnalyticsPayload } from "../src/lib/learning/analytics-events";
import { parseBlockData } from "../src/lib/learning/blocks";
import type { DestinationPlan } from "../src/lib/learning/destination-plan";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import {
  LEAD_PATHS,
  buildLeadConversionPrefill,
  formatLeadConversionSummary,
  leadConversionPlanSchema,
  leadConversionProjectIdsFrom,
  parseLeadConversionForm,
  type LeadConversionFormInput,
} from "../src/lib/learning/lead-conversion";
import { LESSON_10_SLUG, lesson10Blocks, lesson10Meta } from "../src/lib/learning/lesson-10";
import { parseMetaCampaignForm, type MetaCampaignFormInput } from "../src/lib/learning/meta-campaign";
import { isBlockComplete, type ProgressRuleBlock } from "../src/lib/learning/progress";
import { LESSON_10_PUBLIC_PREVIEW_KEYS, PUBLIC_PREVIEW_TYPES } from "../src/lib/learning/public-preview";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";

const allowedPreview = new Set<string>(PUBLIC_PREVIEW_TYPES);

function set(patch: Partial<LeadConversionFormInput["adSets"][number]> = {}): LeadConversionFormInput["adSets"][number] {
  return {
    name: "Orçamentos em Belém",
    purpose: "Pedir orçamento de móveis planejados",
    location: "Belém e região atendida",
    creativeAngle: "Avaliação do projeto",
    offerMessage: "Móveis planejados sob medida",
    cta: "Solicitar avaliação pelo WhatsApp",
    ...patch,
  };
}

function input(patch: Partial<LeadConversionFormInput> = {}): LeadConversionFormInput {
  return {
    projectId: "projeto-a",
    campaignName: "Meta | Móveis planejados",
    offer: "Móveis planejados sob medida",
    businessGoal: "GENERATE_LEADS",
    leadPath: "WHATSAPP",
    platformObjective: "LEADS",
    conversionLocation: "WHATSAPP",
    performanceGoal: "MAXIMIZE_CONVERSATIONS",
    confirmedAgainstCurrentMetaUi: true,
    destination: "Conversa de orçamento",
    leadDefinition: "Pessoa que pediu orçamento do serviço oferecido",
    qualifiedLeadDefinition: "Está na região atendida e quer orçamento de um ambiente",
    adSets: [set()],
    preservedAdSetCount: 1,
    monthlyBudget: "600",
    whatsappReady: true,
    initialMessage: "Olá! Gostaria de solicitar um orçamento para móveis planejados.",
    qualificationQuestions: ["Qual ambiente você quer planejar?", "Em qual bairro fica a obra?"],
    responseOwner: "Atendimento comercial",
    serviceHours: "Dias úteis, horário comercial",
    followUpPlan: "Retornar no próximo horário de atendimento",
    successDefinition: "Pedido de orçamento com cidade e ambiente",
    formPurpose: "",
    formQuestions: [],
    completionAction: "",
    followUpOwner: "",
    formFollowUpPlan: "",
    privacyNoticeReady: false,
    finalUrl: "",
    conversionEvent: "",
    formOrCta: "",
    measurementStatus: "NOT_SURE",
    businessResultTracking: "",
    pathNote: "",
    source: "Anúncio",
    initialResponse: "Mensagem com o pedido de orçamento",
    qualification: "Cidade e ambiente",
    nextStep: "Agendar medição",
    followUp: "Retorno no horário combinado",
    finalOutcome: "Venda do projeto",
    operationsOwner: "Atendimento comercial",
    serviceWindow: "Dias úteis, horário comercial",
    capacityStatus: "READY",
    followUpMethod: "Retorno na própria conversa",
    measurementStages: ["LEAD", "QUALIFIED_LEAD", "SALE"],
    creativeAngle: "Avaliação do projeto",
    offerMessage: "Móveis planejados sob medida",
    cta: "Solicitar avaliação pelo WhatsApp",
    preLaunchIssue: "",
    actionReviewed: true,
    platformReviewed: true,
    channelReviewed: true,
    qualificationReviewed: true,
    measurementReviewed: true,
    capacityReviewed: true,
    ...patch,
  };
}

function blueprint(offer: string) {
  const form: MetaCampaignFormInput = {
    projectId: "projeto-a",
    campaignName: "Meta | Móveis",
    offer,
    businessGoal: "GENERATE_LEADS",
    businessGoalDetail: "Pedidos de orçamento",
    desiredConversion: "Pedido de orçamento no WhatsApp",
    metaObjective: "LEADS",
    conversionPath: "MESSAGING",
    destination: "WhatsApp de orçamento",
    monthlyBudget: "600",
    budgetStrategy: "CAMPAIGN_LEVEL",
    adSets: [{
      name: "Região atendida",
      purpose: "Orçamentos locais",
      audienceApproaches: ["AUTOMATED_BROAD"],
      location: "Belém e região atendida",
      minimumAge: "",
      ageNotes: "",
      language: "",
      audienceSuggestions: [],
      customAudienceStrategy: "",
      lookalikeStrategy: "",
      exclusions: [],
      placementStrategy: "ADVANTAGE_PLUS",
      manualPlacementReason: "",
      surfaces: [],
      optimizationIntent: "Pedido de orçamento",
      budgetAllocation: "",
    }],
    preLaunchIssue: "",
    representsOffer: true,
    audienceLogicReviewed: true,
    placementsAndBudgetReviewed: true,
    claimsReviewed: true,
  };
  const parsed = parseMetaCampaignForm(form, { measurementReadiness: "READY" });
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.plan;
}

const destination: DestinationPlan = {
  destinationType: "WHATSAPP",
  primaryCta: "Chamar no WhatsApp",
  primaryConversion: "Pedido de orçamento",
  destinationChecks: { offerIsClear: true, ctaIsVisible: true, mobileChecked: true, conversionPathTested: true },
  trafficSourceMethod: "ASK_AT_SERVICE",
  platformConversionStatus: "NOT_CONFIGURED",
  analyticsStatus: "NOT_APPLICABLE",
  businessOutcomeMethod: "SPREADSHEET",
  readinessStatus: "NEEDS_PREPARATION",
};

test("aula 10 definitiva permanece paga e fora de venda", () => {
  assert.equal(lesson10Blocks.length >= 36 && lesson10Blocks.length <= 40, true);
  assert.equal(new Set(lesson10Blocks.map((block) => block.blockKey)).size, lesson10Blocks.length);
  assert.deepEqual(lesson10Blocks.map((block) => block.position), lesson10Blocks.map((_, index) => index + 1));
  for (const block of lesson10Blocks) assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  const tool = lesson10Blocks.find((block) => block.data.type === "TOOL");
  assert.equal(tool?.data.type === "TOOL" && tool.data.toolKey, "META_LEAD_CONVERSION_PLAN_V1");
  assert.equal(tool?.data.type === "TOOL" && tool.data.title, "Plano de geração e atendimento de leads");
  assert.equal(lesson10Meta.accessType, "PAID");
  assert.equal(lesson10Meta.priceCents, 3990);
  assert.equal(lesson10Meta.commerceStatus, "NOT_FOR_SALE");
  assert.equal(isProductForSale("NOT_FOR_SALE", 3990, true), false);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }), false);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }, { entitled: true }), true);
  assert.equal(visibleBlocks({ status: "PUBLISHED", accessType: "PAID" }, lesson10Blocks).length, 0);
  const lesson = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons).find((item) => item.slug === LESSON_10_SLUG);
  assert.equal(lesson?.blocks.length, lesson10Blocks.length);
  assert.equal(lesson?.priceCents, 3990);
  const blocked = planLessonEnable({
    slug: LESSON_10_SLUG,
    title: lesson10Meta.title,
    status: "PUBLISHED",
    accessType: "PAID",
    priceCents: 3990,
    commerceStatus: "NOT_FOR_SALE",
    publicPreview: lesson10Meta.publicPreview,
    contentReady: true,
    contentIssues: [],
    hasPublicPreviewBlocks: true,
  });
  assert.equal(blocked.allowed, false);
  const ready = assessLesson(
    {
      title: lesson10Meta.title,
      summary: lesson10Meta.summary,
      publicPreview: lesson10Meta.publicPreview,
      estimatedMinutes: lesson10Meta.estimatedMinutes,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: 3990,
      commerceStatus: "NOT_FOR_SALE",
    },
    lesson10Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.deepEqual(ready.issues, []);
  for (const key of LESSON_10_PUBLIC_PREVIEW_KEYS) {
    const block = lesson10Blocks.find((item) => item.blockKey === key);
    assert.ok(block);
    assert.equal(allowedPreview.has(block.data.type), true, key);
  }
  const previewKeys = LESSON_10_PUBLIC_PREVIEW_KEYS as readonly string[];
  assert.equal(previewKeys.includes("plano-de-leads"), false);
  assert.equal(previewKeys.includes("checkpoint-lead"), false);
  const published = { status: "PUBLISHED" as const, accessType: "PAID" as const, publicPreview: lesson10Meta.publicPreview };
  assert.equal(canIndexLesson(published, true, false), false);
  assert.equal(canIndexLesson(published, true, true), true);
  const sitemap = buildPublicSitemap("https://alexandrefeio.com.br", {
    courses: [],
    lessons: [{ slug: LESSON_10_SLUG, updatedAt: new Date("2026-10-19"), indexable: true }],
  });
  assert.equal(sitemap.some((entry) => entry.url.endsWith(`/aulas/${LESSON_10_SLUG}`)), true);
  assert.deepEqual([...LEAD_PATHS], ["WHATSAPP", "INSTANT_FORM", "WEBSITE", "OTHER_MESSAGING", "OTHER"]);
  const lessonText = lesson10Blocks.map((block) => JSON.stringify(block.data)).join(" ");
  assert.match(lessonText, /Message destinations/);
  assert.match(lessonText, /Maximize number of conversations/);
  assert.match(lessonText, /não existe um objetivo universal/i);
});

test("plano de leads separa caminho, configuração, qualificação e operação", () => {
  const ready = parseLeadConversionForm(input());
  assert.equal(ready.ok, true);
  if (!ready.ok) return;
  assert.equal(ready.plan.readinessStatus, "READY_TO_LAUNCH_LEAD_FLOW");
  assert.equal(ready.plan.platformObjective, "LEADS");
  assert.equal(ready.plan.conversionLocation, "WHATSAPP");
  assert.equal(ready.plan.performanceGoal, "MAXIMIZE_CONVERSATIONS");
  assert.equal(ready.plan.businessGoal, "GENERATE_LEADS");
  assert.notEqual(ready.plan.businessGoal, ready.plan.platformObjective);
  assert.equal(leadConversionPlanSchema.safeParse(ready.plan).success, true);
  assert.match(formatLeadConversionSummary(ready.plan).join(" "), /Pronto para configurar|WhatsApp|Lead qualificado/);

  const closed = parseLeadConversionForm(input({ whatsappReady: false }));
  assert.equal(closed.ok && closed.plan.readinessStatus, "NEEDS_PREPARATION");
  const generic = parseLeadConversionForm(input({ initialMessage: "Oi" }));
  assert.equal(generic.ok && generic.plan.readinessStatus, "NEEDS_PREPARATION");
  const many = parseLeadConversionForm(input({
    qualificationQuestions: ["1", "2", "3", "4", "5", "6"].map((item) => `Pergunta ${item} do atendimento`),
  }));
  assert.equal(many.ok && many.plan.readinessStatus, "NEEDS_PREPARATION");
  const unconfirmed = parseLeadConversionForm(input({ confirmedAgainstCurrentMetaUi: false, performanceGoal: "UNCONFIRMED" }));
  assert.equal(unconfirmed.ok && unconfirmed.plan.readinessStatus, "NEEDS_PREPARATION");
  const capacity = parseLeadConversionForm(input({ capacityStatus: "NOT_READY" }));
  assert.equal(capacity.ok && capacity.plan.readinessStatus, "NEEDS_PREPARATION");
  const pending = parseLeadConversionForm(input({ preLaunchIssue: "A conta do WhatsApp ainda não foi conectada." }));
  assert.equal(pending.ok && pending.plan.readinessStatus, "NEEDS_PREPARATION");
  const noMeasure = parseLeadConversionForm(input({ measurementStages: [] }));
  assert.equal(noMeasure.ok && noMeasure.plan.readinessStatus, "NEEDS_PREPARATION");

  const form = parseLeadConversionForm(input({
    leadPath: "INSTANT_FORM",
    conversionLocation: "INSTANT_FORM",
    performanceGoal: "QUALITY_LEADS",
    whatsappReady: false,
    initialMessage: "",
    qualificationQuestions: [],
    formPurpose: "Separar pedidos de orçamento",
    formQuestions: ["Qual ambiente você quer planejar?"],
    completionAction: "Página de agradecimento com o próximo passo",
    followUpOwner: "Atendimento comercial",
    formFollowUpPlan: "Ligar no horário comercial",
    privacyNoticeReady: true,
  }));
  assert.equal(form.ok && form.plan.readinessStatus, "READY_TO_LAUNCH_LEAD_FLOW");
  const formGap = parseLeadConversionForm(input({
    leadPath: "INSTANT_FORM",
    conversionLocation: "INSTANT_FORM",
    whatsappReady: false,
    initialMessage: "",
    qualificationQuestions: [],
    formPurpose: "Separar pedidos de orçamento",
    formQuestions: ["Qual ambiente você quer planejar?"],
    completionAction: "Agradecer",
    followUpOwner: "",
    formFollowUpPlan: "",
    privacyNoticeReady: true,
  }));
  assert.equal(formGap.ok && formGap.plan.readinessStatus, "NEEDS_PREPARATION");

  const site = parseLeadConversionForm(input({
    leadPath: "WEBSITE",
    platformObjective: "LEADS",
    conversionLocation: "WEBSITE",
    performanceGoal: "LEADS",
    whatsappReady: false,
    initialMessage: "",
    qualificationQuestions: [],
    finalUrl: "https://example.com/orcamento",
    conversionEvent: "Envio do formulário de orçamento",
    formOrCta: "Pedir orçamento",
    measurementStatus: "CONFIGURED",
    businessResultTracking: "SPREADSHEET",
  }));
  assert.equal(site.ok && site.plan.readinessStatus, "READY_TO_LAUNCH_LEAD_FLOW");
  const siteGap = parseLeadConversionForm(input({
    leadPath: "WEBSITE",
    conversionLocation: "WEBSITE",
    whatsappReady: false,
    initialMessage: "",
    qualificationQuestions: [],
    finalUrl: "",
    conversionEvent: "",
    formOrCta: "",
    measurementStatus: "NOT_CONFIGURED",
  }));
  assert.equal(siteGap.ok && siteGap.plan.readinessStatus, "NEEDS_PREPARATION");
  const script = parseLeadConversionForm(input({ leadPath: "WEBSITE", finalUrl: "javascript:alert(1)" }));
  assert.equal(script.ok, false);

  const leaked = parseLeadConversionForm(input({ initialMessage: "Escreva para cliente@exemplo.com" }));
  assert.equal(leaked.ok, false);

  const toolBlock = lesson10Blocks.find((block) => block.blockKey === "plano-de-leads");
  const rule = toolBlock ? ({ ...toolBlock, retiredAt: null } as ProgressRuleBlock) : null;
  assert.ok(rule);
  if (rule) {
    const answer = { viewed: true, response: { projectId: "projeto-a" } };
    assert.equal(isBlockComplete(rule, answer, false, new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set(["projeto-a"])), true);
    assert.equal(isBlockComplete(rule, answer, false), false);
  }
});

test("prefill da aula 9 e da aula 5 fica no mesmo projeto", () => {
  const own = buildLeadConversionPrefill({
    projectOffer: "Oferta do projeto A",
    brief: null,
    destination,
    blueprint: blueprint("Móveis do projeto A"),
    channelHint: "google",
    operationsAttention: true,
    saved: null,
  });
  const other = buildLeadConversionPrefill({
    projectOffer: "Oferta do projeto B",
    brief: null,
    destination: null,
    blueprint: null,
    channelHint: null,
    operationsAttention: false,
    saved: null,
  });
  assert.equal(own.offer, "Móveis do projeto A");
  assert.equal(own.leadPath, "WHATSAPP");
  assert.equal(own.platformObjective, "LEADS");
  assert.equal(own.monthlyBudgetCents, 60000);
  assert.equal(own.preservedAdSetCount, 1);
  assert.equal(own.adSets[0]?.location, "Belém e região atendida");
  assert.equal(own.hasDestination, true);
  assert.equal(own.businessResultTracking, "SPREADSHEET");
  assert.equal(own.measurementStatus, "NOT_CONFIGURED");
  assert.equal(own.channelHint, "google");
  assert.equal(own.operationsAttention, true);
  assert.equal(other.offer, "Oferta do projeto B");
  assert.equal(other.hasBlueprint, false);
  assert.equal(other.leadPath, "");
  assert.equal(other.monthlyBudgetCents, null);
  assert.equal(leadConversionProjectIdsFrom([{ projectId: "projeto-b", payload: { offer: own.offer } }]).size, 0);
});

test("texto do plano de leads não entra em analytics nem no preview público", () => {
  const payload = lessonAnalyticsPayload({ lessonSlug: LESSON_10_SLUG, courseSlug: "trafego-pago-na-pratica", accessType: "PAID" });
  assert.deepEqual(Object.keys(payload).sort(), ["access_type", "course_slug", "lesson_slug"]);
  const tool = readFileSync("src/components/learning/LeadConversionTool.tsx", "utf8");
  const plan = readFileSync("src/lib/learning/lead-conversion-plan.ts", "utf8");
  assert.equal(tool.includes("trackEvent"), false);
  assert.equal(plan.includes("trackEvent"), false);
  const preview = readFileSync("src/app/(admin)/admin/aulas/[id]/preview/page.tsx", "utf8");
  assert.equal(preview.includes("leadConversionPreviewState"), true);
  assert.equal(preview.includes("ViewEvent"), false);
});
