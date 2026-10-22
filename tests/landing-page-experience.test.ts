import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExperienceReviewPanel } from "../src/components/landing-page/ExperienceReviewPanel";
import { LandingPageFormBlock } from "../src/components/landing-page/LandingPageFormBlock";
import { LandingPageRenderer } from "../src/components/landing-page/LandingPageRenderer";
import { ResponsivePreviewFrame } from "../src/components/landing-page/ResponsivePreviewFrame";
import { conversionPageBriefSchema } from "../src/lib/landing-page/brief";
import { createEmptyLandingPageDocument, landingPageDocumentSchema, type LandingPageDocumentV1 } from "../src/lib/landing-page/document";
import { experienceChecklistFor } from "../src/lib/landing-page/experience/checklist";
import { evaluateLandingPageExperience } from "../src/lib/landing-page/experience/evaluate";
import { experienceReviewFixture, landingExperienceFixtureEnabled } from "../src/lib/landing-page/experience/fixture";
import { composeLandingPageExperienceReview, experienceReviewEffectiveStatus } from "../src/lib/landing-page/experience/review";
import { EXPERIENCE_ACTION_CODES, EXPERIENCE_CAPABILITIES_V1, EXPERIENCE_FINDING_CATEGORIES, EXPERIENCE_REVIEW_STATUSES, EXPERIENCE_SEVERITIES } from "../src/lib/landing-page/experience/schema";
import { saveLandingPageExperienceReview } from "../src/lib/landing-page/experience/service";
import { EXPERIENCE_VIEWPORT_IDS, EXPERIENCE_VIEWPORT_WIDTH } from "../src/lib/landing-page/experience/viewports";
import { createMemoryLandingPageStore } from "../src/lib/landing-page/memory-store";
import { createMemoryLandingPageMediaStore } from "../src/lib/landing-page/media/memory-store";
import { createLandingPageProject } from "../src/lib/landing-page/service";
import { saveLandingPageTrustPlan } from "../src/lib/landing-page/trust/plan";
import { applyReviewedWireframe, proposeWireframeFromDocument, saveConversionPageBrief, saveVisitorDecisionJourney } from "../src/lib/landing-page";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";
import { sitesCourseIsPubliclyVisible, sitesCourseSeed } from "../src/lib/learning/sites-course";
import type { LandingPageDocumentV1 as Document } from "../src/lib/landing-page/document";

const visual = { backgroundRole: "DEFAULT" as const, alignment: "LEFT" as const, emphasis: "NORMAL" as const };
const phone = { type: "WHATSAPP" as const, phone: "11999998888" };

function parse(document: LandingPageDocumentV1): Document {
  return landingPageDocumentSchema.parse(document);
}

function clean(): Document {
  const document = createEmptyLandingPageDocument();
  document.conversion.primaryAction = phone;
  document.sections = [
    { id: "hero", type: "HERO", variant: "default", order: 0, enabled: true, contentStatus: "APPROVED", content: { headline: "Móveis sob medida", primaryCta: phone }, settings: visual },
    { id: "problem", type: "PROBLEM", variant: "default", order: 1, enabled: true, contentStatus: "APPROVED", content: { heading: "A decisão trava", description: "Falta ver prazo e medida." }, settings: visual },
    { id: "solution", type: "SOLUTION", variant: "default", order: 2, enabled: true, contentStatus: "APPROVED", content: { heading: "O projeto anda", description: "A conversa organiza o próximo passo." }, settings: visual },
    { id: "benefits", type: "BENEFITS", variant: "default", order: 3, enabled: true, contentStatus: "APPROVED", content: { heading: "O que fica claro", items: [{ title: "Prazo", description: "O prazo entra na proposta." }] }, settings: visual },
    { id: "cta", type: "CTA", variant: "default", order: 4, enabled: true, contentStatus: "APPROVED", content: { heading: "Pedir conversa", action: phone }, settings: visual },
  ];
  return parse(document);
}

