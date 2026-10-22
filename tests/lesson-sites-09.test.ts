import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPageRenderer } from "../src/components/landing-page/LandingPageRenderer";
import { LandingPageTrustEditor } from "../src/components/learning/LandingPageTrustEditor";
import { assessLesson } from "../src/lib/editorial/readiness";
import {
  applyLandingPageCopy,
  applyReviewedWireframe,
  approveLandingPageSectionCopy,
  confirmedProcessProof,
  createLandingPageProject,
  createMemoryLandingPageStore,
  landingPageMediaUploadsAvailable,
  nextTrustActions,
  proposeWireframeFromDocument,
  saveConversionPageBrief,
  saveLandingPageCopyFacts,
  saveLandingPageTrustPlan,
  saveVisitorDecisionJourney,
  toTrustPageView,
  trustInventorySummary,
  trustLessonResponseSchema,
  trustLessonResult,
} from "../src/lib/landing-page";
import { copyFactLines } from "../src/lib/landing-page/copy/facts";
import { buildCopyContextForSection } from "../src/lib/landing-page/copy/context";
import { createMemoryLandingPageMediaStore } from "../src/lib/landing-page/media/memory-store";
import { deleteLandingPageMedia } from "../src/lib/landing-page/media/service";
import { createFakeLandingPageMediaStorage } from "../src/lib/landing-page/media/storage";
import { landingPageMessage } from "../src/lib/landing-page/errors";
import { evaluateLandingPageTrust } from "../src/lib/landing-page/trust/evaluate";
import { markLandingPageTrustProofReady, removeLandingPageTrustProof, saveLandingPageTrustProof } from "../src/lib/landing-page/trust/service";
import type { TrustPageView } from "../src/lib/landing-page/trust/plan";
import { siteLesson09Blocks, siteLesson09Meta } from "../src/lib/learning/site-construa-confianca";
import { sitesCourseIsPubliclyVisible, sitesCourseSeed } from "../src/lib/learning/sites-course";
import type { LandingPageProjectView } from "../src/lib/landing-page/service";

const QUOTE = "FRASE-UNICA-DEPOIMENTO";

function storeFor() {
  return createMemoryLandingPageStore({
    courseIdBySlug: { "sites-que-convertem": "course-sites" },
    projects: [{ id: "project-a", userId: "user-a" }, { id: "project-b", userId: "user-b" }],
  });
}

function brief() {
  return {
    version: 1,
    offer: { name: "Móveis planejados sob medida" },
    audience: { description: "Quem já quer um projeto e precisa orçar" },
    problemOrContext: "Precisa decidir prazo, medida e confiança antes de contratar",
    primaryBenefit: "Saber como o orçamento acontece",
    pageGoal: "REQUEST_QUOTE",
    primaryAction: { type: "FORM", label: "Solicitar análise" },
    businessOutcome: "QUOTE",
    objections: ["prazo"],
    arrivalContext: { trafficSources: ["INSTAGRAM"], whatVisitorMayAlreadyKnow: "Viu um projeto no perfil" },
  };
}

function journey() {
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
    preferredConversionMethod: "FORM",
    decisionStages: [
      { type: "ARRIVAL", goal: "Reconhecer o tipo de projeto" },
      { type: "BUILD_TRUST", goal: "Confiar no processo" },
      { type: "ACT", goal: "Pedir orçamento" },
    ],
  };
}

async function withSections() {
  const store = storeFor();
  const media = createMemoryLandingPageMediaStore();
  const created = await createLandingPageProject(store, { userId: "user-a", title: "Página", slug: "pagina", projectId: "project-a" });
  if (!created.ok) throw new Error(created.code);
  const withBrief = await saveConversionPageBrief(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    brief: brief(),
  });
  if (!withBrief.ok) throw new Error(withBrief.code);
  const withJourney = await saveVisitorDecisionJourney(store, {
    userId: "user-a",
    landingPageProjectId: withBrief.value.id,
    expectedRevision: withBrief.value.draftRevision,
    decisionJourney: journey(),
  });
  if (!withJourney.ok) throw new Error(withJourney.code);
  const proposal = proposeWireframeFromDocument(withJourney.value.draftDocument);
  if (!proposal.ok) throw new Error(proposal.code);
  const applied = await applyReviewedWireframe(store, {
    userId: "user-a",
    landingPageProjectId: withJourney.value.id,
    expectedRevision: withJourney.value.draftRevision,
    reviewed: proposal.value.reviewed,
    idFactory: () => crypto.randomUUID(),
  });
  if (!applied.ok) throw new Error(applied.code);
  return { store, media, page: applied.value };
}

