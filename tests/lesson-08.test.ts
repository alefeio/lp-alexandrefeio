import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isProductForSale } from "../src/lib/commerce/config";
import { planLessonEnable, planModuleEnable } from "../src/lib/commerce/product-activation";
import { assessLesson } from "../src/lib/editorial/readiness";
import { canIndexLesson, canReadLessonBody, visibleBlocks } from "../src/lib/learning/access";
import { lessonAnalyticsPayload } from "../src/lib/learning/analytics-events";
import { parseBlockData } from "../src/lib/learning/blocks";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { parseKeywordPlanForm, type KeywordPlanFormInput } from "../src/lib/learning/keyword-intent";
import { LESSON_08_SLUG, lesson08Blocks, lesson08Meta } from "../src/lib/learning/lesson-08";
import { isBlockComplete, type ProgressRuleBlock } from "../src/lib/learning/progress";
import { LESSON_08_PUBLIC_PREVIEW_KEYS, PUBLIC_PREVIEW_TYPES } from "../src/lib/learning/public-preview";
import {
  RSA_LIMITS,
  buildResponsiveAdPrefill,
  parseResponsiveAdForm,
  rsaUnits,
  type ResponsiveAdFormInput,
} from "../src/lib/learning/responsive-search-ad";
import { parseSearchBlueprintForm, type SearchBlueprintFormInput } from "../src/lib/learning/search-blueprint";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";

const allowedPreview = new Set<string>(PUBLIC_PREVIEW_TYPES);

function headline(text: string, category: ResponsiveAdFormInput["groups"][number]["headlines"][number]["category"] = "OFFER") {
  return { text, category };
}

function adInput(patch: Partial<ResponsiveAdFormInput> = {}): ResponsiveAdFormInput {
  return {
    projectId: "projeto-a",
    campaignName: "Pesquisa | Consultoria trabalhista",
    offer: "Consultoria trabalhista",
    conversion: "Envio do formulário de contato.",
    destination: "LANDING_PAGE https://escritorio.example/contato",
    groups: [
      {
        name: "Rescisão",
        theme: "rescisão trabalhista",
        primaryIntent: "contratar advogado trabalhista",
        keywordsContext: ["advogado trabalhista"],
        negativeContext: [],
        finalUrl: "https://escritorio.example/contato",
        path1: "contato",
        path2: "belem",
        cta: "Solicitar contato",
        headlines: [
          headline("Advogado trabalhista", "KEYWORD"),
          headline("Consultoria trabalhista", "OFFER"),
          headline("Fale sobre a rescisão", "CTA"),
        ],
        descriptions: [
          { text: "Orientação sobre rescisão trabalhista, com o próximo passo no formulário de contato.", category: "VALUE" },
          { text: "Você envia o formulário e combina o contato com o escritório.", category: "CTA" },
        ],
        pinning: [],
        preLaunchIssue: "",
      },
    ],
    offerAccurate: true,
    destinationMatchesPromise: true,
    claimsReviewed: true,
    ctaMatchesConversion: true,
    ...patch,
  };
}

function blueprint(projectId: string, offer: string): SearchBlueprintFormInput {
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
    adGroups: [{ name: "Rescisão", theme: "rescisão trabalhista", intent: "Quem quer contratar ajuda para a rescisão." }],
    preLaunchIssue: "",
  };
}

test("limites do anúncio responsivo seguem o formato atual", () => {
  assert.equal(RSA_LIMITS.headlineMin, 3);
  assert.equal(RSA_LIMITS.headlineMax, 15);
  assert.equal(RSA_LIMITS.headlineUnits, 30);
  assert.equal(RSA_LIMITS.descriptionMin, 2);
  assert.equal(RSA_LIMITS.descriptionMax, 4);
  assert.equal(RSA_LIMITS.descriptionUnits, 90);
  assert.equal(RSA_LIMITS.pathUnits, 15);
  assert.equal(rsaUnits("a".repeat(30)), 30);
  assert.equal(rsaUnits("字"), 2);
});