function codes(document: Document, media: Parameters<typeof evaluateLandingPageExperience>[1] = {}) {
  return evaluateLandingPageExperience(document, media).map((finding) => finding.code);
}

function readyInput(document: Document) {
  return {
    reviewedViewports: [...EXPERIENCE_VIEWPORT_IDS],
    checklist: experienceChecklistFor(document).map((item) => ({ id: item.id, confirmed: true })),
    userFindings: [],
    decisions: [],
  };
}

function storeFor() {
  return createMemoryLandingPageStore({
    courseIdBySlug: { "sites-que-convertem": "course-sites" },
    projects: [{ id: "project-a", userId: "user-a" }, { id: "project-b", userId: "user-b" }],
  });
}

async function projectWith(document: Document, status: "DRAFT" | "READY_TO_PREVIEW" = "READY_TO_PREVIEW") {
  const store = storeFor();
  const created = await createLandingPageProject(store, { userId: "user-a", title: "Página", slug: "pagina-experiencia", projectId: "project-a" });
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("project");
  const updated = await store.updateDraftAtomic({
    id: created.value.id,
    userId: "user-a",
    expectedRevision: created.value.draftRevision,
    document,
    status,
  });
  assert.equal(updated.ok, true);
  if (!updated.ok) throw new Error("draft");
  return { store, page: updated.record };
}

test("presets de viewport e o renderer não mudam com a largura", () => {
  assert.deepEqual(EXPERIENCE_VIEWPORT_WIDTH, { MOBILE_SMALL: 320, MOBILE: 375, TABLET: 768, DESKTOP: 1280 });
  const renderer = renderToStaticMarkup(createElement(LandingPageRenderer, { document: clean(), mode: "PREVIEW", media: [] }));
  assert.equal(renderer.includes("data-preview-toolbar"), false);
  assert.equal(renderer.includes("data-finding"), false);
  for (const id of EXPERIENCE_VIEWPORT_IDS) {
    const html = renderToStaticMarkup(createElement(ResponsivePreviewFrame, { sections: [{ id: "hero", type: "HERO" }], initialViewport: id, initialMode: "REVIEW" }, "conteudo-unico"));
    assert.match(html, new RegExp(`data-preview-width="${EXPERIENCE_VIEWPORT_WIDTH[id]}"`));
    assert.match(html, new RegExp(`data-preview-viewport="${id}"`));
    assert.match(html, /conteudo-unico/);
    assert.match(html, /data-preview-toolbar="viewport"/);
    assert.equal(html.includes("iPhone"), false);
  }
});

test("evaluate não grava o rascunho", async () => {
  const { page } = await projectWith(clean());
  const before = page.draftRevision;
  evaluateLandingPageExperience(page.draftDocument);
  const stored = await storeFor();
  assert.equal(before, page.draftRevision);
  assert.equal(readFileSync("src/lib/landing-page/experience/evaluate.ts", "utf8").includes("updateDraftAtomic"), false);
  assert.equal(stored.findByIdForUser.length > 0, true);
});

test("página válida não tem bloqueio e não produz nota", () => {
  const findings = evaluateLandingPageExperience(clean());
  assert.equal(findings.some((finding) => finding.severity === "BLOCKER"), false);
  const composed = composeLandingPageExperienceReview(clean(), 2, readyInput(clean()));
  assert.equal(composed.ok, true);
  if (!composed.ok) return;
  assert.equal(JSON.stringify(composed.review).includes("score"), false);
  assert.equal(JSON.stringify(composed.review).includes("/100"), false);
  assert.equal(composed.review.summary.headline, "Revisado");
});

