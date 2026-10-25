import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FindingCard } from "../src/components/landing-page/FindingCard";
import { ResponsivePreviewToolbar } from "../src/components/landing-page/ResponsivePreviewToolbar";
import { LandingPageExperienceEditor } from "../src/components/learning/LandingPageExperienceEditor";
import { assessLesson } from "../src/lib/editorial/readiness";
import { lessonBlockDataSchema, TOOL_KEYS } from "../src/lib/learning/blocks";
import { siteLesson10Blocks, siteLesson10Meta } from "../src/lib/learning/site-pagina-mobile-e-experiencia";
import { sitesCourseIsPubliclyVisible, sitesCourseSeed } from "../src/lib/learning/sites-course";
import { createEmptyLandingPageDocument, landingPageDocumentSchema, type LandingPageDocumentV1 } from "../src/lib/landing-page/document";
import { experienceChecklistFor } from "../src/lib/landing-page/experience/checklist";
import { evaluateLandingPageExperience } from "../src/lib/landing-page/experience/evaluate";
import { EXPERIENCE_CAPABILITIES_V1 } from "../src/lib/landing-page/experience/schema";
import {
  EXPERIENCE_DEFER_COPY,
  EXPERIENCE_RESULT_TITLE,
  EXPERIENCE_STALE_COPY,
  experienceActionLink,
  experienceLessonResult,
  experienceReviewProgress,
  experienceViewportLabel,
  groupExperienceFindings,
  sectionTypeLabel,
  toExperiencePageView,
} from "../src/lib/landing-page/experience/lesson-flow";
import { composeLandingPageExperienceReview, experienceReviewEffectiveStatus, type ExperienceReviewInput } from "../src/lib/landing-page/experience/review";
import { saveLandingPageExperienceReview } from "../src/lib/landing-page/experience/service";
import { EXPERIENCE_VIEWPORT_IDS } from "../src/lib/landing-page/experience/viewports";
import { createMemoryLandingPageStore } from "../src/lib/landing-page/memory-store";
import { createLandingPageProject } from "../src/lib/landing-page/service";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";

const visual = { backgroundRole: "DEFAULT" as const, alignment: "LEFT" as const, emphasis: "NORMAL" as const };
const phone = { type: "WHATSAPP" as const, phone: "11999998888" };

function parse(document: LandingPageDocumentV1) {
  return landingPageDocumentSchema.parse(document);
}

