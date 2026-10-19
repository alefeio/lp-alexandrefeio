import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isProductForSale } from "../src/lib/commerce/config";
import { planLessonEnable, planModuleEnable } from "../src/lib/commerce/product-activation";
import { assessLesson } from "../src/lib/editorial/readiness";
import { canIndexLesson, canReadLessonBody, visibleBlocks } from "../src/lib/learning/access";
import { lessonAnalyticsPayload } from "../src/lib/learning/analytics-events";
import { parseBlockData } from "../src/lib/learning/blocks";
import { paidLessonAction } from "../src/lib/commerce/sale-action";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import {
  buildKeywordPrefill,
  keywordPlanReadiness,
  keywordProjectIdsFrom,
  normalizeKeywordText,
  parseKeywordPlanForm,
  type KeywordPlanFormInput,
} from "../src/lib/learning/keyword-intent";
import { LESSON_07_SLUG, LESSON_08_SLUG, lesson07Blocks, lesson07Meta } from "../src/lib/learning/lesson-07";
import { isBlockComplete, type ProgressRuleBlock } from "../src/lib/learning/progress";
import { LESSON_07_PUBLIC_PREVIEW_KEYS, PUBLIC_PREVIEW_TYPES } from "../src/lib/learning/public-preview";
import { parseSearchBlueprintForm, type SearchBlueprintFormInput } from "../src/lib/learning/search-blueprint";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";

const allowedPreview = new Set<string>(PUBLIC_PREVIEW_TYPES);
const required = [
  "checkpoint-intencao",
  "checkpoint-grupo",
  "checkpoint-correspondencia",
  "atividade-busca-que-nao-paga",
  "checklist-antes-da-lista",
  "plano-palavras-chave",
  "checkpoint-lista-curta",
];

const keyword = (text: string, matchType: "BROAD" | "PHRASE" | "EXACT", intent: "HIGH" | "MEDIUM" | "LOW" | "EXCLUDE", decision: "USE" | "TEST_LATER" | "EXCLUDE") => ({
  text,
  matchType,
  intent,
  decision,
});

function planInput(patch: Partial<KeywordPlanFormInput> = {}): KeywordPlanFormInput {
  return {
    projectId: "projeto-a",
    campaignName: "Pesquisa | Consultoria trabalhista",
    offer: "Consultoria trabalhista",
    groups: [
      {
        name: "Rescisão",
        theme: "rescisão trabalhista",
        keywords: [
          keyword("advogado trabalhista", "PHRASE", "HIGH", "USE"),
          keyword("advogado trabalhista em belém", "EXACT", "HIGH", "USE"),
          keyword("advogado para rescisão trabalhista", "BROAD", "MEDIUM", "TEST_LATER"),
        ],
      },
    ],
    negativeKeywords: [{ text: "vaga", scope: "CAMPAIGN" }],
    preLaunchIssue: "",
    reviewed: true,
    ...patch,
  };
}

function blueprintInput(projectId: string, offer: string): SearchBlueprintFormInput {
  return {
    projectId,
    campaignName: `Pesquisa | ${offer}`,
    offer,
    businessObjective: "LEADS",
    primaryConversion: "Envio do formulário de contato.",
    destinationType: "LANDING_PAGE",
    destinationUrl: "https://escritorio.example/contato",
    locationPlan: "Pessoas em Belém.",
    languagePlan: "Português",
    monthlyBudget: "600",
    optimizationFocus: "CONVERSIONS",
    brandStrategy: "UNDECIDED",
    searchPartnersDecision: "UNDECIDED",
    adGroups: [{ name: "Rescisão", theme: "rescisão trabalhista", intent: "Quem procura contratar ajuda para a rescisão." }],
    preLaunchIssue: "",
  };
}