test("placeholder principal bloqueia e rascunho pede atenção", () => {
  const placeholder = clean();
  const hero = placeholder.sections.find((section) => section.id === "hero");
  if (!hero) throw new Error("hero");
  hero.contentStatus = "PLACEHOLDER";
  const blocked = evaluateLandingPageExperience(placeholder);
  assert.equal(blocked.some((finding) => finding.code === "CORE_PLACEHOLDER" && finding.severity === "BLOCKER" && finding.source === "SYSTEM"), true);
  hero.contentStatus = "DRAFT";
  const draft = evaluateLandingPageExperience(placeholder);
  assert.equal(draft.some((finding) => finding.code === "CORE_DRAFT" && finding.severity === "ATTENTION"), true);
  assert.equal(draft.some((finding) => finding.code === "CORE_PLACEHOLDER"), false);
});

test("contraste, ação, mídia, texto longo, destaque, formulário, confiança e acesso", () => {
  const contrast = clean();
  contrast.theme = { ...contrast.theme, colors: { ...contrast.theme.colors, text: "#cccccc", background: "#d0d0d0" } };
  assert.equal(codes(contrast).includes("CONTRAST_BLOCKER"), true);

  const target = clean();
  target.strategy = {
    brief: conversionPageBriefSchema.parse({
      version: 1,
      offer: { name: "Móveis planejados sob medida" },
      audience: { description: "Quem já quer um projeto e precisa orçar" },
      problemOrContext: "Precisa decidir prazo, medida e confiança antes de contratar",
      primaryBenefit: "Saber como o orçamento acontece",
      pageGoal: "REQUEST_QUOTE",
      primaryAction: { type: "WHATSAPP" },
      businessOutcome: "QUOTE",
      objections: ["prazo"],
      arrivalContext: { trafficSources: ["INSTAGRAM"] },
    }),
  };
  assert.equal(codes(target).includes("ACTION_TARGET_MISSING"), true);
  assert.equal(evaluateLandingPageExperience(target).find((finding) => finding.code === "ACTION_TARGET_MISSING")?.actionCode, "CONFIGURE_ACTION");

  const media = clean();
  const hero = media.sections.find((section) => section.type === "HERO");
  if (!hero || hero.type !== "HERO") throw new Error("hero");
  hero.content.mediaRef = { mediaId: "foto", usage: "HERO" };
  assert.equal(codes(media, { media: [{ id: "foto", status: "FAILED", fileSize: 1000, altText: null }] }).includes("MEDIA_MISSING"), true);
  assert.equal(codes(media, { media: [{ id: "foto", status: "READY", fileSize: 1000, altText: null }] }).includes("MEDIA_ALT_MISSING"), true);

  const large = clean();
  const portfolio = {
    id: "portfolio",
    type: "PORTFOLIO" as const,
    variant: "default" as const,
    order: 8,
    enabled: true,
    contentStatus: "APPROVED" as const,
    content: { items: Array.from({ length: 9 }, (_, index) => ({ mediaRef: { mediaId: `foto-${index}`, usage: "PORTFOLIO" as const, altText: "Peça" } })) },
    settings: visual,
  };
  large.sections.push(portfolio);
  const largeCodes = codes(parse(large), {
    media: Array.from({ length: 9 }, (_, index) => ({ id: `foto-${index}`, status: "READY" as const, fileSize: 6 * 1024 * 1024, altText: "Peça" })),
  });
  assert.equal(largeCodes.includes("MEDIA_LARGE"), true);
  assert.equal(largeCodes.includes("MEDIA_COUNT"), true);
  assert.equal(evaluateLandingPageExperience(parse(large), { media: Array.from({ length: 9 }, (_, index) => ({ id: `foto-${index}`, status: "READY" as const, fileSize: 6 * 1024 * 1024, altText: "Peça" })) }).find((finding) => finding.code === "MEDIA_LARGE")?.actionCode, "REVIEW_MEDIA");

  const featured = clean();
  for (const section of featured.sections.slice(0, 4)) section.settings = { ...section.settings, emphasis: "FEATURED" };
  assert.equal(codes(featured).includes("FEATURED_DENSITY"), true);

  const long = clean();
  const longHero = long.sections.find((section) => section.type === "HERO");
  if (!longHero || longHero.type !== "HERO") throw new Error("hero");
  longHero.content.headline = "Oferta de móveis sob medida com prazo claro para quem vai contratar o projeto";
  assert.ok(longHero.content.headline.length > 72);
  assert.equal(codes(parse(long)).includes("HEADLINE_LONG"), true);

  const form = clean();
  form.sections.push({
    id: "form",
    type: "FORM",
    variant: "default",
    order: 6,
    enabled: true,
    contentStatus: "APPROVED",
    content: { heading: "Mensagem", fields: ["name", "email", "phone", "message"], consentEnabled: true },
    settings: visual,
  });
  const formCodes = codes(parse(form));
  assert.equal(formCodes.includes("FORM_MANY_FIELDS"), true);
  assert.equal(formCodes.includes("FORM_CONSENT_TEXT"), true);
  assert.equal(formCodes.includes("FORM_UNLABELED"), false);
  assert.equal(formCodes.includes("FORM_PLATFORM_UNAVAILABLE"), false);
  const formHtml = renderToStaticMarkup(createElement(LandingPageFormBlock, { sectionId: "form", fields: ["name", "email", "phone", "message"], heading: "Mensagem" }));
  assert.match(formHtml, /Nome/);
  assert.match(formHtml, /E-mail/);
  assert.match(formHtml, /Telefone/);
  assert.match(formHtml, /Mensagem/);

  const trust = clean();
  trust.strategy = { copyFacts: { version: 1, trustProofs: [{ id: "dep", type: "TESTIMONIAL", title: "Depoimento", quote: "O prazo foi cumprido.", authorName: "Ana", consentConfirmed: false, status: "READY_FOR_DISPLAY" }] } };
  trust.sections.push({ id: "testimonials", type: "TESTIMONIALS", variant: "default", order: 7, enabled: true, contentStatus: "APPROVED", content: { proofRefs: ["ausente"] }, settings: visual });
  assert.equal(codes(parse(trust)).includes("TRUST_REF_INVALID"), true);
  const consent = parse(trust);
  const testimonials = consent.sections.find((section) => section.type === "TESTIMONIALS");
  if (!testimonials || testimonials.type !== "TESTIMONIALS") throw new Error("testimonials");
  testimonials.content.proofRefs = ["dep"];
  assert.equal(codes(consent).includes("TESTIMONIAL_WITHOUT_CONSENT"), true);

  const pageHtml = renderToStaticMarkup(createElement(LandingPageRenderer, { document: clean(), mode: "PREVIEW", media: [] }));
  assert.match(pageHtml, /<h1/);
  assert.match(pageHtml, /Falar no WhatsApp/);
  assert.equal(codes(clean()).includes("EMPTY_ACTION_LABEL"), false);
  assert.equal(pageHtml.includes("data-preview-action=\"disabled\""), true);
});

