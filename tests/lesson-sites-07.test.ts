import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPageRenderer } from "../src/components/landing-page/LandingPageRenderer";
import { LandingPageCopyWorkspace } from "../src/components/learning/LandingPageCopyWorkspace";
import { assessLesson } from "../src/lib/editorial/readiness";
import {
  applyLandingPageCopy,
  applyReviewedWireframe,
  approveLandingPageSectionCopy,
  buildCopyContextForSection,
  copyCoverage,
  copyLessonResult,
  copySetup,
  createFakeCopyProvider,
  createLandingPageProject,
  createMemoryLandingPageStore,
  generateLandingPageCopySuggestions,
  getLandingPageProject,
  proposeWireframeFromDocument,
  saveConversionPageBrief,
  saveLandingPageCopyFacts,
  saveVisitorDecisionJourney,
  supportsCopyAssist,
  toCopyWorkspace,
} from "../src/lib/landing-page";
import { COPY_VARIANT_MAX, LANDING_PAGE_COPY_PROMPT_V1 } from "../src/lib/landing-page/copy/constants";
import { copyAssistUserMessage, copyOriginCounts, copyStatusLabel, sectionPurpose } from "../src/lib/landing-page/copy/lesson-flow";
import { resetCopyAssistRateLimit, consumeCopyAssistRateLimit } from "../src/lib/landing-page/copy/rate-limit";
import { siteLesson07Blocks, siteLesson07Meta } from "../src/lib/learning/site-mensagem-que-deixa-a-oferta-clara";
import { sitesCourseIsPubliclyVisible, sitesCourseSeed } from "../src/lib/learning/sites-course";
import type { LandingPageDocumentV1 } from "../src/lib/landing-page/document";
import type { LandingPageProjectView } from "../src/lib/landing-page/service";