test("aula 8 definitiva permanece paga e fora de venda", () => {
  assert.equal(lesson08Blocks.length >= 32 && lesson08Blocks.length <= 36, true);
  assert.equal(new Set(lesson08Blocks.map((block) => block.blockKey)).size, lesson08Blocks.length);
  assert.deepEqual(
    lesson08Blocks.map((block) => block.position),
    lesson08Blocks.map((_, index) => index + 1),
  );
  for (const block of lesson08Blocks) assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  const tool = lesson08Blocks.find((block) => block.data.type === "TOOL");
  assert.equal(tool?.data.type === "TOOL" && tool.data.toolKey, "RESPONSIVE_SEARCH_AD_PLAN_V1");
  assert.equal(tool?.data.type === "TOOL" && tool.data.title, "Plano de anúncios responsivos");
  const conclusion = lesson08Blocks.find((block) => block.blockKey === "conclusao-anuncio-alinhado");
  assert.equal(conclusion?.data.type === "CONCLUSION", true);
  assert.equal(lesson08Meta.accessType, "PAID");
  assert.equal(lesson08Meta.priceCents, 3490);
  assert.equal(lesson08Meta.commerceStatus, "NOT_FOR_SALE");
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }), false);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }, { entitled: true }), true);
  assert.equal(visibleBlocks({ status: "PUBLISHED", accessType: "PAID" }, lesson08Blocks).length, 0);
  const lesson = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons).find((item) => item.slug === LESSON_08_SLUG);
  assert.equal(lesson?.blocks.length, lesson08Blocks.length);
  assert.equal(lesson?.priceCents, 3490);
  assert.equal(isProductForSale("NOT_FOR_SALE", 3490, true), false);
  const blocked = planLessonEnable({
    slug: LESSON_08_SLUG,
    title: lesson08Meta.title,
    status: "PUBLISHED",
    accessType: "PAID",
    priceCents: 3490,
    commerceStatus: "NOT_FOR_SALE",
    publicPreview: lesson08Meta.publicPreview,
    contentReady: true,
    contentIssues: [],
    hasPublicPreviewBlocks: true,
  });
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason ?? "", /allowlist/);
  const moduleBlocked = planModuleEnable({
    slug: "google-ads-na-pratica",
    title: "Google Ads na prática",
    priceCents: 10390,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    lessons: [],
  });
  assert.equal(moduleBlocked.allowed, false);
  assert.match(moduleBlocked.reason ?? "", /allowlist/);
  const ready = assessLesson(
    {
      title: lesson08Meta.title,
      summary: lesson08Meta.summary,
      publicPreview: lesson08Meta.publicPreview,
      estimatedMinutes: lesson08Meta.estimatedMinutes,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: 3490,
      commerceStatus: "NOT_FOR_SALE",
    },
    lesson08Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.deepEqual(ready.issues, []);
  for (const key of LESSON_08_PUBLIC_PREVIEW_KEYS) {
    const block = lesson08Blocks.find((item) => item.blockKey === key);
    assert.ok(block);
    assert.equal(allowedPreview.has(block.data.type), true, key);
  }
  const previewKeys = LESSON_08_PUBLIC_PREVIEW_KEYS as readonly string[];
  assert.equal(previewKeys.includes("plano-anuncios-responsivos"), false);
  assert.equal(previewKeys.includes("checkpoint-combinacao"), false);
  const published = { status: "PUBLISHED" as const, accessType: "PAID" as const, publicPreview: lesson08Meta.publicPreview };
  assert.equal(canIndexLesson(published, true, false), false);
  assert.equal(canIndexLesson(published, true, true), true);
  const sitemap = buildPublicSitemap("https://alexandrefeio.com.br", {
    courses: [],
    lessons: [{ slug: LESSON_08_SLUG, updatedAt: new Date("2026-10-19"), indexable: true }],
  });
  assert.equal(sitemap.some((entry) => entry.url.endsWith(`/aulas/${LESSON_08_SLUG}`)), true);
});