function clean() {
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

function readyInput(document: LandingPageDocumentV1, extra: Partial<ExperienceReviewInput> = {}): ExperienceReviewInput {
  return {
    reviewedViewports: [...EXPERIENCE_VIEWPORT_IDS],
    checklist: experienceChecklistFor(document).map((item) => ({ id: item.id, confirmed: true })),
    userFindings: [],
    decisions: [],
    ...extra,
  };
}

function storeFor() {
  return createMemoryLandingPageStore({
    courseIdBySlug: { "sites-que-convertem": "course-sites" },
    projects: [{ id: "project-a", userId: "user-a" }, { id: "project-b", userId: "user-b" }],
  });
}

async function projectWith(document: LandingPageDocumentV1) {
  const store = storeFor();
  const created = await createLandingPageProject(store, { userId: "user-a", title: "Página", slug: "pagina-aula-10", projectId: "project-a" });
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("project");
  const updated = await store.updateDraftAtomic({
    id: created.value.id,
    userId: "user-a",
    expectedRevision: created.value.draftRevision,
    document,
    status: "READY_TO_PREVIEW",
  });
  assert.equal(updated.ok, true);
  if (!updated.ok) throw new Error("draft");
  return { store, page: updated.record };
}

test("aula 10 completa, com ferramenta e transição para a aula 11", () => {
  assert.equal(siteLesson10Blocks.length >= 31 && siteLesson10Blocks.length <= 33, true);
  assert.equal(siteLesson10Blocks.length, 33);
  assert.equal(siteLesson10Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 4);
  const tool = siteLesson10Blocks.find((block) => block.data.type === "TOOL");
  const result = siteLesson10Blocks.find((block) => block.data.type === "RESULT");
  assert.equal(tool?.data.type === "TOOL" && tool.data.toolKey, "LANDING_PAGE_EXPERIENCE_REVIEW_V1");
  assert.equal(result?.data.type === "RESULT" && result.data.title, EXPERIENCE_RESULT_TITLE);
  assert.equal(siteLesson10Meta.estimatedMinutes, 30);
  assert.equal(siteLesson10Meta.accessType, "PAID");
  assert.equal(siteLesson10Meta.priceCents, 3490);
  assert.equal(siteLesson10Meta.commerceStatus, "NOT_FOR_SALE");
  const text = siteLesson10Blocks.map((block) => JSON.stringify(block.data)).join("\n");
  assert.match(text, /Uma página pode parecer ótima no notebook de quem criou e ainda ser difícil de usar no celular/);
  assert.match(text, /Agora sua landing page não foi apenas construída — ela foi revisada como uma experiência/);
  assert.match(text, /Configure o que precisa ser medido/);
  assert.match(text, /Na próxima etapa, vamos definir como você saberá se as ações importantes realmente aconteceram/);
  assert.equal(text.includes("Lighthouse"), false);
  assert.equal(text.includes("PageSpeed"), false);
  assert.equal(text.toLowerCase().includes("wcag"), false);
  assert.equal(text.includes("/100"), false);
  for (const block of siteLesson10Blocks) assert.equal(lessonBlockDataSchema.safeParse(block.data).success, true);
  const assessment = assessLesson(
    { ...siteLesson10Meta, status: "PUBLISHED" },
    siteLesson10Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.equal(assessment.ready, true, assessment.issues.join(" "));
  const checkpoints = siteLesson10Blocks.filter((block) => block.data.type === "CHECKPOINT");
  assert.equal(checkpoints[0]?.data.type === "CHECKPOINT" && checkpoints[0].data.correctOptionId, "nao");
  assert.equal(checkpoints[1]?.data.type === "CHECKPOINT" && checkpoints[1].data.correctOptionId, "nao");
  assert.equal(checkpoints[2]?.data.type === "CHECKPOINT" && checkpoints[2].data.correctOptionId, "sim");
  assert.equal(checkpoints[3]?.data.type === "CHECKPOINT" && checkpoints[3].data.correctOptionId, "nao");
  const lesson = sitesCourseSeed.modules.flatMap((module) => module.lessons).find((item) => item.slug === "pagina-mobile-e-experiencia");
  assert.equal(lesson?.plannedTool, "LANDING_PAGE_EXPERIENCE_REVIEW_V1");
  assert.equal(lesson?.plannedResult, EXPERIENCE_RESULT_TITLE);
  assert.equal(sitesCourseSeed.status, "PUBLISHED");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(sitesCourseIsPubliclyVisible(), true);
  assert.equal(existsSync("src/lib/learning/site-mensuracao-da-pagina.ts"), false);
  assert.equal((TOOL_KEYS as readonly string[]).includes("LANDING_PAGE_EXPERIENCE_REVIEW_V1"), true);
  assert.equal((TOOL_KEYS as readonly string[]).includes("LANDING_PAGE_MEASUREMENT_V1"), false);
  const editor = readFileSync("src/components/learning/LandingPageExperienceEditor.tsx", "utf8");
  assert.match(editor, /LandingPageRenderer/);
  assert.match(editor, /initialMode="REVIEW"/);
  assert.equal(editor.includes("getPrisma"), false);
  assert.equal(editor.includes("@/lib/learning/actions"), false);
  assert.equal(editor.toLowerCase().includes("score"), false);
  assert.equal(readFileSync("src/lib/learning/landing-page-experience.ts", "utf8").includes("console."), false);
});

test("requisitos, viewports, findings e capacidades da revisão", async () => {
  const empty = toExperiencePageView(
    { ...(await projectWith(parse(createEmptyLandingPageDocument()))).page, draftDocument: parse(createEmptyLandingPageDocument()) },
    [],
  );
  assert.equal(empty.setup, "NO_SECTIONS");
  const noSections = renderToStaticMarkup(createElement(LandingPageExperienceEditor, { page: empty, onSave: async () => undefined }));
  assert.match(noSections, /organize-as-secoes-da-pagina/);

  const { store, page } = await projectWith(clean());
  const view = toExperiencePageView(page, []);
  assert.equal(view.setup, "READY");
  assert.equal(view.status, "READY_TO_PREVIEW");
  const overview = renderToStaticMarkup(createElement(LandingPageExperienceEditor, { page: view, onSave: async () => undefined }));
  assert.match(overview, /não enviam nada/);
  assert.match(overview, /Celular pequeno/);
  assert.match(overview, /Viewports revisados/);
  const stalePage = { ...view, effectiveStatus: "STALE" as const };
  const stale = renderToStaticMarkup(createElement(LandingPageExperienceEditor, { page: stalePage, onSave: async () => undefined }));
  assert.match(stale, new RegExp(EXPERIENCE_STALE_COPY));
  assert.match(stale, /Revisar novamente/);

  const denied = await saveLandingPageExperienceReview(store, null, {
    userId: "user-b",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    review: readyInput(clean()),
  });
  assert.equal(denied.ok, false);

  const checklist = experienceChecklistFor(clean());
  for (const viewport of EXPERIENCE_VIEWPORT_IDS) {
    assert.equal(checklist.some((item) => item.viewport === viewport), true);
  }
  assert.equal(checklist.find((item) => item.id === "mobile-form")?.applicable, false);
  assert.equal(checklist.find((item) => item.id === "mobile-faq")?.applicable, false);

  const ready = composeLandingPageExperienceReview(clean(), 3, readyInput(clean()));
  assert.equal(ready.ok, true);
  if (!ready.ok) return;
  assert.equal(ready.review.summary.status, "READY_FOR_NEXT_STEP");
  assert.equal(ready.summary.userFindingCount, 0);

  const three = composeLandingPageExperienceReview(clean(), 3, { ...readyInput(clean()), reviewedViewports: ["MOBILE_SMALL", "MOBILE", "TABLET"] });
  assert.equal(three.ok && three.review.summary.status, "NEEDS_ADJUSTMENTS");

  const placeholder = clean();
  const hero = placeholder.sections[0];
  if (!hero) throw new Error("hero");
  hero.contentStatus = "PLACEHOLDER";
  const blocked = composeLandingPageExperienceReview(parse(placeholder), 3, readyInput(parse(placeholder)));
  assert.equal(blocked.ok, true);
  if (!blocked.ok) return;
  assert.equal(blocked.review.findings.some((finding) => finding.code === "CORE_PLACEHOLDER" && finding.severity === "BLOCKER"), true);
  assert.equal(blocked.review.summary.status, "NEEDS_ADJUSTMENTS");
  assert.match(blocked.review.findings.find((finding) => finding.code === "CORE_PLACEHOLDER")?.message ?? "", /conteúdo provisório/);
  assert.equal(experienceActionLink("REVIEW_COPY")?.href, "/aulas/mensagem-que-deixa-a-oferta-clara");
  assert.equal(experienceActionLink("REVIEW_THEME")?.href, "/aulas/hierarquia-visual-e-atencao");
  assert.equal(experienceActionLink("REVIEW_TRUST")?.href, "/aulas/construa-confianca");
  assert.equal(experienceActionLink("REVIEW_MEDIA")?.href, "/aulas/construa-confianca");
  assert.equal(experienceActionLink("CONFIGURE_ACTION")?.href, "/aulas/oferta-publico-acao-principal");
  assert.equal(experienceActionLink("REVIEW_FORM")?.href, null);
  assert.equal(sectionTypeLabel("HERO"), "Abertura");
  assert.equal(experienceViewportLabel("MOBILE_SMALL"), "Celular pequeno");

  const groups = groupExperienceFindings(blocked.review.findings);
  assert.equal(groups.blockers.length > 0, true);
  assert.equal(groups.blockers.every((finding) => finding.severity === "BLOCKER"), true);
  const card = renderToStaticMarkup(createElement(FindingCard, { finding: groups.blockers[0]! }));
  assert.match(card, /Precisa ser resolvido/);
  assert.match(card, /break-words/);
  assert.equal(card.includes(">BLOCKER<"), false);

  const draft = clean();
  draft.sections[0]!.contentStatus = "DRAFT";
  const attention = evaluateLandingPageExperience(parse(draft)).find((finding) => finding.code === "CORE_DRAFT");
  assert.equal(attention?.severity, "ATTENTION");
  assert.match(attention?.message ?? "", /em revisão/);

  const withForm = clean();
  withForm.sections.push({
    id: "form",
    type: "FORM",
    variant: "default",
    order: 5,
    enabled: true,
    contentStatus: "APPROVED",
    content: { heading: "Mensagem", fields: ["name", "email"], consentEnabled: false },
    settings: visual,
  });
  const formFinding = evaluateLandingPageExperience(parse(withForm), { capabilities: { ...EXPERIENCE_CAPABILITIES_V1, formsFunctional: false } }).find((finding) => finding.code === "FORM_PLATFORM_UNAVAILABLE");
  assert.equal(formFinding?.severity, "INFO");
  assert.match(formFinding?.message ?? "", /etapa posterior/);
  assert.equal(evaluateLandingPageExperience(parse(withForm)).some((finding) => finding.code === "FORM_PLATFORM_UNAVAILABLE"), false);
  const codes = evaluateLandingPageExperience(parse(withForm)).map((finding) => finding.code).join(" ");
  assert.equal(codes.includes("MEASUREMENT"), false);
  assert.equal(codes.includes("PUBLICATION"), false);
  assert.equal(codes.includes("TRACKING"), false);
});

test("observação do aluno, reavaliação, stale e conclusão", async () => {
  const document = clean();
  const blocker = composeLandingPageExperienceReview(document, 2, readyInput(document, {
    userFindings: [{ category: "ACTION", severity: "BLOCKER", message: "Bloqueio inventado." }],
  }));
  assert.equal(blocker.ok, false);
  const html = composeLandingPageExperienceReview(document, 2, readyInput(document, {
    userFindings: [{ category: "CONTENT", severity: "ATTENTION", message: "Texto <b>com html</b>." }],
  }));
  assert.equal(html.ok, false);

  const openNote = composeLandingPageExperienceReview(document, 2, readyInput(document, {
    userFindings: [{ id: "user:1", category: "READABILITY", severity: "ATTENTION", message: "Esse parágrafo parece longo." }],
  }));
  assert.equal(openNote.ok, true);
  if (!openNote.ok) return;
  assert.equal(openNote.review.summary.status, "NEEDS_ADJUSTMENTS");
  assert.equal(experienceLessonResult({ landingPageProjectId: "lp", document: { ...document, experienceReview: openNote.review }, draftRevision: 2 }), null);

  const deferred = composeLandingPageExperienceReview(document, 2, readyInput(document, {
    userFindings: [{ id: "user:1", category: "READABILITY", severity: "ATTENTION", message: "Esse parágrafo parece longo.", status: "DEFERRED" }],
  }));
  assert.equal(deferred.ok, true);
  if (!deferred.ok) return;
  assert.equal(deferred.review.summary.status, "READY_FOR_NEXT_STEP");
  assert.equal(deferred.summary.deferredCount, 1);
  assert.equal(deferred.summary.userFindingCount, 1);
  assert.equal(JSON.stringify(deferred.summary).includes("parágrafo"), false);

  const resolved = composeLandingPageExperienceReview(document, 2, readyInput(document, {
    userFindings: [{ id: "user:1", category: "READABILITY", severity: "ATTENTION", message: "Esse botão ficou difícil de perceber no celular.", status: "RESOLVED" }],
  }));
  assert.equal(resolved.ok && resolved.review.summary.status, "READY_FOR_NEXT_STEP");
  const skipped = composeLandingPageExperienceReview(document, 2, readyInput(document, {
    userFindings: [{ id: "user:1", category: "MEDIA", severity: "ATTENTION", message: "A imagem chama mais atenção que a oferta.", status: "NOT_APPLICABLE" }],
  }));
  assert.equal(skipped.ok && skipped.review.summary.status, "READY_FOR_NEXT_STEP");

  const edited = composeLandingPageExperienceReview(document, 2, readyInput(document, {
    userFindings: [{ id: "user:1", category: "CONTENT", severity: "ATTENTION", message: "Observação reescrita.", status: "RESOLVED" }],
  }));
  assert.equal(edited.ok, true);
  if (!edited.ok) return;
  assert.match(edited.review.findings.find((finding) => finding.id === "user:1")?.message ?? "", /reescrita/);

  const first = await projectWith(document);
  const saved = await saveLandingPageExperienceReview(first.store, null, {
    userId: "user-a",
    landingPageProjectId: first.page.id,
    expectedRevision: first.page.draftRevision,
    review: readyInput(document, {
      userFindings: [{ id: "user:1", category: "CONTENT", severity: "ATTENTION", message: "Esse parágrafo parece longo.", status: "DEFERRED" }],
    }),
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.value.status, "READY_TO_PREVIEW");
  assert.equal(saved.value.draftRevision, saved.value.draftDocument.experienceReview?.reviewedDraftRevision);
  assert.equal(experienceReviewEffectiveStatus(saved.value.draftDocument, saved.value.draftRevision), "READY_FOR_NEXT_STEP");
  assert.notEqual(experienceReviewEffectiveStatus(saved.value.draftDocument, saved.value.draftRevision), "STALE");
  const result = experienceLessonResult({
    landingPageProjectId: saved.value.id,
    document: saved.value.draftDocument,
    draftRevision: saved.value.draftRevision,
  });
  assert.ok(result);
  assert.equal(result?.status, "READY_FOR_NEXT_STEP");
  assert.equal(JSON.stringify(result).includes("parágrafo"), false);
  assert.equal(result?.userFindingCount, 1);
  assert.equal(result?.deferredCount, 1);
  assert.equal(result?.blockerCount, 0);
  assert.equal(result?.viewportsReviewed, 4);
  const progress = experienceReviewProgress(saved.value.draftDocument.experienceReview ?? null);
  assert.equal(progress.viewportsReviewed, 4);
  assert.equal("score" in progress, false);

  const changed = structuredClone(saved.value.draftDocument);
  const changedHero = changed.sections[0];
  if (!changedHero || changedHero.type !== "HERO") throw new Error("hero");
  changedHero.content.headline = "Móveis planejados sob medida";
  const bumped = await first.store.updateDraftAtomic({
    id: saved.value.id,
    userId: "user-a",
    expectedRevision: saved.value.draftRevision,
    document: changed,
  });
  assert.equal(bumped.ok, true);
  if (!bumped.ok) return;
  assert.equal(experienceReviewEffectiveStatus(bumped.record.draftDocument, bumped.record.draftRevision), "STALE");
  assert.equal(experienceLessonResult({ landingPageProjectId: bumped.record.id, document: bumped.record.draftDocument, draftRevision: bumped.record.draftRevision }), null);

  const again = await saveLandingPageExperienceReview(first.store, null, {
    userId: "user-a",
    landingPageProjectId: bumped.record.id,
    expectedRevision: bumped.record.draftRevision,
    review: readyInput(bumped.record.draftDocument),
  });
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(experienceReviewEffectiveStatus(again.value.draftDocument, again.value.draftRevision), "READY_FOR_NEXT_STEP");
  const beforeHeadline = document.sections[0]?.type === "HERO" ? document.sections[0].content.headline : "";
  evaluateLandingPageExperience(document);
  const afterHeadline = document.sections[0]?.type === "HERO" ? document.sections[0].content.headline : "";
  assert.equal(afterHeadline, beforeHeadline);

  const toolbar = renderToStaticMarkup(createElement(ResponsivePreviewToolbar, { viewport: "MOBILE", onViewport: () => undefined }));
  assert.match(toolbar, /Celular pequeno/);
  assert.match(toolbar, /Celular/);
  assert.match(toolbar, /Tablet/);
  assert.match(toolbar, /Desktop/);
  assert.match(toolbar, /320/);
  assert.match(toolbar, /375/);
  assert.match(toolbar, /768/);
  assert.match(toolbar, /1280/);
  assert.match(toolbar, /min-h-11/);
  assert.match(toolbar, /flex-wrap/);
  const lessonPage = readFileSync("src/app/dev/landing-experience-lesson/page.tsx", "utf8");
  assert.match(lessonPage, /notFound/);
  assert.match(lessonPage, /index: false/);
  const urls = buildPublicSitemap("https://alexandrefeio.com.br", { courses: [], lessons: [] }).map((entry) => entry.url);
  assert.equal(urls.some((url) => url.includes("landing-experience-lesson")), false);
  assert.equal(urls.some((url) => url.includes("/p/")), false);
  assert.match(readFileSync("src/components/learning/LandingPageExperienceEditor.tsx", "utf8"), /EXPERIENCE_DEFER_COPY|Você poderá voltar a este ponto antes de publicar/);
  assert.match(EXPERIENCE_DEFER_COPY, /antes de publicar/);
});