function storeFor() {
  return createMemoryLandingPageStore({
    courseIdBySlug: { "sites-que-convertem": "course-sites" },
    projects: [{ id: "project-a", userId: "user-a" }, { id: "project-b", userId: "user-b" }],
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

function journey(method = "FORM") {
  return {
    version: 1,
    awarenessLevel: "KNOWS_THE_OFFER",
    explanationNeed: "HIGH",
    decisionComplexity: "HIGH",
    trustNeed: "HIGH",
    objectionAnalysis: [{ objection: "prazo", category: "TIMING", importance: "HIGH" }],
    processNeedsExplanation: "YES",
    proofSituation: "NEEDS_PROOF",
    contactImportance: "HIGH",
    preferredConversionMethod: method,
    decisionStages: [
      { type: "ARRIVAL", goal: "Reconhecer o tipo de projeto" },
      { type: "BUILD_TRUST", goal: "Confiar no processo" },
      { type: "ACT", goal: "Pedir orçamento" },
    ],
  };
}

async function readyPage(action?: Record<string, unknown>, method = "FORM") {
  const store = storeFor();
  const created = await createLandingPageProject(store, { userId: "user-a", title: "Página", slug: "pagina", projectId: "project-a" });
  if (!created.ok) throw new Error(created.code);
  const withBrief = await saveConversionPageBrief(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    brief: brief(action),
  });
  if (!withBrief.ok) throw new Error(withBrief.code);
  const withJourney = await saveVisitorDecisionJourney(store, {
    userId: "user-a",
    landingPageProjectId: withBrief.value.id,
    expectedRevision: withBrief.value.draftRevision,
    decisionJourney: journey(method),
  });
  if (!withJourney.ok) throw new Error(withJourney.code);
  return { store, page: withJourney.value };
}

async function withSections(action?: Record<string, unknown>, method = "FORM") {
  const { store, page } = await readyPage(action, method);
  const proposal = proposeWireframeFromDocument(page.draftDocument);
  if (!proposal.ok) throw new Error(proposal.code);
  const applied = await applyReviewedWireframe(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    reviewed: proposal.value.reviewed,
    idFactory: () => crypto.randomUUID(),
  });
  if (!applied.ok) throw new Error(applied.code);
  return { store, page: applied.value };
}

function sectionOf(page: LandingPageProjectView, type: string) {
  const section = page.draftDocument.sections.find((item) => item.type === type);
  if (!section) throw new Error(type);
  return section;
}

test("aula 7 completa com blocos, checkpoints, tool e transição", () => {
  assert.equal(siteLesson07Blocks.length, 32);
  assert.ok(siteLesson07Blocks.length >= 32 && siteLesson07Blocks.length <= 34);
  assert.equal(new Set(siteLesson07Blocks.map((block) => block.blockKey)).size, siteLesson07Blocks.length);
  assert.equal(siteLesson07Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 4);
  const tool = siteLesson07Blocks.find((block) => block.data.type === "TOOL");
  assert.equal(tool?.data.type === "TOOL" ? tool.data.toolKey : "", "LANDING_PAGE_COPY_ASSIST_V1");
  const result = siteLesson07Blocks.find((block) => block.data.type === "RESULT");
  assert.equal(result?.data.type === "RESULT" ? result.data.title : "", "Copy da minha landing page");
  const answers = siteLesson07Blocks.filter((block) => block.data.type === "CHECKPOINT").map((block) => block.data.type === "CHECKPOINT" ? block.data.correctOptionId : "");
  assert.deepEqual(answers, ["nao", "nao", "nao", "sim"]);
  const body = siteLesson07Blocks.map((block) => JSON.stringify(block.data)).join("\n");
  assert.match(body, /Use hierarquia visual para conduzir a atenção/);
  assert.doesNotMatch(body, /lorem ipsum|\[placeholder\]|escreva aqui|texto de exemplo|todo:/i);
  assert.equal(siteLesson07Meta.priceCents, 3990);
  assert.equal(siteLesson07Meta.estimatedMinutes, 35);
  assert.equal(siteLesson07Meta.commerceStatus, "NOT_FOR_SALE");
  assert.equal(siteLesson07Meta.accessType, "PAID");
  const assessment = assessLesson({
    title: siteLesson07Meta.title,
    summary: siteLesson07Meta.summary,
    publicPreview: siteLesson07Meta.publicPreview,
    estimatedMinutes: siteLesson07Meta.estimatedMinutes,
    accessType: "PAID",
    status: "PUBLISHED",
    priceCents: siteLesson07Meta.priceCents,
    commerceStatus: "NOT_FOR_SALE",
  }, siteLesson07Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })));
  assert.equal(assessment.ready, true, assessment.issues.join(" "));
  assert.equal(sitesCourseSeed.status, "DRAFT");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(sitesCourseIsPubliclyVisible(), false);
});

test("setup da copy exige projeto, brief, jornada e seções do dono", async () => {
  assert.equal(copySetup(null), "NEED_PROJECT");
  const store = storeFor();
  const created = await createLandingPageProject(store, { userId: "user-a", title: "Página", slug: "pagina", projectId: "project-a" });
  if (!created.ok) throw new Error(created.code);
  assert.equal(copySetup(created.value.draftDocument), "NEED_BRIEF");
  const withBrief = await saveConversionPageBrief(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    brief: brief(),
  });
  if (!withBrief.ok) throw new Error(withBrief.code);
  assert.equal(copySetup(withBrief.value.draftDocument), "NEED_JOURNEY");
  const { page } = await readyPage();
  assert.equal(copySetup(page.draftDocument), "NEED_SECTIONS");
  const structured = await withSections();
  assert.equal(copySetup(structured.page.draftDocument), "READY");
  const foreign = await generateLandingPageCopySuggestions(structured.store, {
    userId: "user-b",
    landingPageProjectId: structured.page.id,
    sectionId: sectionOf(structured.page, "HERO").id,
  }, createFakeCopyProvider());
  assert.equal(foreign.ok, false);
  const other = await createLandingPageProject(structured.store, { userId: "user-b", title: "Outra", slug: "outra", projectId: "project-b" });
  if (!other.ok) throw new Error(other.code);
  const leaked = await saveLandingPageCopyFacts(structured.store, {
    userId: "user-b",
    landingPageProjectId: structured.page.id,
    expectedRevision: structured.page.draftRevision,
    facts: { processSteps: [{ title: "Medir o ambiente" }] },
  });
  assert.equal(leaked.ok, false);
  assert.equal(other.value.draftDocument.strategy?.copyFacts, undefined);
});

