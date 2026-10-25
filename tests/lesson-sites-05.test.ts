import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assessLesson } from "../src/lib/editorial/readiness";
import {
  buildWireframeContextFromLandingPageProject,
  createEmptyLandingPageDocument,
  createLandingPageProject,
  createMemoryLandingPageStore,
  parseVisitorDecisionJourney,
  saveConversionPageBrief,
  saveVisitorDecisionJourney,
  visitorDecisionLessonSummary,
  wireframeContextCompleteness,
} from "../src/lib/landing-page";
import { siteLesson05Blocks, siteLesson05Meta } from "../src/lib/learning/site-jornada-do-visitante";
import { sitesCourseSeed } from "../src/lib/learning/sites-course";

function storeFor() {
  return createMemoryLandingPageStore({
    courseIdBySlug: { "sites-que-convertem": "course-sites" },
    projects: [
      { id: "project-a", userId: "user-a" },
      { id: "project-b", userId: "user-b" },
    ],
  });
}

function brief(action: Record<string, unknown> = { type: "FORM", label: "Solicitar análise" }) {
  return {
    version: 1,
    offer: { name: "Móveis planejados sob medida" },
    audience: { description: "Quem já quer um projeto e precisa orçar" },
    problemOrContext: "Precisa decidir prazo, medida e confiança antes de contratar",
    primaryBenefit: "Saber como o orçamento acontece",
    pageGoal: "REQUEST_QUOTE",
    primaryAction: action,
    businessOutcome: "QUOTE",
    objections: ["prazo"],
    arrivalContext: { trafficSources: ["INSTAGRAM"], whatVisitorMayAlreadyKnow: "Viu um projeto no perfil" },
  };
}

function journey(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    awarenessLevel: "KNOWS_THE_OFFER",
    explanationNeed: "MEDIUM",
    decisionComplexity: "HIGH",
    trustNeed: "HIGH",
    objectionAnalysis: [{ objection: "prazo", category: "TIMING", importance: "HIGH" }],
    processNeedsExplanation: "YES",
    proofSituation: "NEEDS_PROOF",
    contactImportance: "HIGH",
    preferredConversionMethod: "FORM",
    decisionStages: [
      { type: "ARRIVAL", goal: "Reconhecer o tipo de projeto" },
      { type: "BUILD_TRUST", goal: "Confiar no processo" },
      { type: "ACT", goal: "Pedir orçamento" },
    ],
    ...overrides,
  };
}

async function pageWithBrief(action?: Record<string, unknown>) {
  const store = storeFor();
  const created = await createLandingPageProject(store, { userId: "user-a", title: "Página", slug: "pagina", projectId: "project-a" });
  if (!created.ok) throw new Error(created.code);
  const saved = await saveConversionPageBrief(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    brief: brief(action),
  });
  if (!saved.ok) throw new Error(saved.code);
  return { store, page: saved.value };
}

