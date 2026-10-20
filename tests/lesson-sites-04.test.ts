import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { assessLesson } from "../src/lib/editorial/readiness";
import {
  buildWireframeContextFromLandingPageProject,
  consultoriaLandingFixture,
  createEmptyLandingPageDocument,
  createLandingPageProject,
  createMemoryLandingPageStore,
  listLandingPageProjects,
  parseConversionPageBrief,
  saveConversionPageBrief,
  suggestLandingPageSlug,
  updateLandingPageDraft,
  conversionBriefLessonSummary,
} from "../src/lib/landing-page";
import { prefillConversionBrief, BRIEF_CONFLICT_MESSAGE } from "../src/lib/learning/conversion-page-brief";
import { siteLesson04Blocks, siteLesson04Meta } from "../src/lib/learning/site-oferta-publico-acao-principal";
import { sitesCourseSeed } from "../src/lib/learning/sites-course";
import { FIRST_COURSE_SLUG } from "../src/lib/learning/first-course";
import type { ConversionJourneyMap } from "../src/lib/learning/conversion-journey-map";

function storeFor(userId = "user-a") {
  return createMemoryLandingPageStore({
    courseIdBySlug: { "sites-que-convertem": "course-sites" },
    projects: [
      { id: "project-a", userId },
      { id: "project-b", userId: "user-b" },
    ],
  });
}

function brief(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    offer: { name: "Consulta contábil para regularização" },
    audience: { description: "Pequenos negócios que precisam regularizar a empresa" },
    problemOrContext: "A empresa precisa se regularizar antes de crescer",
    primaryBenefit: "Saber o próximo passo da regularização",
    pageGoal: "REQUEST_QUOTE",
    primaryAction: { type: "FORM", label: "Solicitar análise" },
    businessOutcome: "QUOTE",
    objections: ["prazo", "confiança"],
    arrivalContext: { trafficSources: ["GOOGLE_ADS"] },
    ...overrides,
  };
}