test("seções em ordem, status, função e suporte de IA", async () => {
  const { page } = await withSections();
  const workspace = toCopyWorkspace(page);
  assert.deepEqual(workspace.sections.map((section) => section.order), [...page.draftDocument.sections].sort((left, right) => left.order - right.order).map((section) => section.order));
  assert.equal(copyStatusLabel("PLACEHOLDER"), "Ainda não escrito");
  assert.equal(copyStatusLabel("DRAFT"), "Em revisão");
  assert.equal(copyStatusLabel("APPROVED"), "Aprovado");
  assert.equal(workspace.sections[0]?.statusLabel, "Ainda não escrito");
  assert.equal(sectionPurpose("HERO"), "Deixar clara sua oferta e o próximo passo.");
  assert.equal(workspace.sections.find((section) => section.type === "HERO")?.purpose, sectionPurpose("HERO"));
  for (const type of ["HERO", "PROBLEM", "SOLUTION", "BENEFITS", "PROCESS", "TRUST", "FAQ", "CTA", "FORM"]) {
    assert.equal(supportsCopyAssist(type), true);
  }
  assert.equal(supportsCopyAssist("CONTACT"), false);
  assert.equal(supportsCopyAssist("FOOTER"), false);
  const markup = renderToStaticMarkup(createElement(LandingPageCopyWorkspace, { page: workspace }));
  assert.match(markup, /Ainda não escrito/);
  assert.match(markup, /Deixar clara sua oferta e o próximo passo/);
  assert.match(markup, /Sugerir textos com IA/);
  assert.match(markup, /Escrever por conta própria/);
  assert.match(markup, /Ver na minha página/);
  assert.match(markup, new RegExp(workspace.previewHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(markup, /Clara/);
  assert.doesNotMatch(markup, /gpt-6-luna|OpenAI|Gerar todos|Criando a copy perfeita|converte mais/);
});

test("gerar não grava, limita três opções e traduz falhas do provider", async () => {
  const { store, page } = await withSections();
  const hero = sectionOf(page, "HERO");
  const before = JSON.stringify(page.draftDocument.sections);
  const generated = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
  }, createFakeCopyProvider());
  assert.equal(generated.ok, true);
  if (!generated.ok) return;
  assert.ok(generated.value.suggestions.length <= COPY_VARIANT_MAX);
  assert.equal(generated.value.suggestions.length <= 3, true);
  const after = await getLandingPageProject(store, { userId: "user-a", landingPageProjectId: page.id });
  if (!after.ok) throw new Error(after.code);
  assert.equal(after.value.draftRevision, page.draftRevision);
  assert.equal(JSON.stringify(after.value.draftDocument.sections), before);
  const three = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
    variantCount: 3,
  }, createFakeCopyProvider({
    raw: {
      version: 1,
      promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
      sectionId: hero.id,
      sectionType: "HERO",
      suggestions: [0, 1, 2].map((index) => ({
        id: `opt-${index}`,
        content: { headline: `Oferta clara ${index}`, subheadline: "Para quem quer orçar o projeto" },
        rationale: "Prioriza clareza da oferta.",
      })),
      warnings: [],
      missingFacts: [],
    },
  }));
  assert.equal(three.ok, true);
  if (three.ok) assert.equal(three.value.suggestions.length, 3);
  const context = buildCopyContextForSection({ document: page.draftDocument, sectionId: hero.id });
  assert.equal(context.ok && context.context.intent, "CLEAR");
  const direct = buildCopyContextForSection({ document: page.draftDocument, sectionId: hero.id, intent: "DIRECT" });
  assert.equal(direct.ok && direct.context.intent, "DIRECT");
  const unavailable = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
  }, { id: "unavailable", modelId: "none", async generateCopySuggestion() { return { ok: false as const, code: "COPY_ASSIST_UNAVAILABLE" as const }; } });
  assert.equal(unavailable.ok, false);
  if (!unavailable.ok) assert.equal(copyAssistUserMessage(unavailable.code), "As sugestões automáticas estão temporariamente indisponíveis. Você ainda pode escrever e editar seu texto manualmente.");
  const failed = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
  }, createFakeCopyProvider({ fail: "COPY_ASSIST_PROVIDER_ERROR" }));
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(copyAssistUserMessage(failed.code), "Não foi possível gerar sugestões agora. Tente novamente ou escreva manualmente.");
  const limited = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
  }, createFakeCopyProvider({ fail: "COPY_ASSIST_RATE_LIMITED" }));
  assert.equal(limited.ok, false);
  if (!limited.ok) assert.equal(copyAssistUserMessage(limited.code), "Você fez várias gerações em pouco tempo. Aguarde alguns minutos e tente novamente.");
  resetCopyAssistRateLimit();
  for (let index = 0; index < 10; index += 1) assert.equal(await consumeCopyAssistRateLimit("user-limit"), true);
  assert.equal(await consumeCopyAssistRateLimit("user-limit"), false);
  resetCopyAssistRateLimit();
});