test("aula 7 definitiva permanece paga, publicada no conteúdo e fora de venda", () => {
  assert.equal(lesson07Blocks.length >= 32 && lesson07Blocks.length <= 36, true);
  assert.equal(lesson07Blocks.length, 34);
  assert.equal(new Set(lesson07Blocks.map((block) => block.blockKey)).size, lesson07Blocks.length);
  assert.deepEqual(
    lesson07Blocks.map((block) => block.position),
    lesson07Blocks.map((_, index) => index + 1),
  );
  for (const block of lesson07Blocks) assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  const tools = lesson07Blocks.filter((block) => block.data.type === "TOOL");
  assert.equal(tools.length, 1);
  assert.equal(tools[0]?.data.type === "TOOL" && tools[0].data.toolKey, "KEYWORD_INTENT_PLAN_V1");
  assert.equal(tools[0]?.data.type === "TOOL" && tools[0].data.title, "Plano inicial de palavras-chave");
  assert.equal(lesson07Blocks.some((block) => block.data.type === "CONCLUSION"), true);
  assert.equal(lesson07Blocks.filter((block) => block.data.type === "HEADING").every((block) => !block.countsForProgress), true);
  for (const key of required) assert.equal(lesson07Blocks.find((block) => block.blockKey === key)?.required, true);
  const conclusion = lesson07Blocks.find((block) => block.blockKey === "conclusao-lista-curta");
  assert.equal(
    conclusion?.data.type === "CONCLUSION" && conclusion.data.body,
    "Uma boa lista de palavras-chave não tenta alcançar todo mundo. Ela ajuda sua campanha a aparecer para buscas que combinam com aquilo que você realmente oferece.",
  );
  assert.equal(lesson07Meta.accessType, "PAID");
  assert.equal(lesson07Meta.priceCents, 3990);
  assert.equal(lesson07Meta.commerceStatus, "NOT_FOR_SALE");
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }), false);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }, { entitled: true }), true);
  assert.equal(visibleBlocks({ status: "PUBLISHED", accessType: "PAID" }, lesson07Blocks).length, 0);
  const lessons = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons);
  const lesson = lessons.find((item) => item.slug === LESSON_07_SLUG);
  assert.equal(lesson?.blocks.length, lesson07Blocks.length);
  assert.equal(lesson?.priceCents, 3990);
  assert.equal(lessons.find((item) => item.slug === LESSON_08_SLUG)?.blocks.length, 0);
  assert.equal(isProductForSale("NOT_FOR_SALE", 3990, true), false);
  assert.equal(paidLessonAction({ open: false, owned: false }), "soon");
  const blocked = planLessonEnable({
    slug: LESSON_07_SLUG,
    title: lesson07Meta.title,
    status: "PUBLISHED",
    accessType: "PAID",
    priceCents: 3990,
    commerceStatus: "NOT_FOR_SALE",
    publicPreview: lesson07Meta.publicPreview,
    contentReady: true,
    contentIssues: [],
    hasPublicPreviewBlocks: true,
  });
  assert.equal(blocked.allowed, false);
  const moduleBlocked = planModuleEnable({
    slug: "google-ads-na-pratica",
    title: "Google Ads na prática",
    priceCents: 10390,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    lessons: [],
  });
  assert.equal(moduleBlocked.allowed, false);
  const ready = assessLesson(
    {
      title: lesson07Meta.title,
      summary: lesson07Meta.summary,
      publicPreview: lesson07Meta.publicPreview,
      estimatedMinutes: lesson07Meta.estimatedMinutes,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: 3990,
      commerceStatus: "NOT_FOR_SALE",
    },
    lesson07Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.deepEqual(ready.issues, []);
  const source = readFileSync(new URL("../src/lib/learning/lesson-07.ts", import.meta.url), "utf8");
  assert.equal(source.includes("Broad Match Modifier"), false);
  assert.equal(source.includes("+palavra"), false);
});

test("preview público da aula 7 ensina e não expõe ferramenta nem exercício", () => {
  for (const key of LESSON_07_PUBLIC_PREVIEW_KEYS) {
    const block = lesson07Blocks.find((item) => item.blockKey === key);
    assert.ok(block, key);
    assert.equal(allowedPreview.has(block.data.type), true, key);
  }
  const previewKeys = LESSON_07_PUBLIC_PREVIEW_KEYS as readonly string[];
  assert.equal(previewKeys.includes("checkpoint-intencao"), false);
  assert.equal(previewKeys.includes("plano-palavras-chave"), false);
  assert.equal(previewKeys.includes("atividade-busca-que-nao-paga"), false);
  const published = { status: "PUBLISHED" as const, accessType: "PAID" as const, publicPreview: lesson07Meta.publicPreview };
  assert.equal(canIndexLesson(published, true, false), false);
  assert.equal(canIndexLesson(published, true, true), true);
  assert.equal(canIndexLesson({ ...published, status: "DRAFT" }, true, true), false);
  const sitemap = buildPublicSitemap("https://alexandrefeio.com.br", {
    courses: [],
    lessons: [{ slug: LESSON_07_SLUG, updatedAt: new Date("2026-10-19"), indexable: true }],
  });
  assert.equal(sitemap.some((entry) => entry.url.endsWith(`/aulas/${LESSON_07_SLUG}`)), true);
  const hidden = buildPublicSitemap("https://alexandrefeio.com.br", {
    courses: [],
    lessons: [{ slug: LESSON_07_SLUG, updatedAt: new Date("2026-10-19"), indexable: false }],
  });
  assert.equal(hidden.some((entry) => entry.url.includes(LESSON_07_SLUG)), false);
});