test("status da revisão, adiamento, observação e reavaliação", async () => {
  const document = clean();
  assert.equal(experienceReviewEffectiveStatus(document, 1), "NOT_REVIEWED");
  const needs = composeLandingPageExperienceReview(document, 2, { reviewedViewports: ["MOBILE"], checklist: [], userFindings: [], decisions: [] });
  assert.equal(needs.ok, true);
  if (!needs.ok) return;
  assert.equal(needs.review.summary.status, "NEEDS_ADJUSTMENTS");
  const ready = composeLandingPageExperienceReview(document, 2, readyInput(document));
  assert.equal(ready.ok, true);
  if (!ready.ok) return;
  assert.equal(ready.review.summary.status, "READY_FOR_NEXT_STEP");

  const blocked = clean();
  const hero = blocked.sections.find((section) => section.id === "hero");
  if (!hero) throw new Error("hero");
  hero.contentStatus = "PLACEHOLDER";
  const blocker = evaluateLandingPageExperience(blocked).find((finding) => finding.code === "CORE_PLACEHOLDER");
  if (!blocker) throw new Error("blocker");
  const prevented = composeLandingPageExperienceReview(blocked, 2, { ...readyInput(blocked), decisions: [{ findingId: blocker.id, status: "DEFERRED" }] });
  assert.equal(prevented.ok, false);
  const reopened = composeLandingPageExperienceReview(blocked, 2, { ...readyInput(blocked), decisions: [{ findingId: blocker.id, status: "RESOLVED" }] });
  assert.equal(reopened.ok, true);
  if (!reopened.ok) return;
  assert.equal(reopened.review.findings.find((finding) => finding.id === blocker.id)?.status, "OPEN");
  assert.equal(reopened.review.summary.status, "NEEDS_ADJUSTMENTS");

  const noted = composeLandingPageExperienceReview(document, 2, {
    ...readyInput(document),
    userFindings: [{ id: "user:1", category: "RESPONSIVE", severity: "ATTENTION", message: "Botão parece escondido no celular.", viewport: "MOBILE" }],
  });
  assert.equal(noted.ok, true);
  if (!noted.ok) return;
  assert.equal(noted.review.findings.some((finding) => finding.source === "USER" && finding.status === "OPEN"), true);
  const deferred = composeLandingPageExperienceReview(document, 2, {
    ...readyInput(document),
    userFindings: [{ id: "user:1", category: "RESPONSIVE", severity: "ATTENTION", message: "Essa seção ficou longa." }],
    decisions: [{ findingId: "user:1", status: "DEFERRED", deferReason: "Vou encurtar na próxima leitura." }],
  });
  assert.equal(deferred.ok, true);
  if (!deferred.ok) return;
  assert.equal(deferred.review.findings.find((finding) => finding.id === "user:1")?.status, "DEFERRED");
  assert.equal(deferred.review.summary.status, "READY_FOR_NEXT_STEP");

  const { store, page } = await projectWith(blocked);
  const first = await saveLandingPageExperienceReview(store, null, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    review: readyInput(blocked),
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.value.draftDocument.experienceReview?.findings.some((finding) => finding.code === "CORE_PLACEHOLDER" && finding.status === "OPEN"), true);
  const fixed = structuredClone(first.value.draftDocument);
  const fixedHero = fixed.sections.find((section) => section.id === "hero");
  if (!fixedHero) throw new Error("hero");
  fixedHero.contentStatus = "APPROVED";
  const bumped = await store.updateDraftAtomic({ id: page.id, userId: "user-a", expectedRevision: first.value.draftRevision, document: fixed });
  assert.equal(bumped.ok, true);
  if (!bumped.ok) return;
  const second = await saveLandingPageExperienceReview(store, null, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: bumped.record.draftRevision,
    review: readyInput(fixed),
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.value.draftDocument.experienceReview?.findings.some((finding) => finding.code === "CORE_PLACEHOLDER"), false);
});