test("plano de anúncios valida limites, pinning e prontidão", () => {
  const ready = parseResponsiveAdForm(adInput());
  assert.equal(ready.ok, true);
  if (!ready.ok) return;
  assert.equal(ready.plan.readinessStatus, "READY_TO_BUILD");
  assert.equal(ready.plan.groups[0]?.headlines[0]?.text, "Advogado trabalhista");
  assert.equal(ready.projectId, "projeto-a");

  const forced = parseResponsiveAdForm({ ...adInput({ claimsReviewed: false }), readinessStatus: "READY_TO_BUILD" } as ResponsiveAdFormInput);
  assert.equal(forced.ok, true);
  if (forced.ok) assert.equal(forced.plan.readinessStatus, "NEEDS_REFINEMENT");

  const short = parseResponsiveAdForm(adInput({ groups: [{ ...adInput().groups[0]!, headlines: adInput().groups[0]!.headlines.slice(0, 2) }] }));
  assert.equal(short.ok, true);
  if (short.ok) assert.equal(short.plan.readinessStatus, "NEEDS_REFINEMENT");

  const longHeadline = adInput();
  longHeadline.groups[0]!.headlines[0] = headline("x".repeat(31));
  const over = parseResponsiveAdForm(longHeadline);
  assert.equal(over.ok, true);
  if (over.ok) {
    assert.equal(over.plan.readinessStatus, "NEEDS_REFINEMENT");
    assert.equal(over.plan.groups[0]?.headlines[0]?.text.length, 31);
  }

  const many = adInput();
  many.groups[0]!.headlines = Array.from({ length: 16 }, (_, index) => headline(`Consultoria trabalhista ${index} alfa`));
  assert.equal(parseResponsiveAdForm(many).ok, false);
  many.groups[0]!.headlines = Array.from({ length: 15 }, (_, index) => headline(`Angulo trabalhista ${index} alfaunico`));
  assert.equal(parseResponsiveAdForm(many).ok, true);

  const descriptions = adInput();
  descriptions.groups[0]!.descriptions = Array.from({ length: 5 }, (_, index) => ({ text: `Descricao trabalhista numero ${index} com contato no formulario.` }));
  assert.equal(parseResponsiveAdForm(descriptions).ok, false);
  descriptions.groups[0]!.descriptions = descriptions.groups[0]!.descriptions.slice(0, 4);
  assert.equal(parseResponsiveAdForm(descriptions).ok, true);
  descriptions.groups[0]!.descriptions[0] = { text: "y".repeat(91) };
  const longDescription = parseResponsiveAdForm(descriptions);
  assert.equal(longDescription.ok, true);
  if (longDescription.ok) assert.equal(longDescription.plan.groups[0]?.descriptions[0]?.text.length, 91);

  const path = adInput();
  path.groups[0]!.path1 = "google-ads-curso";
  const longPath = parseResponsiveAdForm(path);
  assert.equal(longPath.ok, true);
  if (longPath.ok) assert.equal(longPath.plan.readinessStatus, "NEEDS_REFINEMENT");
  path.groups[0]!.path1 = "";
  path.groups[0]!.path2 = "belem";
  const missingPath = parseResponsiveAdForm(path);
  assert.equal(missingPath.ok, true);
  if (missingPath.ok) assert.match(missingPath.plan.readinessStatus, /NEEDS_REFINEMENT/);

  const duplicate = adInput();
  duplicate.groups[0]!.headlines[1] = headline("advogado trabalhista", "OFFER");
  const repeated = parseResponsiveAdForm(duplicate);
  assert.equal(repeated.ok, true);
  if (repeated.ok) assert.match(repeated.plan.readinessStatus, /NEEDS_REFINEMENT/);

  const pinned = parseResponsiveAdForm(adInput({ groups: [{ ...adInput().groups[0]!, pinning: [{ assetType: "HEADLINE", assetIndex: 0, position: 1 }] }] }));
  assert.equal(pinned.ok, true);
  if (pinned.ok) {
    assert.equal(pinned.plan.readinessStatus, "READY_TO_BUILD");
    assert.equal(pinned.plan.groups[0]?.pinning[0]?.position, 1);
  }
  const allPinned = parseResponsiveAdForm(
    adInput({
      groups: [
        {
          ...adInput().groups[0]!,
          pinning: [
            { assetType: "HEADLINE", assetIndex: 0, position: 1 },
            { assetType: "HEADLINE", assetIndex: 1, position: 2 },
            { assetType: "HEADLINE", assetIndex: 2, position: 3 },
          ],
        },
      ],
    }),
  );
  assert.equal(allPinned.ok, true);
  if (allPinned.ok) assert.equal(allPinned.plan.readinessStatus, "NEEDS_REFINEMENT");

  const weak = adInput();
  weak.groups[0]!.cta = "Saiba mais";
  weak.ctaMatchesConversion = true;
  const cta = parseResponsiveAdForm(weak);
  assert.equal(cta.ok, true);
  if (cta.ok) assert.equal(cta.plan.readinessStatus, "NEEDS_REFINEMENT");

  const discount = adInput();
  discount.groups[0]!.headlines[1] = headline("Desconto na consulta");
  const price = parseResponsiveAdForm(discount);
  assert.equal(price.ok, true);
  if (price.ok) assert.equal(price.plan.readinessStatus, "NEEDS_REFINEMENT");

  const noUrl = adInput();
  noUrl.groups[0]!.finalUrl = "";
  noUrl.destination = "";
  const missingUrl = parseResponsiveAdForm(noUrl);
  assert.equal(missingUrl.ok, true);
  if (missingUrl.ok) assert.equal(missingUrl.plan.readinessStatus, "NEEDS_REFINEMENT");
  assert.equal(parseResponsiveAdForm(adInput({ groups: [{ ...adInput().groups[0]!, finalUrl: "javascript:alert(1)" }] })).ok, false);

  const tool = lesson08Blocks.find((block) => block.blockKey === "plano-anuncios-responsivos");
  const rule = tool ? ({ ...tool, retiredAt: null } as ProgressRuleBlock) : null;
  assert.ok(rule);
  if (rule) {
    const answer = { viewed: true, response: { projectId: "projeto-a" } };
    assert.equal(isBlockComplete(rule, answer, false, new Set(), new Set(), new Set(), new Set(), new Set()), false);
    assert.equal(isBlockComplete(rule, answer, false, new Set(), new Set(), new Set(), new Set(), new Set(["projeto-a"])), true);
  }
});