test("aula 5 completa com 31 blocos, 4 checkpoints, tool e transição", () => {
  assert.equal(siteLesson05Blocks.length, 31);
  assert.equal(new Set(siteLesson05Blocks.map((block) => block.blockKey)).size, 31);
  assert.equal(siteLesson05Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 4);
  const tool = siteLesson05Blocks.find((block) => block.data.type === "TOOL");
  assert.equal(tool?.data.type === "TOOL" && tool.data.toolKey, "VISITOR_DECISION_JOURNEY_V1");
  const result = siteLesson05Blocks.find((block) => block.data.type === "RESULT");
  assert.equal(result?.data.type === "RESULT" && result.data.title, "Mapa de decisão do visitante");
  const body = siteLesson05Blocks.map((block) => JSON.stringify(block.data)).join("\n");
  assert.match(body, /Organize as seções da página/);
  assert.match(body, /Veja sua landing page ganhar estrutura/);
  assert.equal(siteLesson05Meta.priceCents, 3490);
  assert.equal(siteLesson05Meta.commerceStatus, "NOT_FOR_SALE");
  const assessment = assessLesson(
    {
      title: siteLesson05Meta.title,
      summary: siteLesson05Meta.summary,
      publicPreview: siteLesson05Meta.publicPreview,
      estimatedMinutes: 30,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: 3490,
      commerceStatus: "NOT_FOR_SALE",
    },
    siteLesson05Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.equal(assessment.ready, true, assessment.issues.join(" "));
  assert.equal(sitesCourseSeed.status, "PUBLISHED");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
});

test("schema da jornada aceita sinais válidos e rejeita inválidos", () => {
  assert.equal(parseVisitorDecisionJourney(journey()).ok, true);
  for (const explanationNeed of ["LOW", "MEDIUM", "HIGH", "UNKNOWN"]) {
    assert.equal(parseVisitorDecisionJourney(journey({ explanationNeed })).ok, true);
  }
  assert.equal(parseVisitorDecisionJourney(journey({ awarenessLevel: "READY_TO_ACT" })).ok, true);
  assert.equal(parseVisitorDecisionJourney(journey({ decisionComplexity: "LOW" })).ok, true);
  assert.equal(parseVisitorDecisionJourney(journey({ trustNeed: "MEDIUM" })).ok, true);
  assert.equal(parseVisitorDecisionJourney(journey({ processNeedsExplanation: "NO" })).ok, true);
  assert.equal(parseVisitorDecisionJourney(journey({ proofSituation: "HAS_PROOF" })).ok, true);
  assert.equal(parseVisitorDecisionJourney(journey({ contactImportance: "LOW" })).ok, true);
  assert.equal(parseVisitorDecisionJourney(journey({ preferredConversionMethod: "WHATSAPP" })).ok, true);
  assert.equal(parseVisitorDecisionJourney(journey({ objectionAnalysis: [{ objection: "preço", category: "PRICE", importance: "LOW" }] })).ok, true);
  assert.equal(parseVisitorDecisionJourney(journey({ decisionStages: [{ type: "ACT", goal: "Inscrever" }] })).ok, true);
  assert.equal(parseVisitorDecisionJourney(journey({ objectionAnalysis: Array.from({ length: 9 }, (_, index) => ({ objection: `d${index}`, importance: "LOW" })) })).ok, false);
  assert.equal(parseVisitorDecisionJourney(journey({ decisionStages: [] })).ok, false);
  assert.equal(parseVisitorDecisionJourney(journey({ awarenessLevel: "EXPERT" })).ok, false);
  assert.equal(parseVisitorDecisionJourney(journey({ objectionAnalysis: [{ objection: "<b>preço</b>", importance: "LOW" }] })).ok, false);
  assert.equal(parseVisitorDecisionJourney(journey({
    objectionAnalysis: [
      { objection: "prazo", importance: "LOW" },
      { objection: "Prazo", importance: "HIGH" },
    ],
  })).ok, false);
});

test("salva a jornada no mesmo projeto, preserva o brief e não cria seções", async () => {
  const { store, page } = await pageWithBrief();
  const missing = await saveVisitorDecisionJourney(store, {
    userId: "user-a",
    landingPageProjectId: "inexistente",
    expectedRevision: 1,
    decisionJourney: journey(),
  });
  assert.equal(missing.ok, false);

  const empty = await createLandingPageProject(store, { userId: "user-a", title: "Vazia", slug: "vazia" });
  if (!empty.ok) return;
  const noBrief = await saveVisitorDecisionJourney(store, {
    userId: "user-a",
    landingPageProjectId: empty.value.id,
    expectedRevision: empty.value.draftRevision,
    decisionJourney: journey(),
  });
  assert.equal(noBrief.ok, false);
  if (noBrief.ok) return;
  assert.equal(noBrief.code, "LANDING_PAGE_BRIEF_REQUIRED");

  const saved = await saveVisitorDecisionJourney(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    decisionJourney: journey(),
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.value.status, "DRAFT");
  assert.equal(saved.value.draftRevision, page.draftRevision + 1);
  assert.equal(saved.value.draftDocument.strategy?.decisionJourney?.trustNeed, "HIGH");
  assert.equal(saved.value.draftDocument.strategy?.brief?.offer.name, "Móveis planejados sob medida");
  assert.equal(saved.value.draftDocument.strategy?.brief?.audience.description, "Quem já quer um projeto e precisa orçar");
  assert.equal(saved.value.draftDocument.strategy?.brief?.pageGoal, "REQUEST_QUOTE");
  assert.equal(saved.value.draftDocument.strategy?.brief?.primaryAction.type, "FORM");
  assert.deepEqual(saved.value.draftDocument.strategy?.brief?.objections, ["prazo"]);
  assert.equal(saved.value.draftDocument.sections.length, 0);
  assert.equal(saved.value.draftDocument.conversion.primaryAction, null);

  const other = await createLandingPageProject(store, { userId: "user-a", title: "Outra", slug: "outra", projectId: null });
  if (!other.ok) return;
  const otherBrief = await saveConversionPageBrief(store, {
    userId: "user-a",
    landingPageProjectId: other.value.id,
    expectedRevision: other.value.draftRevision,
    brief: brief(),
  });
  if (!otherBrief.ok) return;
  assert.equal(otherBrief.value.draftDocument.strategy?.decisionJourney, undefined);

  const foreign = await saveVisitorDecisionJourney(store, {
    userId: "user-b",
    landingPageProjectId: page.id,
    expectedRevision: saved.value.draftRevision,
    decisionJourney: journey(),
  });
  assert.equal(foreign.ok, false);

  const conflict = await saveVisitorDecisionJourney(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    decisionJourney: journey({ trustNeed: "LOW" }),
  });
  assert.equal(conflict.ok, false);
  if (conflict.ok) return;
  assert.equal(conflict.code, "LANDING_PAGE_DRAFT_CONFLICT");

  const again = await saveVisitorDecisionJourney(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: saved.value.draftRevision,
    decisionJourney: journey({ trustNeed: "MEDIUM" }),
  });
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.value.draftDocument.strategy?.decisionJourney?.trustNeed, "MEDIUM");
  assert.equal(again.value.draftDocument.sections.length, 0);
  assert.equal(again.value.draftRevision, saved.value.draftRevision + 1);
});