test("aula 4 completa com 31 blocos, chaves estáveis, 4 checkpoints, tool e resultado", () => {
  assert.equal(siteLesson04Blocks.length, 31);
  assert.equal(new Set(siteLesson04Blocks.map((block) => block.blockKey)).size, 31);
  assert.equal(siteLesson04Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 4);
  const tool = siteLesson04Blocks.find((block) => block.data.type === "TOOL");
  assert.equal(tool?.data.type === "TOOL" && tool.data.toolKey, "CONVERSION_PAGE_BRIEF_V1");
  const result = siteLesson04Blocks.find((block) => block.data.type === "RESULT");
  assert.equal(result?.data.type === "RESULT" && result.data.title, "Brief de conversão da minha landing page");
  const body = siteLesson04Blocks.map((block) => JSON.stringify(block.data)).join("\n");
  assert.match(body, /Planeje a jornada do visitante/);
  assert.match(body, /perceber, compreender e acreditar/);
  assert.equal(siteLesson04Meta.accessType, "PAID");
  assert.equal(siteLesson04Meta.priceCents, 3490);
  assert.equal(siteLesson04Meta.commerceStatus, "NOT_FOR_SALE");
  const assessment = assessLesson(
    {
      title: siteLesson04Meta.title,
      summary: siteLesson04Meta.summary,
      publicPreview: siteLesson04Meta.publicPreview,
      estimatedMinutes: siteLesson04Meta.estimatedMinutes,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: 3490,
      commerceStatus: "NOT_FOR_SALE",
    },
    siteLesson04Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.equal(assessment.ready, true, assessment.issues.join(" "));
  assert.equal(existsSync("src/lib/learning/site-jornada-do-visitante.ts"), false);
});

test("curso continua draft e fora de venda; curso 1 segue publicado no seed", () => {
  assert.equal(sitesCourseSeed.status, "DRAFT");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(FIRST_COURSE_SLUG, "trafego-pago-na-pratica");
  const lesson4 = sitesCourseSeed.modules.flatMap((module) => module.lessons).find((lesson) => lesson.slug === "oferta-publico-acao-principal");
  assert.equal(lesson4?.plannedResult, "Brief de conversão da minha landing page");
  assert.equal(lesson4?.plannedTool, "CONVERSION_PAGE_BRIEF_V1");
});

test("brief válido, rejeições e ação secundária opcional", () => {
  assert.equal(parseConversionPageBrief(brief()).ok, true);
  assert.equal(parseConversionPageBrief(brief({ offer: { name: "" } })).ok, false);
  assert.equal(parseConversionPageBrief(brief({ audience: { description: "" } })).ok, false);
  const missingAction = brief();
  delete (missingAction as { primaryAction?: unknown }).primaryAction;
  assert.equal(parseConversionPageBrief(missingAction).ok, false);
  assert.equal(parseConversionPageBrief(brief({ objections: Array.from({ length: 9 }, (_, index) => `objecao ${index}`) })).ok, false);
  assert.equal(parseConversionPageBrief(brief({ offer: { name: "<b>oferta</b>" } })).ok, false);
  assert.equal(parseConversionPageBrief(brief({ arrivalContext: { trafficSources: ["GOOGLE_ADS", "INSTAGRAM"] } })).ok, true);
  assert.equal(parseConversionPageBrief(brief({ arrivalContext: { trafficSources: ["GOOGLE_ADS", "GOOGLE_ADS"] } })).ok, false);
  assert.equal(parseConversionPageBrief(brief({ pageGoal: "OTHER" })).ok, false);
  assert.equal(parseConversionPageBrief(brief({ pageGoal: "OTHER", pageGoalDetail: "Orientar a visita" })).ok, true);
  const withoutSecondary = brief();
  delete (withoutSecondary as { secondaryAction?: unknown }).secondaryAction;
  assert.equal(parseConversionPageBrief(withoutSecondary).ok, true);
  assert.equal(parseConversionPageBrief(brief({ secondaryAction: { type: "INTERNAL_ROUTE", label: "Ver portfólio" } })).ok, true);
});

test("cria, lista, isola e mantém a landing page em rascunho", async () => {
  const store = storeFor();
  const created = await createLandingPageProject(store, {
    userId: "user-a",
    title: "Minha Oferta",
    slug: suggestLandingPageSlug("Minha Oferta"),
    projectId: "project-a",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.value.slug, "minha-oferta");
  assert.equal(created.value.projectId, "project-a");
  assert.equal(created.value.status, "DRAFT");

  const standalone = await createLandingPageProject(store, {
    userId: "user-a",
    title: "Sem projeto",
    slug: "sem-projeto",
  });
  assert.equal(standalone.ok && standalone.value.projectId, null);

  const pages = await listLandingPageProjects(store, { userId: "user-a" });
  assert.equal(pages.length, 2);

  const foreign = await createLandingPageProject(store, {
    userId: "user-a",
    title: "Alheio",
    slug: "alheio",
    projectId: "project-b",
  });
  assert.equal(foreign.ok, false);
  if (foreign.ok) return;
  assert.equal(foreign.code, "NOT_FOUND");

  const duplicate = await createLandingPageProject(store, {
    userId: "user-b",
    title: "Outra",
    slug: "minha-oferta",
  });
  assert.equal(duplicate.ok, false);

  const hidden = await listLandingPageProjects(store, { userId: "user-b" });
  assert.equal(hidden.length, 0);
});

test("salva o brief, sincroniza conversão e preserva o restante do documento", async () => {
  const store = storeFor();
  const created = await createLandingPageProject(store, { userId: "user-a", title: "Página", slug: "pagina" });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const fixture = consultoriaLandingFixture();
  const drafted = await updateLandingPageDraft(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    document: fixture,
  });
  assert.equal(drafted.ok, true);
  if (!drafted.ok) return;

  const saved = await saveConversionPageBrief(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: drafted.value.draftRevision,
    brief: brief({ primaryAction: { type: "WHATSAPP", phone: "5511999990000" }, secondaryAction: { type: "FORM", label: "Ver portfólio" } }),
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.value.status, "DRAFT");
  assert.equal(saved.value.draftRevision, drafted.value.draftRevision + 1);
  assert.equal(saved.value.draftDocument.strategy?.brief?.offer.name, "Consulta contábil para regularização");
  assert.equal(saved.value.draftDocument.conversion.primaryAction?.type, "WHATSAPP");
  assert.equal(saved.value.draftDocument.conversion.businessOutcome, "QUOTE");
  assert.equal(saved.value.draftDocument.conversion.secondaryAction, null);
  assert.equal(saved.value.draftDocument.sections.length, fixture.sections.length);
  assert.deepEqual(saved.value.draftDocument.theme, fixture.theme);
  assert.deepEqual(saved.value.draftDocument.measurement, fixture.measurement);
  assert.deepEqual(saved.value.draftDocument.mediaRefs, fixture.mediaRefs);

  const conflict = await saveConversionPageBrief(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: drafted.value.draftRevision,
    brief: brief(),
  });
  assert.equal(conflict.ok, false);
  if (conflict.ok) return;
  assert.equal(conflict.code, "LANDING_PAGE_DRAFT_CONFLICT");
  assert.equal(BRIEF_CONFLICT_MESSAGE, "Esta página foi alterada em outro lugar. Atualize os dados antes de salvar novamente.");

  const again = await saveConversionPageBrief(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: saved.value.draftRevision,
    brief: brief(),
  });
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.value.draftRevision, saved.value.draftRevision + 1);
  assert.equal(again.value.draftDocument.conversion.primaryAction, null);
  assert.equal(again.value.draftDocument.sections.length, fixture.sections.length);

  const other = await saveConversionPageBrief(store, {
    userId: "user-b",
    landingPageProjectId: created.value.id,
    expectedRevision: again.value.draftRevision,
    brief: brief(),
  });
  assert.equal(other.ok, false);
});