test("prefill da campanha e das palavras fica no mesmo projeto", () => {
  const parsedA = parseSearchBlueprintForm(blueprint("projeto-a", "Consultoria trabalhista"));
  const parsedB = parseSearchBlueprintForm(blueprint("projeto-b", "Curso de tráfego pago"));
  const keywords: KeywordPlanFormInput = {
    projectId: "projeto-a",
    campaignName: "Pesquisa | Consultoria trabalhista",
    offer: "Consultoria trabalhista",
    groups: [
      {
        name: "Rescisão",
        theme: "rescisão trabalhista",
        keywords: [
          { text: "advogado trabalhista", matchType: "PHRASE", intent: "HIGH", decision: "USE" },
          { text: "vaga de advogado", matchType: "PHRASE", intent: "EXCLUDE", decision: "EXCLUDE" },
        ],
      },
    ],
    negativeKeywords: [{ text: "vaga", scope: "CAMPAIGN" }],
    preLaunchIssue: "",
    reviewed: true,
  };
  const keywordPlan = parseKeywordPlanForm(keywords);
  assert.equal(parsedA.ok && parsedB.ok && keywordPlan.ok, true);
  if (!parsedA.ok || !parsedB.ok || !keywordPlan.ok) return;
  const prefillA = buildResponsiveAdPrefill({
    projectOffer: "Consultoria trabalhista",
    blueprint: parsedA.blueprint,
    keywordPlan: keywordPlan.plan,
    saved: null,
  });
  const prefillB = buildResponsiveAdPrefill({
    projectOffer: "Curso de tráfego pago",
    blueprint: parsedB.blueprint,
    keywordPlan: null,
    saved: null,
  });
  assert.equal(prefillA.fromBlueprint, true);
  assert.equal(prefillA.fromKeywordPlan, true);
  assert.equal(prefillA.offer, "Consultoria trabalhista");
  assert.equal(prefillA.conversion, "Envio do formulário de contato.");
  assert.equal(prefillA.groups[0]?.finalUrl, "https://escritorio.example/contato");
  assert.deepEqual(prefillA.groups[0]?.keywordsContext, ["advogado trabalhista"]);
  assert.equal(prefillA.groups[0]?.keywordsContext.includes("vaga de advogado"), false);
  assert.equal(prefillA.groups[0]?.negativeContext.includes("vaga"), true);
  assert.equal(prefillB.offer, "Curso de tráfego pago");
  assert.equal(prefillB.fromKeywordPlan, false);
  assert.equal(prefillB.groups[0]?.keywordsContext.length, 0);
  assert.equal(prefillB.campaignName.includes("Consultoria"), false);

  const saved = parseResponsiveAdForm(adInput());
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const again = buildResponsiveAdPrefill({
    projectOffer: "Curso de tráfego pago",
    blueprint: parsedB.blueprint,
    keywordPlan: null,
    saved: saved.plan,
  });
  assert.equal(again.offer, "Consultoria trabalhista");
  assert.equal(again.campaignName.includes("Curso de tráfego pago"), false);

  const withoutKeywords = parseResponsiveAdForm(adInput(), { keywordPlan: keywordPlan.plan });
  assert.equal(withoutKeywords.ok, true);
  if (withoutKeywords.ok) {
    assert.deepEqual(withoutKeywords.plan.groups[0]?.keywordsContext, ["advogado trabalhista"]);
    assert.equal(withoutKeywords.plan.usesKeywordPlan, true);
  }
  const emptyUse = parseKeywordPlanForm({
    ...keywords,
    groups: [{ name: "Rescisão", theme: "rescisão trabalhista", keywords: [{ text: "vaga de advogado", matchType: "PHRASE", intent: "EXCLUDE", decision: "EXCLUDE" }] }],
  });
  assert.equal(emptyUse.ok, true);
  if (emptyUse.ok) {
    const missingUse = parseResponsiveAdForm(adInput(), { keywordPlan: emptyUse.plan });
    assert.equal(missingUse.ok, true);
    if (missingUse.ok) assert.equal(missingUse.plan.readinessStatus, "NEEDS_REFINEMENT");
  }
});

