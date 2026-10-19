import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { config as loadEnv } from "dotenv";
import { assessLesson } from "../src/lib/editorial/readiness";
import { canReadLessonBody, visibleBlocks } from "../src/lib/learning/access";
import { lessonAnalyticsPayload } from "../src/lib/learning/analytics-events";
import { parseBlockData } from "../src/lib/learning/blocks";
import { destinationReadiness, destinationUrlError, nextLessonSlugs, parseDestinationPlanForm, planProjectIdsFrom } from "../src/lib/learning/destination-plan";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { LESSON_01_SLUG, lesson01Blocks } from "../src/lib/learning/lesson-01";
import { LESSON_02_SLUG, lesson02Blocks } from "../src/lib/learning/lesson-02";
import { LESSON_03_SLUG, lesson03Blocks } from "../src/lib/learning/lesson-03";
import { LESSON_04_SLUG, lesson04Blocks } from "../src/lib/learning/lesson-04";
import { LESSON_05_SLUG, lesson05Blocks, lesson05Meta } from "../src/lib/learning/lesson-05";
import { isLessonComplete, type ProgressRuleBlock } from "../src/lib/learning/progress";

loadEnv({ path: ".env.local" });

const required = [
  "checkpoint-destino-coerente",
  "checkpoint-clique-vs-resultado",
  "checkpoint-tres-camadas",
  "plano-destino-mensuracao",
  "checkpoint-final-mensuracao",
];
const laterLessons = [
  "campanhas-leads-whatsapp",
  "leia-os-numeros",
  "o-que-mudar",
];