test("fatos faltantes são gravados em strategy.copyFacts e permitem nova sugestão", async () => {
  const { store, page } = await withSections();
  const process = sectionOf(page, "PROCESS");
  const trust = sectionOf(page, "TRUST");
  const faq = sectionOf(page, "FAQ");
  const missingProcess = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: process.id,
  }, createFakeCopyProvider());
  assert.equal(missingProcess.ok, true);
  if (!missingProcess.ok) return;
  assert.deepEqual(missingProcess.value.missingFacts, ["PROCESS_STEPS"]);
  const savedSteps = await saveLandingPageCopyFacts(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    facts: { processSteps: [{ title: "Medir o ambiente", description: "A visita confere as medidas." }] },
  });
  assert.equal(savedSteps.ok, true);
  if (!savedSteps.ok) return;
  assert.equal(savedSteps.value.draftRevision, page.draftRevision + 1);
  assert.equal(savedSteps.value.draftDocument.strategy?.copyFacts?.processSteps?.[0]?.title, "Medir o ambiente");
  const processCopy = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: process.id,
  }, createFakeCopyProvider());
  assert.equal(processCopy.ok, true);
  if (processCopy.ok) assert.equal(processCopy.value.suggestions.length > 0, true);
  const missingTrust = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: trust.id,
  }, createFakeCopyProvider());
  assert.equal(missingTrust.ok, true);
  if (missingTrust.ok) assert.ok(missingTrust.value.missingFacts.includes("TRUST_PROOF"));
  const savedTrust = await saveLandingPageCopyFacts(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: savedSteps.value.draftRevision,
    facts: { trustProofs: [{ type: "PORTFOLIO", title: "Projeto da cozinha entregue", description: "O ambiente foi medido e instalado." }] },
  });
  assert.equal(savedTrust.ok, true);
  if (!savedTrust.ok) return;
  const trustCopy = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: trust.id,
  }, createFakeCopyProvider());
  assert.equal(trustCopy.ok, true);
  if (trustCopy.ok) assert.equal(trustCopy.value.missingFacts.includes("TRUST_PROOF"), false);
  const missingFaq = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: faq.id,
  }, createFakeCopyProvider());
  assert.equal(missingFaq.ok, true);
  if (missingFaq.ok) assert.ok(missingFaq.value.missingFacts.includes("FAQ_ANSWER"));
  const savedFaq = await saveLandingPageCopyFacts(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: savedTrust.value.draftRevision,
    facts: { objectionAnswers: [{ objection: "prazo", answerFact: "O prazo é combinado na primeira conversa." }] },
  });
  assert.equal(savedFaq.ok, true);
  if (!savedFaq.ok) return;
  const faqCopy = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: faq.id,
  }, createFakeCopyProvider());
  assert.equal(faqCopy.ok, true);
  if (faqCopy.ok) assert.equal(faqCopy.value.suggestions.length > 0, true);
  const conflict = await saveLandingPageCopyFacts(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    facts: { processSteps: [{ title: "Outra etapa" }] },
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.code, "LANDING_PAGE_DRAFT_CONFLICT");
  const second = await createLandingPageProject(store, { userId: "user-a", title: "Segunda", slug: "segunda", projectId: "project-a" });
  if (!second.ok) throw new Error(second.code);
  assert.equal(second.value.draftDocument.strategy?.copyFacts, undefined);
});