test("troca de ação pede confirmação e o cancelamento preserva a ação", async () => {
  const { store, page } = await pageWithBrief({ type: "WHATSAPP", phone: "5511999990000" });
  assert.equal(page.draftDocument.conversion.primaryAction?.type, "WHATSAPP");
  const cancelled = await saveVisitorDecisionJourney(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    decisionJourney: journey({ preferredConversionMethod: "FORM" }),
  });
  assert.equal(cancelled.ok, false);
  if (cancelled.ok) return;
  assert.equal(cancelled.code, "ACTION_CHANGE_REQUIRES_CONFIRMATION");
  const current = store.rows.get(page.id);
  assert.equal(current?.draftRevision, page.draftRevision);
  assert.equal(current?.draftDocument.strategy?.brief?.primaryAction.type, "WHATSAPP");
  assert.equal(current?.draftDocument.strategy?.decisionJourney, undefined);

  const same = await saveVisitorDecisionJourney(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    decisionJourney: journey({ preferredConversionMethod: "WHATSAPP" }),
  });
  assert.equal(same.ok, true);
  if (!same.ok) return;
  assert.equal(same.value.draftDocument.strategy?.brief?.primaryAction.type, "WHATSAPP");
  assert.equal(same.value.draftDocument.conversion.primaryAction?.type, "WHATSAPP");

  const confirmed = await saveVisitorDecisionJourney(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: same.value.draftRevision,
    confirmActionChange: true,
    decisionJourney: journey({ preferredConversionMethod: "BOOKING" }),
  });
  assert.equal(confirmed.ok, true);
  if (!confirmed.ok) return;
  assert.equal(confirmed.value.draftDocument.strategy?.brief?.primaryAction.type, "FORM");
  assert.equal(confirmed.value.draftDocument.strategy?.decisionJourney?.preferredConversionMethod, "BOOKING");
  assert.equal(confirmed.value.draftDocument.conversion.primaryAction, null);
  assert.equal(confirmed.value.draftDocument.strategy?.brief?.offer.name, "Móveis planejados sob medida");
});