test("revisão antiga fica desatualizada e uma nova revisão acompanha a versão", async () => {
  const { store, page } = await projectWith(clean());
  const saved = await saveLandingPageExperienceReview(store, null, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    review: readyInput(clean()),
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.value.draftDocument.experienceReview?.reviewedDraftRevision, saved.value.draftRevision);
  assert.equal(experienceReviewEffectiveStatus(saved.value.draftDocument, saved.value.draftRevision), "READY_FOR_NEXT_STEP");
  const bumped = await store.updateDraftAtomic({
    id: page.id,
    userId: "user-a",
    expectedRevision: saved.value.draftRevision,
    document: saved.value.draftDocument,
  });
  assert.equal(bumped.ok, true);
  if (!bumped.ok) return;
  assert.equal(experienceReviewEffectiveStatus(bumped.record.draftDocument, bumped.record.draftRevision), "STALE");
  const again = await saveLandingPageExperienceReview(store, null, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: bumped.record.draftRevision,
    review: readyInput(bumped.record.draftDocument),
  });
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.value.draftDocument.experienceReview?.reviewedDraftRevision, again.value.draftRevision);
  assert.notEqual(experienceReviewEffectiveStatus(again.value.draftDocument, again.value.draftRevision), "STALE");
});

test("salvar a revisão exige o dono, respeita a revisão e preserva o trabalho anterior", async () => {
  const store = storeFor();
  const media = createMemoryLandingPageMediaStore();
  const created = await createLandingPageProject(store, { userId: "user-a", title: "Página", slug: "pagina", projectId: "project-a" });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const withBrief = await saveConversionPageBrief(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    brief: {
      version: 1,
      offer: { name: "Móveis planejados sob medida" },
      audience: { description: "Quem já quer um projeto e precisa orçar" },
      problemOrContext: "Precisa decidir prazo, medida e confiança antes de contratar",
      primaryBenefit: "Saber como o orçamento acontece",
      pageGoal: "REQUEST_QUOTE",
      primaryAction: { type: "FORM", label: "Solicitar análise" },
      businessOutcome: "QUOTE",
      objections: ["prazo"],
      arrivalContext: { trafficSources: ["INSTAGRAM"] },
    },
  });
  assert.equal(withBrief.ok, true);
  if (!withBrief.ok) return;
  const withJourney = await saveVisitorDecisionJourney(store, {
    userId: "user-a",
    landingPageProjectId: withBrief.value.id,
    expectedRevision: withBrief.value.draftRevision,
    decisionJourney: {
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
      decisionStages: [{ type: "ACT", goal: "Pedir orçamento" }],
    },
  });
  assert.equal(withJourney.ok, true);
  if (!withJourney.ok) return;
  const proposal = proposeWireframeFromDocument(withJourney.value.draftDocument);
  assert.equal(proposal.ok, true);
  if (!proposal.ok) return;
  const applied = await applyReviewedWireframe(store, {
    userId: "user-a",
    landingPageProjectId: withJourney.value.id,
    expectedRevision: withJourney.value.draftRevision,
    reviewed: proposal.value.reviewed,
    idFactory: () => crypto.randomUUID(),
  });
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  const trusted = await saveLandingPageTrustPlan(store, media, {
    userId: "user-a",
    landingPageProjectId: applied.value.id,
    expectedRevision: applied.value.draftRevision,
    plan: { decision: "NO_PROOF_YET", selectedProofIds: [], reviewedProofTypes: [], linkTrust: false, addPortfolio: false, addTestimonials: false },
  });
  assert.equal(trusted.ok, true);
  if (!trusted.ok) return;
  const before = trusted.value.draftDocument;
  const denied = await saveLandingPageExperienceReview(store, media, {
    userId: "user-b",
    landingPageProjectId: trusted.value.id,
    expectedRevision: trusted.value.draftRevision,
    review: { reviewedViewports: [], checklist: [], userFindings: [], decisions: [] },
  });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.code, "NOT_FOUND");
  const conflict = await saveLandingPageExperienceReview(store, media, {
    userId: "user-a",
    landingPageProjectId: trusted.value.id,
    expectedRevision: trusted.value.draftRevision - 1,
    review: { reviewedViewports: [], checklist: [], userFindings: [], decisions: [] },
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.code, "LANDING_PAGE_DRAFT_CONFLICT");
  const saved = await saveLandingPageExperienceReview(store, media, {
    userId: "user-a",
    landingPageProjectId: trusted.value.id,
    expectedRevision: trusted.value.draftRevision,
    review: { reviewedViewports: ["MOBILE", "DESKTOP"], checklist: [], userFindings: [{ category: "CONTENT", severity: "INFO", message: "Botão parece escondido no celular." }], decisions: [] },
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const after = saved.value.draftDocument;
  assert.equal(saved.value.status, "READY_TO_PREVIEW");
  assert.deepEqual(after.strategy?.brief, before.strategy?.brief);
  assert.deepEqual(after.strategy?.decisionJourney, before.strategy?.decisionJourney);
  assert.deepEqual(after.strategy?.wireframe, before.strategy?.wireframe);
  assert.deepEqual(after.theme, before.theme);
  assert.deepEqual(after.strategy?.trustPlan, before.strategy?.trustPlan);
  assert.deepEqual(after.strategy?.visualDirection, before.strategy?.visualDirection);
  assert.deepEqual(after.sections.map((section) => ({ content: section.content, contentStatus: section.contentStatus })), before.sections.map((section) => ({ content: section.content, contentStatus: section.contentStatus })));
  assert.equal(JSON.stringify(after.strategy?.experienceReview).includes("Botão parece"), false);
  assert.equal(JSON.stringify(after.experienceReview).includes("Botão parece"), true);
});

test("códigos de ação e capacidades da plataforma", () => {
  assert.deepEqual([...EXPERIENCE_ACTION_CODES], ["REVIEW_COPY", "REVIEW_THEME", "REVIEW_TRUST", "CONFIGURE_ACTION", "REVIEW_FORM", "REVIEW_MEDIA"]);
  assert.deepEqual(EXPERIENCE_CAPABILITIES_V1, { formsFunctional: true, publicationAvailable: true, measurementAvailable: true });
  const placeholder = clean();
  const hero = placeholder.sections.find((section) => section.id === "hero");
  if (!hero || hero.type !== "HERO") throw new Error("hero");
  hero.contentStatus = "PLACEHOLDER";
  assert.equal(evaluateLandingPageExperience(placeholder).find((finding) => finding.code === "CORE_PLACEHOLDER")?.actionCode, "REVIEW_COPY");
  const contrast = clean();
  contrast.theme = { ...contrast.theme, colors: { ...contrast.theme.colors, text: "#cccccc", background: "#d0d0d0" } };
  assert.equal(evaluateLandingPageExperience(contrast).find((finding) => finding.code === "CONTRAST_BLOCKER")?.actionCode, "REVIEW_THEME");
  const trust = clean();
  trust.sections.push({ id: "trust", type: "TRUST", variant: "default", order: 6, enabled: true, contentStatus: "APPROVED", content: { items: [], proofRefs: ["ausente"] }, settings: visual });
  assert.equal(evaluateLandingPageExperience(parse(trust)).find((finding) => finding.code === "TRUST_REF_INVALID")?.actionCode, "REVIEW_TRUST");
  const form = clean();
  form.sections.push({ id: "form", type: "FORM", variant: "default", order: 6, enabled: true, contentStatus: "APPROVED", content: { fields: ["name", "email", "phone", "message"] }, settings: visual });
  const parsedForm = parse(form);
  assert.equal(evaluateLandingPageExperience(parsedForm).find((finding) => finding.code === "FORM_MANY_FIELDS")?.actionCode, "REVIEW_FORM");
  assert.equal(evaluateLandingPageExperience(parsedForm).some((finding) => finding.code === "FORM_PLATFORM_UNAVAILABLE"), false);
  const platform = evaluateLandingPageExperience(parsedForm, { capabilities: { ...EXPERIENCE_CAPABILITIES_V1, formsFunctional: false } }).find((finding) => finding.code === "FORM_PLATFORM_UNAVAILABLE");
  assert.equal(platform?.severity, "INFO");
  assert.equal(platform?.platformLimitation, true);
  assert.equal(evaluateLandingPageExperience(parsedForm, { capabilities: { ...EXPERIENCE_CAPABILITIES_V1, formsFunctional: true } }).some((finding) => finding.code === "FORM_PLATFORM_UNAVAILABLE"), false);
  const heroMedia = clean();
  const mediaHero = heroMedia.sections.find((section) => section.type === "HERO");
  if (!mediaHero || mediaHero.type !== "HERO") throw new Error("hero");
  mediaHero.content.mediaRef = { mediaId: "foto", usage: "HERO" };
  assert.equal(evaluateLandingPageExperience(parse(heroMedia), { media: [] }).find((finding) => finding.code === "MEDIA_MISSING")?.actionCode, "REVIEW_MEDIA");
  const measured = clean();
  measured.measurement = { version: 1, primaryConversionEvent: null, enabledEvents: ["PAGE_VIEW"] };
  const measuredCodes = codes(measured).join(" ");
  assert.equal(measuredCodes.includes("PUBLICATION"), false);
  assert.equal(measuredCodes.includes("MEASUREMENT"), false);
});

test("fixture, privacidade e regressão do curso", () => {
  const fixture = experienceReviewFixture();
  assert.equal(fixture.document.sections.some((section) => section.type === "PORTFOLIO"), true);
  assert.equal(fixture.document.sections.some((section) => section.type === "TESTIMONIALS"), true);
  assert.equal(fixture.document.sections.some((section) => section.type === "HERO" && section.variant === "split"), true);
  assert.equal(landingExperienceFixtureEnabled("production"), false);
  assert.equal(landingExperienceFixtureEnabled("development"), true);
  const preview = readFileSync("src/app/(app)/app/landing-pages/[landingPageProjectId]/preview/page.tsx", "utf8");
  assert.match(preview, /index: false/);
  assert.match(preview, /LandingPageRenderer/);
  const devPage = readFileSync("src/app/dev/landing-experience-fixture/page.tsx", "utf8");
  assert.match(devPage, /notFound/);
  assert.match(devPage, /index: false/);
  const sources = [
    "src/lib/landing-page/experience/evaluate.ts",
    "src/lib/landing-page/experience/review.ts",
    "src/lib/landing-page/experience/service.ts",
    "src/components/landing-page/FindingCard.tsx",
    "src/components/landing-page/ExperienceReviewPanel.tsx",
  ].map((path) => readFileSync(path, "utf8")).join("\n");
  assert.equal(sources.includes("trackEvent"), false);
  assert.equal(sources.includes("console."), false);
  const urls = buildPublicSitemap("https://alexandrefeio.com.br", { courses: [], lessons: [] }).map((entry) => entry.url);
  assert.equal(urls.some((url) => url.includes("landing-experience-fixture")), false);
  assert.equal(urls.some((url) => url.includes("/p/")), false);
  assert.equal(existsSync("src/app/p/[slug]/page.tsx"), true);
  assert.equal(readFileSync("src/app/layout.tsx", "utf8").includes("GoogleTagManager"), false);
  assert.equal(existsSync("src/lib/learning/site-pagina-mobile-e-experiencia.ts"), true);
  assert.equal(existsSync("src/lib/learning/site-mensuracao-da-pagina.ts"), false);
  assert.equal(existsSync("src/lib/learning/site-construa-confianca.ts"), true);
  assert.equal(sitesCourseSeed.status, "DRAFT");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(sitesCourseIsPubliclyVisible(), false);
  assert.deepEqual([...EXPERIENCE_FINDING_CATEGORIES], ["RESPONSIVE", "READABILITY", "HIERARCHY", "ACTION", "FORM", "MEDIA", "CONTENT", "NAVIGATION", "ACCESSIBILITY", "PERFORMANCE_PERCEIVED"]);
  assert.deepEqual([...EXPERIENCE_SEVERITIES], ["INFO", "ATTENTION", "BLOCKER"]);
  assert.deepEqual([...EXPERIENCE_REVIEW_STATUSES], ["NOT_REVIEWED", "NEEDS_ADJUSTMENTS", "READY_FOR_NEXT_STEP", "STALE"]);
  const panel = renderToStaticMarkup(createElement(ExperienceReviewPanel, { document: clean(), draftRevision: 1 }));
  assert.match(panel, /Ainda não revisado/);
  assert.equal(panel.includes("87"), false);
});
