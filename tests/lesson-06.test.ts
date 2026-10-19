import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { config as loadEnv } from "dotenv";
import { assessLesson } from "../src/lib/editorial/readiness";
import { canReadLessonBody, visibleBlocks } from "../src/lib/learning/access";
import { lessonAnalyticsPayload } from "../src/lib/learning/analytics-events";
import { parseBlockData } from "../src/lib/learning/blocks";
import { firstCourseSeed } from "../src/lib/learning/first-course";

import { LESSON_06_SLUG, lesson06Blocks, lesson06Meta } from "../src/lib/learning/lesson-06";
import { isBlockComplete, isLessonComplete, type ProgressRuleBlock } from "../src/lib/learning/progress";
import { blueprintProjectIdsFrom, blueprintReadiness, parseSearchBlueprintForm, type SearchBlueprintFormInput } from "../src/lib/learning/search-blueprint";

loadEnv({ path: ".env.local" });

const required = [
  "checkpoint-hierarquia-pesquisa",
  "checkpoint-localizacao",
  "checkpoint-foco-otimizacao",
  "checkpoint-grupos-coerentes",
  "blueprint-campanha-pesquisa",
  "checkpoint-final-blueprint",
];

const laterLessons = [
  "o-que-mudar",
];

const group = { name: "Ultrassom Obstétrico", theme: "Exame de ultrassonografia obstétrica", intent: "Pessoas procurando realizar ultrassonografia obstétrica." };

function blueprintInput(projectId: string, patch: Partial<SearchBlueprintFormInput> = {}): SearchBlueprintFormInput {
  return {
    projectId,
    campaignName: "Pesquisa | Ultrassom Obstétrico | Belém",
    offer: "Ultrassonografia obstétrica",
    businessObjective: "LEADS",
    primaryConversion: "Envio concluído do formulário de orçamento.",
    destinationType: "LANDING_PAGE",
    destinationUrl: "https://clinica.example/orcamento",
    locationPlan: "Pessoas em Belém que possam ir até a clínica.",
    languagePlan: "Português",
    monthlyBudget: "600",
    optimizationFocus: "CONVERSIONS",
    brandStrategy: "UNDECIDED",
    searchPartnersDecision: "UNDECIDED",
    adGroups: [group],
    preLaunchIssue: "",
    ...patch,
  };
}