async function addProof(
  box: Awaited<ReturnType<typeof withSections>>,
  page: { id: string; draftRevision: number },
  proof: Record<string, unknown>,
  ready = true,
) {
  const saved = await saveLandingPageTrustProof(box.store, box.media, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    proof,
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) throw new Error("proof");
  const stored = saved.value.draftDocument.strategy?.copyFacts?.trustProofs?.at(-1);
  if (!ready) return saved.value;
  const marked = await markLandingPageTrustProofReady(box.store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: saved.value.draftRevision,
    proofId: stored?.id ?? "",
  });
  assert.equal(marked.ok, true);
  if (!marked.ok) throw new Error("ready");
  return marked.value;
}

type PageRef = {
  id: string;
  title: string;
  draftRevision: number;
  status: LandingPageProjectView["status"];
  draftDocument: LandingPageProjectView["draftDocument"];
};

function view(page: PageRef, media: TrustPageView["media"] = []): TrustPageView {
  return toTrustPageView(page, media);
}

test("aula 9 completa o conteúdo, os checkpoints e a transição", () => {
  assert.equal(siteLesson09Blocks.length, 33);
  assert.equal(siteLesson09Meta.estimatedMinutes, 30);
  assert.equal(siteLesson09Meta.priceCents, 3490);
  assert.equal(siteLesson09Meta.accessType, "PAID");
  assert.equal(siteLesson09Meta.commerceStatus, "NOT_FOR_SALE");
  assert.equal(siteLesson09Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 4);
  const checkpoints = siteLesson09Blocks.filter((block) => block.data.type === "CHECKPOINT");
  assert.equal(checkpoints[0]?.data.type === "CHECKPOINT" && checkpoints[0].data.correctOptionId, "nao");
  assert.equal(checkpoints[1]?.data.type === "CHECKPOINT" && checkpoints[1].data.correctOptionId, "sim");
  assert.equal(checkpoints[2]?.data.type === "CHECKPOINT" && checkpoints[2].data.correctOptionId, "nao");
  assert.equal(checkpoints[3]?.data.type === "CHECKPOINT" && checkpoints[3].data.correctOptionId, "sim");
  assert.match(JSON.stringify(siteLesson09Blocks[0] ? siteLesson09Blocks : []), /Você confiaria em uma página/);
  const tool = siteLesson09Blocks.find((block) => block.data.type === "TOOL");
  assert.equal(tool?.data.type === "TOOL" && tool.data.toolKey, "LANDING_PAGE_TRUST_V1");
  const result = siteLesson09Blocks.find((block) => block.data.type === "RESULT");
  assert.equal(result?.data.type === "RESULT" && result.data.title, "Plano de confiança da minha landing page");
  assert.match(JSON.stringify(siteLesson09Blocks), /Prepare sua página para o celular e uma boa experiência/);
  assert.match(JSON.stringify(siteLesson09Blocks), /principalmente no celular/);
  assert.equal(JSON.stringify(siteLesson09Blocks).includes("Gerar depoimento"), false);
  const assessment = assessLesson(
    { ...siteLesson09Meta, status: "PUBLISHED" },
    siteLesson09Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.equal(assessment.ready, true, assessment.issues.join(" "));
  assert.equal(sitesCourseSeed.status, "DRAFT");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(sitesCourseIsPubliclyVisible(), false);
  const lesson = sitesCourseSeed.modules.flatMap((module) => module.lessons).find((item) => item.slug === "construa-confianca");
  assert.equal(lesson?.plannedResult, "Plano de confiança da minha landing page");
  assert.equal(lesson?.plannedTool, "LANDING_PAGE_TRUST_V1");
  assert.equal(sitesCourseSeed.modules.flatMap((module) => module.lessons).some((item) => item.slug === "pagina-mobile-e-experiencia"), true);
});

test("inventário, tipos e caminho sem prova", async () => {
  const box = await withSections();
  let page: PageRef = box.page;
  page = await addProof(box, page, { type: "PORTFOLIO", title: "Cozinha entregue" });
  page = await addProof(box, page, { type: "CREDENTIAL", title: "Registro municipal", issuer: "Prefeitura" });
  page = await addProof(box, page, { type: "TESTIMONIAL", title: "Ana", quote: QUOTE, authorName: "Ana", consentConfirmed: false }, false);
  const summary = trustInventorySummary(page.draftDocument.strategy?.copyFacts?.trustProofs ?? []);
  assert.deepEqual(summary.owned, ["1 item de portfólio", "1 credencial"]);
  assert.equal(JSON.stringify(summary).includes("%"), false);
  assert.equal("score" in evaluateLandingPageTrust(page.draftDocument), false);
  const zero = await saveLandingPageTrustPlan(box.store, box.media, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    plan: { decision: "NO_PROOF_YET", selectedProofIds: [], reviewedProofTypes: [], linkTrust: false, addPortfolio: false, addTestimonials: false },
  });
  assert.equal(zero.ok, true);
  if (!zero.ok) return;
  assert.equal(zero.value.status, "READY_TO_PREVIEW");
  assert.equal(zero.value.draftDocument.strategy?.trustPlan?.decision, "NO_PROOF_YET");
  assert.ok((zero.value.draftDocument.strategy?.trustPlan?.nextActions.length ?? 0) > 0);
  const result = trustLessonResult({
    landingPageProjectId: zero.value.id,
    document: zero.value.draftDocument,
    mediaCount: 0,
    draftRevision: zero.value.draftRevision,
  });
  assert.equal(trustLessonResponseSchema.safeParse(result).success, true);
  assert.equal(JSON.stringify(result).includes(QUOTE), false);
  assert.equal(result.pendingConsentCount, 1);
  assert.equal(result.readyProofCount, 2);
  assert.equal(result.selectedProofCount, 0);
  const again = nextTrustActions({ readyTypes: ["PORTFOLIO", "CREDENTIAL"], pendingConsent: true, decision: "NO_PROOF_YET" });
  assert.deepEqual(again, nextTrustActions({ readyTypes: ["PORTFOLIO", "CREDENTIAL"], pendingConsent: true, decision: "NO_PROOF_YET" }));
  assert.match(again.join(" "), /autorização/);
});