test("aplicar sugestão deixa rascunho e preserva o destino da ação", async () => {
  const { store, page } = await withSections({ type: "WHATSAPP", phone: "5511999999999", message: "Quero falar sobre o projeto" }, "WHATSAPP");
  const hero = sectionOf(page, "HERO");
  const beforeIds = page.draftDocument.sections.map((section) => section.id);
  const phoneBefore = hero.type === "HERO" && hero.content.primaryCta?.type === "WHATSAPP" ? hero.content.primaryCta.phone : "";
  assert.equal(phoneBefore, "5511999999999");
  const applied = await applyLandingPageCopy(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
    expectedRevision: page.draftRevision,
    content: { headline: "Móveis planejados sob medida", subheadline: "O orçamento começa pela medida do ambiente", primaryCtaLabel: "Falar sobre meu projeto" },
    origin: "AI_ASSISTED",
  });
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.value.draftRevision, page.draftRevision + 1);
  assert.equal(applied.value.status, "READY_TO_PREVIEW");
  const next = sectionOf(applied.value, "HERO");
  assert.equal(next.contentStatus, "DRAFT");
  assert.equal(next.copyMeta?.origin, "AI_ASSISTED");
  assert.equal(next.type === "HERO" && next.content.primaryCta?.type, "WHATSAPP");
  if (next.type === "HERO" && next.content.primaryCta?.type === "WHATSAPP") assert.equal(next.content.primaryCta.phone, "5511999999999");
  assert.deepEqual(applied.value.draftDocument.sections.map((section) => section.id), beforeIds);
  const stale = await applyLandingPageCopy(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
    expectedRevision: page.draftRevision,
    content: { headline: "Outra headline clara" },
    origin: "MANUAL",
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, "LANDING_PAGE_DRAFT_CONFLICT");
});

test("texto manual vira rascunho e pode ser aprovado sem IA", async () => {
  const { store, page } = await withSections();
  const hero = sectionOf(page, "HERO");
  const blocked = await approveLandingPageSectionCopy(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
    expectedRevision: page.draftRevision,
  });
  assert.equal(blocked.ok, false);
  const manual = await applyLandingPageCopy(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
    expectedRevision: page.draftRevision,
    content: { headline: "Móveis planejados sob medida", subheadline: "Para quem precisa orçar sem sair de casa" },
    origin: "MANUAL",
  });
  assert.equal(manual.ok, true);
  if (!manual.ok) return;
  assert.equal(sectionOf(manual.value, "HERO").contentStatus, "DRAFT");
  assert.equal(sectionOf(manual.value, "HERO").copyMeta?.origin, "MANUAL");
  const incomplete = await applyLandingPageCopy(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
    expectedRevision: manual.value.draftRevision,
    content: { headline: "Móveis planejados sob medida" },
    origin: "MANUAL",
    unresolvedFacts: ["OFFER"],
  });
  assert.equal(incomplete.ok, true);
  if (!incomplete.ok) return;
  const cannotApprove = await approveLandingPageSectionCopy(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
    expectedRevision: incomplete.value.draftRevision,
  });
  assert.equal(cannotApprove.ok, false);
  const rewritten = await applyLandingPageCopy(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
    expectedRevision: incomplete.value.draftRevision,
    content: { headline: "Móveis planejados sob medida", subheadline: "Para quem precisa orçar sem sair de casa" },
    origin: "MANUAL",
  });
  assert.equal(rewritten.ok, true);
  if (!rewritten.ok) return;
  const approved = await approveLandingPageSectionCopy(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
    expectedRevision: rewritten.value.draftRevision,
  });
  assert.equal(approved.ok, true);
  if (!approved.ok) return;
  assert.equal(sectionOf(approved.value, "HERO").contentStatus, "APPROVED");
  const edited = await applyLandingPageCopy(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
    expectedRevision: approved.value.draftRevision,
    content: { headline: "Móveis planejados sob medida", subheadline: "O próximo passo é pedir a análise" },
    origin: "MANUAL",
  });
  assert.equal(edited.ok, true);
  if (!edited.ok) return;
  assert.equal(sectionOf(edited.value, "HERO").contentStatus, "DRAFT");
  const again = await approveLandingPageSectionCopy(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
    expectedRevision: edited.value.draftRevision,
  });
  assert.equal(again.ok, true);
});