test("aula 6 definitiva tem 34 blocos e passa na validação", () => {
  assert.equal(lesson06Blocks.length, 34);
  assert.equal(new Set(lesson06Blocks.map((block) => block.blockKey)).size, 34);
  assert.deepEqual(lesson06Blocks.map((block) => block.position), lesson06Blocks.map((_, index) => index + 1));
  for (const block of lesson06Blocks) assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  const tools = lesson06Blocks.filter((block) => block.data.type === "TOOL");
  assert.equal(tools.length, 1);
  assert.equal(tools[0]?.data.type === "TOOL" && tools[0].data.toolKey, "SEARCH_CAMPAIGN_BLUEPRINT_V1");
  assert.equal(lesson06Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 5);
  assert.equal(lesson06Blocks.filter((block) => block.data.type === "RESULT").length, 0);
  assert.equal(lesson06Blocks.some((block) => block.data.type === "CONCLUSION"), true);
  assert.equal(lesson06Blocks.filter((block) => block.data.type === "HEADING").every((block) => !block.countsForProgress), true);
  for (const key of required) assert.equal(lesson06Blocks.find((block) => block.blockKey === key)?.required, true);
  assert.equal(lesson06Meta.accessType, "PAID");
  assert.equal(lesson06Meta.priceCents, 3990);
  assert.equal(lesson06Meta.commerceStatus, "NOT_FOR_SALE");
  assert.equal(lesson06Meta.estimatedMinutes, 40);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }), false);
  assert.equal(visibleBlocks({ status: "PUBLISHED", accessType: "PAID" }, lesson06Blocks).length, 0);
  const lessons = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons);
  assert.equal(lessons.filter((lesson) => lesson.slug === LESSON_06_SLUG).length, 1);
  for (const slug of laterLessons) assert.equal(lessons.find((lesson) => lesson.slug === slug)?.blocks.length, 0);
  const moduleTwo = firstCourseSeed.modules.find((moduleRow) => moduleRow.slug === "google-ads-na-pratica");
  assert.equal(moduleTwo?.bundlePriceCents, 10390);
  assert.equal(lessons.find((lesson) => lesson.slug === "palavras-chave-com-intencao")?.priceCents, 3990);
  assert.equal(lessons.find((lesson) => lesson.slug === "anuncios-alinhados-a-conversao")?.priceCents, 3490);
  const ready = assessLesson(
    {
      title: lesson06Meta.title,
      summary: lesson06Meta.summary,
      publicPreview: lesson06Meta.publicPreview,
      estimatedMinutes: lesson06Meta.estimatedMinutes,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: 3990,
      commerceStatus: "NOT_FOR_SALE",
    },
    lesson06Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.deepEqual(ready.issues, []);
  const trafficOnly = assessLesson(
    {
      title: "Paga sem resultado",
      summary: "Resumo",
      publicPreview: "Preview",
      estimatedMinutes: 10,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: 1000,
      commerceStatus: "NOT_FOR_SALE",
    },
    [
      { blockKey: "texto", retiredAt: null, payload: { type: "TEXT", body: "Conteúdo da aula." } },
      { blockKey: "fim", retiredAt: null, payload: { type: "CONCLUSION", body: "Fim." } },
      { blockKey: "ferramenta", retiredAt: null, payload: { type: "TOOL", toolKey: "TRAFFIC_READINESS_V1", title: "Diagnóstico", description: "Abrir." } },
    ],
  );
  assert.equal(trafficOnly.ready, false);
  const pending = parseSearchBlueprintForm({ ...blueprintInput("projeto"), destinationType: "UNDEFINED", monthlyBudget: "", preLaunchIssue: "Não conferi a região.", readinessStatus: "READY_FOR_KEYWORDS" } as never);
  assert.equal(pending.ok, true);
  if (pending.ok) {
    assert.equal(pending.blueprint.readinessStatus, "NEEDS_PREPARATION");
    assert.equal(pending.blueprint.monthlyBudgetCents, undefined);
    assert.equal(blueprintReadiness(pending.blueprint).status, "NEEDS_PREPARATION");
  }
  const readyBlueprint = parseSearchBlueprintForm(blueprintInput("projeto"));
  assert.equal(readyBlueprint.ok, true);
  if (readyBlueprint.ok) {
    assert.equal(readyBlueprint.blueprint.readinessStatus, "READY_FOR_KEYWORDS");
    assert.equal(readyBlueprint.blueprint.monthlyBudgetCents, 60000);
    assert.equal(readyBlueprint.blueprint.dailyBudgetReferenceCents, 2000);
    assert.equal(readyBlueprint.blueprint.brandStrategy, "UNDECIDED");
    assert.equal(readyBlueprint.blueprint.searchPartnersDecision, "UNDECIDED");
    assert.equal(readyBlueprint.blueprint.adGroups[0]?.name, group.name);
  }
  assert.equal(parseSearchBlueprintForm(blueprintInput("projeto", { adGroups: [] })).ok, false);
  assert.equal(parseSearchBlueprintForm(blueprintInput("projeto", { adGroups: Array.from({ length: 7 }, () => group) })).ok, false);
  assert.equal(parseSearchBlueprintForm(blueprintInput("projeto", { campaignName: "a".repeat(121) })).ok, false);
  assert.equal(parseSearchBlueprintForm(blueprintInput("projeto", { locationPlan: "" })).ok, false);
  assert.equal(parseSearchBlueprintForm(blueprintInput("projeto", { destinationUrl: "http://clinica.example" })).ok, false);
  assert.equal(parseSearchBlueprintForm(blueprintInput("projeto", { monthlyBudget: "nao" })).ok, false);
  assert.equal(blueprintProjectIdsFrom([{ projectId: "projeto", payload: { offer: "x" } }]).size, 0);
  assert.equal(blueprintProjectIdsFrom([{ projectId: "projeto", payload: readyBlueprint.ok ? readyBlueprint.blueprint : {} }]).has("projeto"), true);
  const tool = lesson06Blocks.find((block) => block.blockKey === "blueprint-campanha-pesquisa");
  const rule = tool ? ({ ...tool, retiredAt: null } as ProgressRuleBlock) : null;
  assert.ok(rule);
  if (rule) {
    const answer = { viewed: true, response: { projectId: "projeto" } };
    assert.equal(isBlockComplete(rule, answer, false, new Set(["projeto"]), new Set(["projeto"]), new Set()), false);
    assert.equal(isBlockComplete(rule, answer, false, new Set(), new Set(), new Set(["projeto"])), true);
  }
  const source = readFileSync(new URL("../src/components/learning/SearchBlueprintTool.tsx", import.meta.url), "utf8");
  assert.equal(source.includes("trackEvent"), false);
  assert.equal(source.includes("dataLayer"), false);
  const payload = lessonAnalyticsPayload({ lessonSlug: LESSON_06_SLUG, courseSlug: "trafego-pago-na-pratica", accessType: "PAID" });
  assert.deepEqual(Object.keys(payload).sort(), ["access_type", "course_slug", "lesson_slug"]);
  assert.equal(isLessonComplete(lesson06Blocks.map((block) => ({ ...block, retiredAt: null })), {}, false), false);
});