test("depoimento, portfólio, demais provas e referências", async () => {
  const box = await withSections();
  let page: PageRef = box.page;
  const steps = await saveLandingPageCopyFacts(box.store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    facts: { version: 1, processSteps: [{ title: "Medição" }, { title: "Proposta" }] },
  });
  assert.equal(steps.ok, true);
  if (!steps.ok) return;
  page = steps.value;
  const process = confirmedProcessProof(page.draftDocument.strategy?.copyFacts?.processSteps?.length ?? 0);
  assert.ok(process);
  page = await addProof(box, page, process ?? {});
  assert.deepEqual(page.draftDocument.strategy?.copyFacts?.processSteps, [{ title: "Medição" }, { title: "Proposta" }]);
  assert.equal(confirmedProcessProof(0), null);
  const draft = await addProof(box, page, { type: "TESTIMONIAL", title: "Ana", quote: QUOTE, authorName: "Ana", consentConfirmed: false }, false);
  const draftId = draft.draftDocument.strategy?.copyFacts?.trustProofs?.find((proof) => proof.type === "TESTIMONIAL")?.id ?? "";
  const blocked = await markLandingPageTrustProofReady(box.store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: draft.draftRevision,
    proofId: draftId,
  });
  assert.equal(blocked.ok, false);
  page = await addProof(box, draft, { id: draftId, type: "TESTIMONIAL", title: "Ana", quote: QUOTE, authorName: "Ana", consentConfirmed: true });
  page = await addProof(box, page, { type: "PORTFOLIO", title: "Cozinha entregue", description: "Projeto medido" });
  page = await addProof(box, page, { type: "CASE", title: "Reforma", caseContext: "Apartamento pequeno", whatWasDone: "Projeto e instalação", result: "Ficou como combinado", resultSource: "USER_PROVIDED" });
  const storedCase = page.draftDocument.strategy?.copyFacts?.trustProofs?.find((proof) => proof.type === "CASE");
  assert.equal(storedCase?.result, "Ficou como combinado");
  assert.equal(storedCase?.resultSource, "USER_PROVIDED");
  page = await addProof(box, page, { type: "CREDENTIAL", title: "Curso real", issuer: "Escola" });
  page = await addProof(box, page, { type: "EXPERIENCE", title: "Experiência informada", description: "Trabalho com desenvolvimento web desde 2014." });
  page = await addProof(box, page, { type: "BUSINESS_INFORMATION", title: "Quem atende", description: "Atendimento com hora marcada." });
  const html = await saveLandingPageTrustProof(box.store, box.media, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    proof: { type: "OTHER", title: "<b>negrito</b>", description: "Texto" },
  });
  assert.equal(html.ok, false);
  page = await addProof(box, page, { type: "OTHER", title: "Como começa", description: "A conversa inicial é presencial." });
  const ids = page.draftDocument.strategy?.copyFacts?.trustProofs ?? [];
  const testimonialId = ids.find((proof) => proof.type === "TESTIMONIAL")?.id ?? "";
  const portfolioId = ids.find((proof) => proof.type === "PORTFOLIO")?.id ?? "";
  const credentialId = ids.find((proof) => proof.type === "CREDENTIAL")?.id ?? "";
  const forced = await saveLandingPageTrustPlan(box.store, box.media, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    plan: { decision: "SHOW_SELECTED", selectedProofIds: [credentialId], reviewedProofTypes: ["CREDENTIAL"], linkTrust: true, addPortfolio: false, addTestimonials: false },
  });
  assert.equal(forced.ok, true);
  if (!forced.ok) return;
  assert.equal(forced.value.draftDocument.sections.some((section) => section.type === "TESTIMONIALS"), false);
  const withSectionsPlan = await saveLandingPageTrustPlan(box.store, box.media, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: forced.value.draftRevision,
    plan: {
      decision: "SHOW_SELECTED",
      selectedProofIds: [testimonialId, portfolioId, credentialId],
      reviewedProofTypes: ["TESTIMONIAL", "PORTFOLIO", "CREDENTIAL"],
      linkTrust: true,
      addPortfolio: true,
      addTestimonials: true,
    },
  });
  assert.equal(withSectionsPlan.ok, true);
  if (!withSectionsPlan.ok) return;
  assert.equal(withSectionsPlan.value.draftDocument.sections.some((section) => section.type === "PORTFOLIO"), true);
  assert.equal(withSectionsPlan.value.draftDocument.sections.some((section) => section.type === "TESTIMONIALS"), true);
  const trust = withSectionsPlan.value.draftDocument.sections.find((section) => section.type === "TRUST");
  assert.equal(trust?.type === "TRUST" && trust.content.proofRefs?.includes(testimonialId), false);
  assert.equal(trust?.type === "TRUST" && trust.content.proofRefs?.includes(credentialId), true);
  const testimonials = withSectionsPlan.value.draftDocument.sections.find((section) => section.type === "TESTIMONIALS");
  assert.equal(testimonials?.type === "TESTIMONIALS" && testimonials.content.proofRefs.includes(testimonialId), true);
  assert.equal(JSON.stringify(withSectionsPlan.value.draftDocument.strategy?.trustPlan).includes(QUOTE), false);
  const inUse = await removeLandingPageTrustProof(box.store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: withSectionsPlan.value.draftRevision,
    proofId: credentialId,
  });
  assert.equal(inUse.ok, false);
  if (!inUse.ok) assert.equal(inUse.code, "LANDING_PAGE_TRUST_PROOF_IN_USE");
  const invalid = await saveLandingPageTrustPlan(box.store, box.media, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: withSectionsPlan.value.draftRevision,
    plan: { decision: "SHOW_SELECTED", selectedProofIds: ["prova-inexistente"], reviewedProofTypes: [], linkTrust: true, addPortfolio: false, addTestimonials: false },
  });
  assert.equal(invalid.ok, false);
  const conflict = await saveLandingPageTrustPlan(box.store, box.media, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: withSectionsPlan.value.draftRevision - 1,
    plan: { decision: "NO_PROOF_YET", selectedProofIds: [], reviewedProofTypes: [], linkTrust: false, addPortfolio: false, addTestimonials: false },
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.code, "LANDING_PAGE_DRAFT_CONFLICT");
});