test("texto do anúncio não entra em analytics nem no preview público", () => {
  const tool = readFileSync(new URL("../src/components/learning/ResponsiveSearchAdTool.tsx", import.meta.url), "utf8");
  const plan = readFileSync(new URL("../src/lib/learning/responsive-ad-plan.ts", import.meta.url), "utf8");
  const preview = readFileSync(new URL("../src/app/(admin)/admin/aulas/[id]/preview/page.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/app/(learn)/aulas/[slug]/page.tsx", import.meta.url), "utf8");
  assert.equal(tool.includes("trackEvent"), false);
  assert.equal(tool.includes("dataLayer"), false);
  assert.equal(plan.includes("trackEvent"), false);
  assert.match(plan, /payload: \{ projectId: project\.id \}/);
  assert.match(preview, /responsiveAdPreviewState/);
  assert.equal(preview.includes("ViewEvent"), false);
  assert.match(page, /RESPONSIVE_SEARCH_AD_PLAN_V1/);
  const payload = lessonAnalyticsPayload({ lessonSlug: LESSON_08_SLUG, courseSlug: "trafego-pago-na-pratica", accessType: "PAID" });
  assert.deepEqual(Object.keys(payload).sort(), ["access_type", "course_slug", "lesson_slug"]);
  assert.equal(JSON.stringify(payload).includes("https://"), false);
});