test("plano de palavras classifica intenção, correspondência e prontidão", () => {
  const readyPlan = parseKeywordPlanForm(planInput());
  assert.equal(readyPlan.ok, true);
  if (!readyPlan.ok) return;
  assert.equal(readyPlan.plan.readinessStatus, "READY_FOR_ADS");
  assert.equal(readyPlan.plan.groups[0]?.keywords[0]?.matchType, "PHRASE");
  assert.equal(readyPlan.plan.groups[0]?.keywords[1]?.matchType, "EXACT");
  assert.equal(readyPlan.plan.groups[0]?.keywords[2]?.matchType, "BROAD");
  assert.equal(readyPlan.plan.groups[0]?.keywords[0]?.intent, "HIGH");
  assert.equal(readyPlan.plan.groups[0]?.keywords[0]?.decision, "USE");
  assert.equal(readyPlan.projectId, "projeto-a");
  assert.equal(keywordProjectIdsFrom([{ projectId: "projeto-a", payload: readyPlan.plan }]).has("projeto-a"), true);
  assert.equal(keywordProjectIdsFrom([{ projectId: "projeto-b", payload: { offer: "outro" } }]).size, 0);

  const refine = parseKeywordPlanForm(planInput({ reviewed: false, preLaunchIssue: "Ainda não sei se a região entra na busca." }));
  assert.equal(refine.ok, true);
  if (refine.ok) assert.equal(refine.plan.readinessStatus, "NEEDS_REFINEMENT");

  const forced = parseKeywordPlanForm({ ...planInput({ reviewed: false }), readinessStatus: "READY_FOR_ADS" } as KeywordPlanFormInput);
  assert.equal(forced.ok, true);
  if (forced.ok) assert.equal(forced.plan.readinessStatus, "NEEDS_REFINEMENT");

  const emptyGroup = parseKeywordPlanForm(
    planInput({
      groups: [{ name: "Rescisão", theme: "rescisão trabalhista", keywords: [] }],
    }),
  );
  assert.equal(emptyGroup.ok, true);
  if (emptyGroup.ok) assert.equal(emptyGroup.plan.readinessStatus, "NEEDS_REFINEMENT");

  const duplicate = keywordPlanReadiness({
    ...readyPlan.plan,
    groups: [
      {
        name: "Rescisão",
        theme: "rescisão trabalhista",
        keywords: [keyword("Advogado Trabalhista", "PHRASE", "HIGH", "USE"), keyword("advogado trabalhista", "EXACT", "HIGH", "USE")],
      },
    ],
  });
  assert.equal(duplicate.status, "NEEDS_REFINEMENT");
  assert.equal(normalizeKeywordText("curso google ads") === normalizeKeywordText("curso de google ads"), false);

  const distinct = parseKeywordPlanForm(
    planInput({
      offer: "Curso de tráfego pago",
      groups: [
        {
          name: "Curso",
          theme: "curso de tráfego pago",
          keywords: [keyword("curso google ads", "PHRASE", "HIGH", "USE"), keyword("curso de google ads", "EXACT", "HIGH", "USE")],
        },
      ],
    }),
  );
  assert.equal(distinct.ok, true);
  if (distinct.ok) assert.equal(distinct.plan.readinessStatus, "READY_FOR_ADS");

  const generic = keywordPlanReadiness({
    ...readyPlan.plan,
    groups: [{ name: "Rescisão", theme: "rescisão trabalhista", keywords: [keyword("curso", "BROAD", "LOW", "USE")] }],
  });
  assert.match(generic.issues.join(" "), /genérica/);

  const both = keywordPlanReadiness({
    ...readyPlan.plan,
    groups: [
      {
        name: "Rescisão",
        theme: "rescisão trabalhista",
        keywords: [keyword("advogado trabalhista", "PHRASE", "EXCLUDE", "USE"), keyword("advogado trabalhista", "PHRASE", "HIGH", "EXCLUDE")],
      },
    ],
  });
  assert.equal(both.status, "NEEDS_REFINEMENT");

  const negativeClash = keywordPlanReadiness({
    ...readyPlan.plan,
    negativeKeywords: [{ text: "advogado trabalhista", scope: "CAMPAIGN" }],
  });
  assert.match(negativeClash.issues.join(" "), /negativa/);

  const tool = lesson07Blocks.find((block) => block.blockKey === "plano-palavras-chave");
  const rule = tool ? ({ ...tool, retiredAt: null } as ProgressRuleBlock) : null;
  assert.ok(rule);
  if (rule) {
    const answer = { viewed: true, response: { projectId: "projeto-a" } };
    assert.equal(isBlockComplete(rule, answer, false, new Set(), new Set(), new Set(), new Set()), false);
    assert.equal(isBlockComplete(rule, answer, false, new Set(), new Set(), new Set(), new Set(["projeto-a"])), true);
  }
});