test("mídia, cópia aprovada e preview seguro", async () => {
  const box = await withSections();
  let page: PageRef = box.page;
  const hero = page.draftDocument.sections.find((section) => section.type === "HERO");
  if (!hero) throw new Error("hero");
  const drafted = await applyLandingPageCopy(box.store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
    expectedRevision: page.draftRevision,
    content: hero.content,
  });
  assert.equal(drafted.ok, true);
  if (!drafted.ok) return;
  const approved = await approveLandingPageSectionCopy(box.store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    sectionId: hero.id,
    expectedRevision: drafted.value.draftRevision,
  });
  assert.equal(approved.ok, true);
  if (!approved.ok) return;
  page = approved.value;
  const mediaId = "media-portfolio";
  await box.media.insert({
    id: mediaId,
    landingPageProjectId: page.id,
    userId: "user-a",
    type: "PORTFOLIO_IMAGE",
    status: "READY",
    storageKey: "landing-media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    publicUrl: "https://media.example.test/landing-media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    mimeType: "image/png",
    fileSize: 68,
    width: 1,
    height: 1,
    altText: "Projeto de cozinha planejada concluído",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await box.media.insert({
    id: "media-alheia",
    landingPageProjectId: "outra-pagina",
    userId: "user-b",
    type: "PORTFOLIO_IMAGE",
    status: "READY",
    storageKey: "landing-media/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    publicUrl: null,
    mimeType: "image/png",
    fileSize: 68,
    width: 1,
    height: 1,
    altText: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const foreign = await saveLandingPageTrustProof(box.store, box.media, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    proof: { type: "PORTFOLIO", title: "Alheio", mediaIds: ["media-alheia"] },
  });
  assert.equal(foreign.ok, false);
  page = await addProof(box, page, { type: "PORTFOLIO", title: "Cozinha entregue", mediaIds: [mediaId] });
  const portfolioId = page.draftDocument.strategy?.copyFacts?.trustProofs?.find((proof) => proof.type === "PORTFOLIO")?.id ?? "";
  const theme = JSON.stringify(page.draftDocument.theme);
  const saved = await saveLandingPageTrustPlan(box.store, box.media, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    plan: {
      decision: "SHOW_SELECTED",
      selectedProofIds: [portfolioId],
      reviewedProofTypes: ["PORTFOLIO"],
      linkTrust: true,
      addPortfolio: true,
      addTestimonials: false,
      mediaAlt: { [mediaId]: "Projeto de cozinha planejada concluído" },
    },
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const heroAfter = saved.value.draftDocument.sections.find((section) => section.id === hero.id);
  assert.equal(heroAfter?.contentStatus, "APPROVED");
  assert.equal(JSON.stringify(saved.value.draftDocument.theme), theme);
  assert.equal(saved.value.status, "READY_TO_PREVIEW");
  const lines = copyFactLines(saved.value.draftDocument.strategy?.copyFacts);
  assert.equal(JSON.stringify(lines).includes("NEEDS_PROOF"), false);
  assert.equal(JSON.stringify(lines).includes(mediaId), false);
  const portfolioSection = saved.value.draftDocument.sections.find((section) => section.type === "PORTFOLIO");
  const context = buildCopyContextForSection({ document: saved.value.draftDocument, sectionId: portfolioSection?.id ?? "" });
  assert.equal(context.ok, false);
  if (!context.ok) assert.equal(context.reason, "UNSUPPORTED_SECTION");
  const markup = renderToStaticMarkup(createElement(LandingPageRenderer, {
    document: saved.value.draftDocument,
    mode: "PREVIEW",
    media: [{ id: mediaId, status: "READY", publicUrl: "https://media.example.test/landing-media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", altText: "Projeto de cozinha planejada concluído", width: 1, height: 1 }],
  }));
  assert.match(markup, /Cozinha entregue/);
  assert.match(markup, /data-preview-action="disabled"/);
  assert.equal(markup.includes("gtag"), false);
  assert.equal(markup.includes("Verificado"), false);
  const missing = renderToStaticMarkup(createElement(LandingPageRenderer, {
    document: saved.value.draftDocument,
    mode: "PREVIEW",
    media: [],
  }));
  assert.match(missing, /Mídia indisponível nesta visualização/);
  assert.equal(missing.includes("<img"), false);
  const removed = await deleteLandingPageMedia(box.store, box.media, createFakeLandingPageMediaStorage(), { userId: "user-a", mediaId });
  assert.equal(removed.ok, false);
  if (!removed.ok) {
    assert.equal(removed.code, "LANDING_PAGE_MEDIA_IN_USE");
    assert.equal(removed.message, landingPageMessage("LANDING_PAGE_MEDIA_IN_USE"));
  }
  assert.equal(landingPageMediaUploadsAvailable({ LANDING_PAGE_MEDIA_UPLOADS: "off" }), false);
  assert.equal(landingPageMediaUploadsAvailable({ BLOB_READ_WRITE_TOKEN: "presente" }), true);
  const editor = renderToStaticMarkup(createElement(LandingPageTrustEditor, { page: view(saved.value, [{ id: mediaId, status: "READY", altText: "Projeto de cozinha planejada concluído", referenced: true }]), uploadsAvailable: false }));
  assert.match(editor, /O envio de imagens está temporariamente indisponível/);
  assert.match(editor, /Você já possui/);
  assert.match(editor, /Pronto para usar/);
  assert.match(editor, /Esta imagem está sendo usada na página/);
  assert.equal(editor.includes("Gerar depoimento"), false);
  assert.equal(editor.includes("Verificado"), false);
  assert.equal(editor.includes("Confiança:"), false);
  const empty = renderToStaticMarkup(createElement(LandingPageTrustEditor, { page: { ...view(saved.value), setup: "NEED_SECTIONS" }, uploadsAvailable: false }));
  assert.match(empty, /\/aulas\/organize-as-secoes-da-pagina/);
  const source = [
    readFileSync(new URL("../src/components/learning/LandingPageTrustEditor.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("../src/components/learning/LandingPageTrustTool.tsx", import.meta.url), "utf8"),
  ].join("\n");
  assert.equal(source.includes("trackEvent"), false);
  assert.equal(source.includes("Gerar depoimento"), false);
  assert.equal(source.includes("openai"), false);
  const preview = readFileSync(new URL("../src/app/(app)/app/landing-pages/[landingPageProjectId]/preview/page.tsx", import.meta.url), "utf8");
  assert.match(preview, /requireSession/);
  assert.match(preview, /index: false/);
  assert.equal(preview.includes("trackEvent"), false);
  const adr = readFileSync(new URL("../docs/adr/landing-page-builder-v1.md", import.meta.url), "utf8");
  assert.match(adr, /strategy\.trustPlan/);
  assert.match(adr, /LIVE_MEDIA_STORE_READY=false/);
  assert.match(adr, /BEFORE_PUBLIC_RELEASE/);
});