test("aula 5 definitiva tem 32 blocos e passa na validação", () => {
  assert.equal(lesson05Blocks.length, 32);
  assert.equal(new Set(lesson05Blocks.map((block) => block.blockKey)).size, 32);
  assert.deepEqual(
    lesson05Blocks.map((block) => block.position),
    lesson05Blocks.map((_, index) => index + 1),
  );
  for (const block of lesson05Blocks) assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  const tools = lesson05Blocks.filter((block) => block.data.type === "TOOL");
  assert.equal(tools.length, 1);
  assert.equal(tools[0]?.data.type === "TOOL" && tools[0].data.toolKey, "DESTINATION_MEASUREMENT_PLAN_V1");
  assert.equal(lesson05Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 4);
  assert.equal(lesson05Blocks.filter((block) => block.data.type === "RESULT").length, 0);
  assert.equal(lesson05Blocks.some((block) => block.data.type === "CONCLUSION"), true);
  assert.equal(lesson05Blocks.filter((block) => block.data.type === "HEADING").every((block) => !block.countsForProgress), true);
  const checklist = lesson05Blocks.find((block) => block.data.type === "CHECKLIST");
  assert.equal(checklist?.countsForProgress, false);
  assert.equal(checklist?.required, false);
  for (const key of required) assert.equal(lesson05Blocks.find((block) => block.blockKey === key)?.required, true);
  assert.equal(lesson05Meta.accessType, "PAID");
  assert.equal(lesson05Meta.priceCents, 3490);
  assert.equal(lesson05Meta.commerceStatus, "NOT_FOR_SALE");
  assert.equal(lesson05Meta.estimatedMinutes, 35);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }), false);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }, { entitled: true }), true);
  assert.equal(visibleBlocks({ status: "PUBLISHED", accessType: "PAID" }, lesson05Blocks).length, 0);
  const lessons = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons);
  assert.equal(lessons.filter((lesson) => lesson.slug === LESSON_05_SLUG).length, 1);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_01_SLUG)?.blocks.length, lesson01Blocks.length);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_02_SLUG)?.blocks.length, lesson02Blocks.length);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_03_SLUG)?.blocks.length, lesson03Blocks.length);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_04_SLUG)?.blocks.length, lesson04Blocks.length);
  for (const slug of laterLessons) assert.equal(lessons.find((lesson) => lesson.slug === slug)?.blocks.length, 0);
  const moduleOne = firstCourseSeed.modules.find((moduleRow) => moduleRow.slug === "planeje-antes-de-anunciar");
  assert.equal(moduleOne?.bundlePriceCents, 5790);
  const ready = assessLesson(
    {
      title: lesson05Meta.title,
      summary: lesson05Meta.summary,
      publicPreview: lesson05Meta.publicPreview,
      estimatedMinutes: lesson05Meta.estimatedMinutes,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: 3490,
      commerceStatus: "NOT_FOR_SALE",
    },
    lesson05Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.deepEqual(ready.issues, []);
  assert.equal(ready.ready, true);
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
  assert.equal(destinationUrlError("LANDING_PAGE", "javascript:alert(1)"), "Esse endereço não pode ser usado.");
  assert.equal(destinationUrlError("WEBSITE", "http://clinica.example"), "Use um endereço que comece com https://.");
  assert.equal(destinationUrlError("WEBSITE", ""), "Informe o endereço HTTPS do destino.");
  assert.equal(destinationUrlError("WHATSAPP", ""), null);
  assert.equal(destinationUrlError("LANDING_PAGE", "https://clinica.example/?email=a@b.com"), "Não coloque e-mail ou dados pessoais no endereço.");
  const pending = parseDestinationPlanForm({ ...planInput("projeto"), offerIsClear: false, businessOutcomeMethod: "NONE", preLaunchIssue: "Não testei o formulário.", readinessStatus: "READY_TO_CONFIGURE" } as never);
  assert.equal(pending.ok, true);
  if (pending.ok) {
    assert.equal(pending.plan.readinessStatus, "NEEDS_PREPARATION");
    assert.equal(destinationReadiness(pending.plan).issues.includes("O resultado comercial ainda não é registrado."), true);
  }
  const readyPlan = parseDestinationPlanForm(planInput("projeto"));
  assert.equal(readyPlan.ok && readyPlan.plan.readinessStatus, "READY_TO_CONFIGURE");
  assert.equal(parseDestinationPlanForm({ ...planInput("projeto"), primaryCta: "a".repeat(121) }).ok, false);
  assert.equal(parseDestinationPlanForm({ ...planInput("projeto"), primaryConversion: "a".repeat(201) }).ok, false);
  assert.equal(planProjectIdsFrom([{ projectId: "projeto", payload: { offer: "brief" } }]).size, 0);
  assert.equal(planProjectIdsFrom([{ projectId: "projeto", payload: readyPlan.ok ? readyPlan.plan : {} }]).has("projeto"), true);
  assert.deepEqual(nextLessonSlugs("google"), ["campanha-de-pesquisa"]);
  assert.deepEqual(nextLessonSlugs("meta"), ["objetivo-publico-estrutura"]);
  assert.deepEqual(nextLessonSlugs("both"), ["campanha-de-pesquisa", "objetivo-publico-estrutura"]);
  assert.deepEqual(nextLessonSlugs("none"), []);
  assert.deepEqual(nextLessonSlugs(null), []);
  const payload = lessonAnalyticsPayload({ lessonSlug: LESSON_05_SLUG, courseSlug: "trafego-pago-na-pratica", accessType: "PAID" });
  assert.deepEqual(Object.keys(payload).sort(), ["access_type", "course_slug", "lesson_slug"]);
  const source = readFileSync(new URL("../src/components/learning/DestinationPlanTool.tsx", import.meta.url), "utf8");
  assert.equal(source.includes("trackEvent"), false);
  assert.equal(source.includes("dataLayer"), false);
  const rules: ProgressRuleBlock[] = lesson05Blocks.map((block) => ({ ...block, retiredAt: null }));
  const answers = Object.fromEntries(
    lesson05Blocks.map((block) => {
      if (block.data.type === "CHECKPOINT") return [block.blockKey, { viewed: true, response: { optionId: block.data.correctOptionId } }];
      if (block.data.type === "TOOL") return [block.blockKey, { viewed: true, response: { projectId: "projeto-1" } }];
      return [block.blockKey, { viewed: true }];
    }),
  );
  assert.equal(isLessonComplete(rules, answers, false, new Set(["projeto-1"]), new Set()), false);
  assert.equal(isLessonComplete(rules, { "plano-destino-mensuracao": { viewed: true, response: { projectId: "projeto-1" } } }, false, new Set(), new Set(["projeto-1"])), false);
  assert.equal(isLessonComplete(rules, answers, false, new Set(), new Set(["projeto-1"])), true);
});

function planInput(projectId: string) {
  return {
    projectId,
    destinationType: "LANDING_PAGE",
    destinationUrl: "https://clinica.example",
    primaryCta: "Solicitar orçamento",
    primaryConversion: "Envio concluído do formulário de orçamento.",
    offerIsClear: true,
    ctaIsVisible: true,
    mobileChecked: true,
    conversionPathTested: true,
    trafficSourceMethod: "UTM",
    platformConversionStatus: "NOT_APPLICABLE",
    analyticsStatus: "NOT_APPLICABLE",
    businessOutcomeMethod: "CRM",
    preLaunchIssue: "",
  };
}