test("prefill da aula 6 fica no mesmo projeto", () => {
  const parsedA = parseSearchBlueprintForm(blueprintInput("projeto-a", "Consultoria trabalhista"));
  const parsedB = parseSearchBlueprintForm(blueprintInput("projeto-b", "Curso de tráfego pago"));
  assert.equal(parsedA.ok && parsedB.ok, true);
  if (!parsedA.ok || !parsedB.ok) return;
  const prefillA = buildKeywordPrefill({ projectOffer: "Consultoria trabalhista", blueprint: parsedA.blueprint, saved: null });
  const prefillB = buildKeywordPrefill({ projectOffer: "Curso de tráfego pago", blueprint: null, saved: null });
  assert.equal(prefillA.fromBlueprint, true);
  assert.equal(prefillA.campaignName, parsedA.blueprint.campaignName);
  assert.equal(prefillA.offer, "Consultoria trabalhista");
  assert.equal(prefillA.objective, "LEADS");
  assert.equal(prefillA.conversion, "Envio do formulário de contato.");
  assert.equal(prefillA.groups[0]?.name, "Rescisão");
  assert.equal(prefillA.groups[0]?.sourceIntent.includes("rescisão"), true);
  assert.equal(prefillA.groups[0]?.keywords.length, 0);
  assert.equal(prefillB.fromBlueprint, false);
  assert.equal(prefillB.offer, "Curso de tráfego pago");
  assert.equal(prefillB.campaignName.includes("Consultoria"), false);
  assert.equal(prefillB.groups.some((group) => group.name === "Rescisão"), false);
  const saved = parseKeywordPlanForm(planInput());
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const again = buildKeywordPrefill({ projectOffer: "outra oferta", blueprint: parsedB.blueprint, saved: saved.plan });
  assert.equal(again.offer, saved.plan.offer);
  assert.equal(again.campaignName.includes("Curso de tráfego pago"), false);
});

test("dados da lista não entram em analytics, preview administrativo nem venda", () => {
  const tool = readFileSync(new URL("../src/components/learning/KeywordIntentTool.tsx", import.meta.url), "utf8");
  const plan = readFileSync(new URL("../src/lib/learning/keyword-plan.ts", import.meta.url), "utf8");
  const preview = readFileSync(new URL("../src/app/(admin)/admin/aulas/[id]/preview/page.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/app/(learn)/aulas/[slug]/page.tsx", import.meta.url), "utf8");
  assert.equal(tool.includes("trackEvent"), false);
  assert.equal(tool.includes("dataLayer"), false);
  assert.equal(plan.includes("trackEvent"), false);
  assert.match(plan, /payload: \{ projectId: project\.id \}/);
  assert.match(preview, /keywordIntentPreviewState/);
  assert.equal(preview.includes("ViewEvent"), false);
  assert.match(page, /KEYWORD_INTENT_PLAN_V1/);
  assert.match(page, /PublicLessonArticle/);
  const payload = lessonAnalyticsPayload({ lessonSlug: LESSON_07_SLUG, courseSlug: "trafego-pago-na-pratica", accessType: "PAID" });
  assert.deepEqual(Object.keys(payload).sort(), ["access_type", "course_slug", "lesson_slug"]);
  assert.equal(JSON.stringify(payload).includes("advogado"), false);
  const sales = readFileSync(new URL("../src/components/course/CourseSales.tsx", import.meta.url), "utf8");
  assert.match(sales, /Disponível em breve/);
  assert.match(sales, /Ler a parte gratuita/);
  assert.match(sales, /hasPublicPreview/);
});