test("adaptador fica parcial, suficiente ou insuficiente sem chamar o motor", async () => {
  const { page } = await pageWithBrief();
  assert.equal(wireframeContextCompleteness(page.draftDocument), "PARTIAL");
  const partial = buildWireframeContextFromLandingPageProject(page.draftDocument);
  assert.equal(partial?.contextCompleteness, "PARTIAL");
  assert.equal(partial?.explanationNeed, "UNKNOWN");

  const empty = createEmptyLandingPageDocument();
  assert.equal(wireframeContextCompleteness(empty), "INSUFFICIENT");
  assert.equal(buildWireframeContextFromLandingPageProject(empty), null);

  const parsedUnknown = parseVisitorDecisionJourney(journey({ explanationNeed: "UNKNOWN", trustNeed: "UNKNOWN" }));
  assert.equal(parsedUnknown.ok, true);
  if (!parsedUnknown.ok || !page.draftDocument.strategy?.brief) return;
  const withUnknown = { ...page.draftDocument, strategy: { brief: page.draftDocument.strategy.brief, decisionJourney: parsedUnknown.journey } };
  assert.equal(wireframeContextCompleteness(withUnknown), "PARTIAL");

  const parsedComplete = parseVisitorDecisionJourney(journey({ preferredConversionMethod: "WHATSAPP" }));
  if (!parsedComplete.ok) return;
  const complete = { ...page.draftDocument, strategy: { brief: page.draftDocument.strategy.brief, decisionJourney: parsedComplete.journey } };
  const context = buildWireframeContextFromLandingPageProject(complete);
  assert.equal(context?.contextCompleteness, "SUFFICIENT");
  assert.equal(context?.explanationNeed, "MEDIUM");
  assert.equal(context?.trustNeed, "HIGH");
  assert.equal(context?.decisionComplexity, "HIGH");
  assert.deepEqual(context?.objections, ["prazo"]);
  assert.equal(context?.processNeedsExplanation, "YES");
  assert.equal(context?.proofSituation, "NEEDS_PROOF");
  assert.equal(context?.contactImportance, "HIGH");
  assert.equal(context?.preferredConversionMethod, "WHATSAPP");
  assert.equal(context?.primaryAction.type, "FORM");
  assert.equal(context?.primaryGoal, "REQUEST_QUOTE");
  assert.equal(page.draftDocument.sections.length, 0);

  const summary = visitorDecisionLessonSummary(page.id, parsedComplete.journey, "SUFFICIENT", "2026-10-20T00:00:00.000Z");
  assert.equal(summary.landingPageProjectId, page.id);
  assert.equal(summary.contextCompleteness, "SUFFICIENT");
  assert.equal("decisionStages" in summary, false);
  assert.equal("objectionAnalysis" in summary, false);

  const source = [
    "src/lib/landing-page/wireframe/from-brief.ts",
    "src/lib/landing-page/decision-journey.ts",
    "src/lib/learning/visitor-decision.ts",
    "src/components/learning/VisitorDecisionTool.tsx",
  ].map((file) => readFileSync(file, "utf8")).join("\n");
  assert.equal(source.includes("generateWireframePlan"), false);
  assert.equal(source.includes("applyGuidedWireframe"), false);
  assert.equal(source.includes("materializeWireframePlan"), false);
  assert.equal(/console\.(log|info|debug)/.test(source), false);
  assert.equal(source.includes("gtag"), false);
  assert.equal(readFileSync("src/app/sitemap.ts", "utf8").includes("jornada-do-visitante"), false);
});