test("cobertura exige as seções principais presentes e o resultado não copia o texto", async () => {
  const { store, page } = await withSections();
  const core = ["HERO", "PROBLEM", "SOLUTION", "BENEFITS", "CTA"] as const;
  for (const type of core) assert.ok(page.draftDocument.sections.some((section) => section.type === type));
  let current = page;
  const contents: Record<string, unknown> = {
    HERO: { headline: "Móveis planejados sob medida", subheadline: "O orçamento começa pela medida do ambiente", primaryCtaLabel: "Solicitar análise" },
    PROBLEM: { heading: "Antes de contratar", description: "Precisa decidir prazo, medida e confiança." },
    SOLUTION: { heading: "Móveis planejados sob medida", description: "O orçamento responde ao que você precisa decidir." },
    BENEFITS: { heading: "O que fica claro", items: [{ title: "Orçamento compreensível", description: "Saber como o orçamento acontece" }] },
    CTA: { heading: "Peça a análise", description: "O próximo passo é solicitar a análise.", buttonLabel: "Solicitar análise" },
  };
  for (const [index, type] of core.entries()) {
    const saved = await applyLandingPageCopy(store, {
      userId: "user-a",
      landingPageProjectId: page.id,
      sectionId: sectionOf(current, type).id,
      expectedRevision: current.draftRevision,
      content: contents[type],
      origin: index === 0 ? "AI_ASSISTED" : "MANUAL",
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    const approved = await approveLandingPageSectionCopy(store, {
      userId: "user-a",
      landingPageProjectId: page.id,
      sectionId: sectionOf(saved.value, type).id,
      expectedRevision: saved.value.draftRevision,
    });
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    current = approved.value;
  }
  const coverage = copyCoverage(current.draftDocument);
  assert.equal(coverage.coreComplete, true);
  assert.equal(coverage.requiredCore, core.length);
  assert.equal(coverage.approvedCore, core.length);
  assert.equal(coverage.pendingOptional, true);
  assert.equal(sectionOf(current, "TRUST").contentStatus, "PLACEHOLDER");
  assert.equal(sectionOf(current, "PROCESS").contentStatus, "PLACEHOLDER");
  const withoutHero = { ...current.draftDocument, sections: current.draftDocument.sections.filter((section) => section.type !== "HERO") };
  assert.equal(copyCoverage(withoutHero).coreComplete, false);
  const withoutProblem = { ...current.draftDocument, sections: current.draftDocument.sections.filter((section) => section.type !== "PROBLEM") };
  assert.equal(copyCoverage(withoutProblem).coreComplete, true);
  const result = copyLessonResult({
    landingPageProjectId: current.id,
    document: current.draftDocument,
    draftRevision: current.draftRevision,
    completedAt: "2026-10-21T00:00:00.000Z",
  });
  assert.equal(result.landingPageProjectId, current.id);
  assert.equal(result.draftRevision, current.draftRevision);
  assert.equal(result.aiAssistedSectionCount, 1);
  assert.equal(result.manualSectionCount, 4);
  assert.equal(JSON.stringify(result).includes("O orçamento começa pela medida do ambiente"), false);
  assert.deepEqual(copyOriginCounts(current.draftDocument.sections), { aiAssistedSectionCount: 1, manualSectionCount: 4 });
  const preview = renderToStaticMarkup(createElement(LandingPageRenderer, { document: current.draftDocument, mode: "PREVIEW" }));
  assert.match(preview, /Em revisão|Móveis planejados sob medida/);
  assert.match(preview, /data-preview-action="disabled"/);
  assert.doesNotMatch(preview, /gtag|trackEvent/);
  const approvedHero = sectionOf(current, "HERO");
  assert.equal(approvedHero.contentStatus, "APPROVED");
  assert.doesNotMatch(preview, /data-copy-badge="draft"/);
  const snapshot = JSON.stringify(current.draftDocument);
  renderToStaticMarkup(createElement(LandingPageRenderer, { document: current.draftDocument, mode: "PREVIEW" }));
  assert.equal(JSON.stringify(current.draftDocument), snapshot);
  const draftOnly = await applyLandingPageCopy(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: sectionOf(current, "PROBLEM").id,
    expectedRevision: current.draftRevision,
    content: { heading: "O contexto do orçamento", description: "A decisão envolve prazo, medida e confiança." },
    origin: "MANUAL",
  });
  assert.equal(draftOnly.ok, true);
  if (!draftOnly.ok) return;
  const draftMarkup = renderToStaticMarkup(createElement(LandingPageRenderer, { document: draftOnly.value.draftDocument, mode: "PREVIEW" }));
  assert.match(draftMarkup, /Em revisão/);
  assert.match(draftMarkup, /data-copy-badge="draft"/);
});

test("sugestão inventada não entra e não existe geração da página inteira", async () => {
  const { store, page } = await withSections();
  const hero = sectionOf(page, "HERO");
  const invented = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
  }, createFakeCopyProvider({
    raw: {
      version: 1,
      promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
      sectionId: hero.id,
      sectionType: "HERO",
      suggestions: [
        { id: "bad-1", content: { headline: "Mais de 500 clientes recomendam" }, rationale: "Esta opção tende a converter mais." },
        { id: "bad-2", content: { headline: "Resultado garantido e certificado" } },
      ],
      warnings: [],
      missingFacts: [],
    },
  }));
  assert.equal(invented.ok, false);
  const reread = await getLandingPageProject(store, { userId: "user-a", landingPageProjectId: page.id });
  if (!reread.ok) throw new Error(reread.code);
  assert.equal(reread.value.draftRevision, page.draftRevision);
  const service = readFileSync(new URL("../src/lib/landing-page/copy/service.ts", import.meta.url), "utf8");
  const tool = readFileSync(new URL("../src/components/learning/LandingPageCopyWorkspace.tsx", import.meta.url), "utf8");
  const lesson = readFileSync(new URL("../src/lib/learning/landing-page-copy.ts", import.meta.url), "utf8");
  const limiter = readFileSync(new URL("../src/lib/landing-page/copy/rate-limit.ts", import.meta.url), "utf8");
  assert.equal(service.includes("generateAll"), false);
  assert.equal(tool.includes("Gerar todos"), false);
  assert.match(lesson, /generateLandingPageCopySuggestions/);
  assert.match(lesson, /applyLandingPageCopy/);
  assert.match(lesson, /approveLandingPageSectionCopy/);
  assert.match(lesson, /saveLandingPageCopyFacts/);
  assert.match(limiter, /bindDurableRateLimit/);
  assert.equal(limiter.includes("new Map"), false);
  assert.equal(tool.includes("analytics"), false);
  const ignored = page.draftDocument satisfies LandingPageDocumentV1;
  assert.ok(ignored.sections.length > 0);
});