test("prefill da mesma jornada e isolamento entre projetos", () => {
  const journey: ConversionJourneyMap = {
    offer: "Gestão de anúncios",
    trafficSource: "INSTAGRAM",
    destinationType: "WHATSAPP",
    destinationDescription: "Chega pelo perfil",
    primaryAction: "QUOTE_REQUEST",
    businessOutcome: "QUOTE",
  };
  const same = prefillConversionBrief({
    linkedProjectId: "project-a",
    journeyProjectId: "project-a",
    journey,
    presenceProjectId: "project-a",
    recommendedStructure: "WHATSAPP_FIRST",
    readinessProjectId: "project-a",
    primaryBottleneck: "FOUNDATION",
  });
  assert.equal(same.offerName, "Gestão de anúncios");
  assert.deepEqual(same.trafficSources, ["INSTAGRAM"]);
  assert.equal(same.pageGoal, "REQUEST_QUOTE");
  assert.equal(same.primaryActionType, "FORM");
  assert.equal(same.businessOutcome, "QUOTE");
  assert.equal(same.notes.length, 2);

  const other = prefillConversionBrief({
    linkedProjectId: "project-a",
    journeyProjectId: "project-b",
    journey,
    presenceProjectId: "project-b",
    recommendedStructure: "INSTITUTIONAL_SITE",
    readinessProjectId: "project-b",
    primaryBottleneck: "FOUNDATION",
  });
  assert.equal(other.offerName, undefined);
  assert.equal(other.notes.length, 0);

  const alone = prefillConversionBrief({
    linkedProjectId: null,
    journeyProjectId: null,
    journey: null,
    presenceProjectId: null,
    recommendedStructure: null,
    readinessProjectId: null,
    primaryBottleneck: null,
  });
  assert.deepEqual(alone.notes, []);
  assert.equal(alone.offerName, undefined);
});

test("resumo da aula aponta o projeto sem copiar o brief e o adaptador fica parcial", () => {
  const parsed = parseConversionPageBrief(brief());
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const summary = conversionBriefLessonSummary("lp-1", parsed.brief, "2026-10-20T00:00:00.000Z");
  assert.equal(summary.landingPageProjectId, "lp-1");
  assert.equal("problemOrContext" in summary, false);
  assert.equal("objections" in summary, false);
  assert.equal(summary.objectionCount, 2);

  const document = createEmptyLandingPageDocument();
  document.strategy = { brief: parsed.brief };
  const context = buildWireframeContextFromLandingPageProject(document);
  assert.equal(context?.contextCompleteness, "PARTIAL");
  assert.equal(document.sections.length, 0);
  const adapter = readFileSync("src/lib/landing-page/wireframe/from-brief.ts", "utf8");
  const lesson = readFileSync("src/lib/learning/conversion-page-brief.ts", "utf8");
  assert.equal(adapter.includes("generateWireframePlan"), false);
  assert.equal(lesson.includes("generateWireframePlan"), false);
});

test("dados estratégicos não entram em analytics, log, sitemap ou rota pública", () => {
  const files = [
    "src/lib/landing-page/brief.ts",
    "src/lib/learning/conversion-page-brief.ts",
    "src/components/learning/ConversionPageBriefTool.tsx",
    "src/lib/landing-page/service.ts",
  ];
  const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
  assert.equal(/console\.(log|info|debug)/.test(source), false);
  assert.equal(source.includes("gtag"), false);
  assert.equal(source.includes("track("), false);
  assert.equal(existsSync("src/app/p"), false);
  const robots = readFileSync("src/app/robots.ts", "utf8");
  assert.match(robots, /\/app/);
  assert.equal(readFileSync("src/app/sitemap.ts", "utf8").includes("oferta-publico-acao-principal"), false);
});
