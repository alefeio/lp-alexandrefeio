import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPageRenderer } from "../src/components/landing-page/LandingPageRenderer";
import { LandingPageVisualDirectionEditor } from "../src/components/learning/LandingPageVisualDirectionEditor";
import { assessLesson } from "../src/lib/editorial/readiness";
import {
  applyReviewedWireframe,
  createLandingPageProject,
  createMemoryLandingPageStore,
  defaultLandingPageTheme,
  evaluateVisualHierarchy,
  proposeWireframeFromDocument,
  resolveStartingPoint,
  saveConversionPageBrief,
  saveLandingPageVisualDirection,
  saveVisitorDecisionJourney,
  themePreset,
  visualLessonResponseSchema,
  visualLessonResult,
  visualWarningMessage,
  withThemeColor,
} from "../src/lib/landing-page";
import { assessThemeContrast } from "../src/lib/landing-page/theme/schema";
import type { LandingPageThemeV1 } from "../src/lib/landing-page/theme/schema";
import type { VisualPageView, VisualSectionView } from "../src/lib/landing-page/theme/visual-direction";
import { siteLesson08Blocks, siteLesson08Meta } from "../src/lib/learning/site-hierarquia-visual-e-atencao";
import { sitesCourseIsPubliclyVisible, sitesCourseSeed } from "../src/lib/learning/sites-course";
import { SECTION_NAMES } from "../src/lib/landing-page/wireframe/policy";
import type { LandingPageProjectView } from "../src/lib/landing-page/service";

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
  return { store, page: applied.value };
}

function sectionsOf(
  sections: Array<{ id: string; variant: string; settings: VisualSectionView["settings"] }>,
) {
  return sections.map((section) => ({
    sectionId: section.id,
    visualSettings: section.settings,
    variant: section.variant,
  }));
}

function choice(theme: LandingPageThemeV1, warnings: string[] = [], goal: "CLARITY" | "PRIMARY_ACTION" | "TRUST" | "CONTENT_FLOW" = "CLARITY") {
  const origin = resolveStartingPoint(theme, null);
  return {
    startingPoint: origin.startingPoint,
    ...(origin.preset ? { preset: origin.preset } : {}),
    primaryVisualGoal: goal,
    warningsReviewed: warnings,
  };
}

function viewOf(page: LandingPageProjectView, copyHint = false): VisualPageView {
  return {
    id: page.id,
    title: page.title,
    draftRevision: page.draftRevision,
    status: page.status,
    setup: page.draftDocument.sections.length > 0 ? "READY" : "NEED_SECTIONS",
    copyHint,
    theme: page.draftDocument.theme,
    sections: page.draftDocument.sections.map((section): VisualSectionView => ({
      id: section.id,
      type: section.type,
      label: SECTION_NAMES[section.type],
      variant: section.variant,
      enabled: section.enabled,
      settings: section.settings,
    })),
    direction: page.draftDocument.strategy?.visualDirection ?? null,
    previewHref: `/app/landing-pages/${page.id}/preview`,
  };
}

function editor(page: LandingPageProjectView, step: "today" | "start" | "color" | "type" | "sections" | "review" | "preview", theme = page.draftDocument.theme, sections = viewOf(page).sections) {
  return renderToStaticMarkup(createElement(LandingPageVisualDirectionEditor, {
    page: viewOf(page, true),
    theme,
    sections,
    goal: "CLARITY",
    step,
    appliedPreset: null,
    notice: null,
    saving: false,
    savedHref: step === "preview" ? page ? `/app/landing-pages/${page.id}/preview` : null : null,
    onStep: () => undefined,
    onTheme: () => undefined,
    onSections: () => undefined,
    onGoal: () => undefined,
    onApplyPreset: () => undefined,
    onSave: () => undefined,
  }));
}

test("aula 8 completa o conteúdo, a ferramenta e a transição", () => {
  assert.equal(siteLesson08Blocks.length, 33);
  assert.ok(siteLesson08Blocks.length >= 31 && siteLesson08Blocks.length <= 33);
  assert.equal(new Set(siteLesson08Blocks.map((block) => block.blockKey)).size, siteLesson08Blocks.length);
  assert.equal(siteLesson08Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 4);
  const tool = siteLesson08Blocks.find((block) => block.data.type === "TOOL");
  assert.equal(tool?.data.type === "TOOL" ? tool.data.toolKey : "", "LANDING_PAGE_VISUAL_DIRECTION_V1");
  const result = siteLesson08Blocks.find((block) => block.data.type === "RESULT");
  assert.equal(result?.data.type === "RESULT" ? result.data.title : "", "Direção visual da minha landing page");
  const answers = siteLesson08Blocks.filter((block) => block.data.type === "CHECKPOINT").map((block) => block.data.type === "CHECKPOINT" ? block.data.correctOptionId : "");
  assert.deepEqual(answers, ["nao", "nao", "nao", "sim"]);
  const body = siteLesson08Blocks.map((block) => JSON.stringify(block.data)).join("\n");
  assert.match(body, /Construa confiança antes de pedir a ação/);
  assert.equal(body.includes("ideal para médicos"), false);
  assert.equal(body.includes("openai"), false);
  assert.equal(siteLesson08Meta.priceCents, 3490);
  assert.equal(siteLesson08Meta.estimatedMinutes, 30);
  assert.equal(siteLesson08Meta.commerceStatus, "NOT_FOR_SALE");
  assert.equal(siteLesson08Meta.accessType, "PAID");
  const ready = assessLesson({
    title: siteLesson08Meta.title,
    summary: siteLesson08Meta.summary,
    publicPreview: siteLesson08Meta.publicPreview,
    estimatedMinutes: siteLesson08Meta.estimatedMinutes,
    accessType: "PAID",
    status: "PUBLISHED",
    priceCents: siteLesson08Meta.priceCents,
    commerceStatus: "NOT_FOR_SALE",
  }, siteLesson08Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })));
  assert.equal(ready.ready, true, ready.issues.join(" "));
  assert.equal(sitesCourseSeed.status, "DRAFT");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(sitesCourseIsPubliclyVisible(), false);
});

test("tema atual, presets, cores e contraste local", () => {
  const theme = defaultLandingPageTheme();
  assert.equal(resolveStartingPoint(theme, null).startingPoint, "DEFAULT");
  const editorial = themePreset("EDITORIAL");
  assert.equal(resolveStartingPoint(editorial, "EDITORIAL").startingPoint, "PRESET");
  const custom = withThemeColor(editorial, "primary", "#1c1917");
  assert.ok(custom);
  assert.equal(custom.typography.fontFamily, "SERIF");
  assert.equal(resolveStartingPoint(custom, "EDITORIAL").startingPoint, "CUSTOM");
  assert.equal(resolveStartingPoint(custom, "EDITORIAL").preset, "EDITORIAL");
  assert.equal(withThemeColor(theme, "background", "red"), null);
  assert.equal(withThemeColor(theme, "background", "rgb(0,0,0)"), null);
  assert.equal(withThemeColor(theme, "text", "#112233")?.colors.text, "#112233");
  const weak = { ...theme, colors: { ...theme.colors, text: "#bbbbbb", background: "#cccccc" } };
  assert.ok(assessThemeContrast(weak).blocked.includes("TEXT_BACKGROUND"));
  const muted = { ...theme, colors: { ...theme.colors, background: "#ffffff", text: "#111111", surface: "#ffffff", mutedText: "#8a8a8a", primary: "#111111", primaryText: "#ffffff" } };
  const mutedReport = assessThemeContrast(muted);
  assert.equal(mutedReport.checks.find((check) => check.pair === "MUTED_BACKGROUND")?.level, "ATTENTION");
  assert.equal(mutedReport.blocked.includes("MUTED_BACKGROUND"), false);
  assert.equal(assessThemeContrast(theme).blocked.length, 0);
  assert.equal(JSON.stringify(themePreset("CLARO")).includes("1e5eff"), false);
  assert.equal(JSON.stringify(editorial).toLowerCase().includes("geist"), false);
});

test("direção visual salva uma vez e preserva copy, estratégia e status", async () => {
  const { store, page } = await withSections();
  const before = structuredClone(page.draftDocument);
  const headline = "Oferta clara para quem precisa decidir com calma e sem pressa hoje";
  const hero = before.sections.find((section) => section.type === "HERO");
  if (hero?.type !== "HERO") throw new Error("hero");
  hero.content.headline = headline;
  hero.contentStatus = "APPROVED";
  hero.copyMeta = { origin: "MANUAL", unresolvedFacts: [] };
  const faq = before.sections.find((section) => section.type === "FAQ");
  if (faq?.type === "FAQ" && faq.content.items[0]) {
    faq.content.items[0].answer = "O prazo depende da medida e da fila de produção, e isso é combinado antes do pedido.";
  }
  const stamped = await store.updateDraftAtomic({ id: page.id, userId: "user-a", expectedRevision: page.draftRevision, document: before });
  if (!stamped.ok) throw new Error(stamped.reason);
  const current = stamped.record.draftDocument;
  const denied = await saveLandingPageVisualDirection(store, {
    userId: "user-b",
    landingPageProjectId: page.id,
    expectedRevision: stamped.record.draftRevision,
    theme: current.theme,
    sections: sectionsOf(current.sections),
    direction: choice(current.theme),
  });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.code, "NOT_FOUND");
  const saved = await saveLandingPageVisualDirection(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: stamped.record.draftRevision,
    theme: current.theme,
    sections: sectionsOf(current.sections),
    direction: choice(current.theme),
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.value.draftRevision, stamped.record.draftRevision + 1);
  assert.equal(saved.value.status, "READY_TO_PREVIEW");
  assert.equal(saved.value.draftDocument.strategy?.visualDirection?.version, 1);
  assert.equal(saved.value.draftDocument.strategy?.visualDirection?.startingPoint, "DEFAULT");
  assert.equal(saved.value.draftDocument.strategy?.visualDirection?.primaryVisualGoal, "CLARITY");
  assert.equal(JSON.stringify(saved.value.draftDocument.strategy?.brief), JSON.stringify(current.strategy?.brief));
  assert.equal(JSON.stringify(saved.value.draftDocument.strategy?.decisionJourney), JSON.stringify(current.strategy?.decisionJourney));
  assert.equal(JSON.stringify(saved.value.draftDocument.strategy?.wireframe), JSON.stringify(current.strategy?.wireframe));
  assert.equal(JSON.stringify(saved.value.draftDocument.strategy?.copyFacts ?? null), JSON.stringify(current.strategy?.copyFacts ?? null));
  assert.equal(JSON.stringify(saved.value.draftDocument.conversion), JSON.stringify(current.conversion));
  assert.equal(JSON.stringify(saved.value.draftDocument.measurement), JSON.stringify(current.measurement));
  assert.deepEqual(saved.value.draftDocument.sections.map((section) => section.id), current.sections.map((section) => section.id));
  const savedHero = saved.value.draftDocument.sections.find((section) => section.type === "HERO");
  assert.equal(savedHero?.type === "HERO" ? savedHero.content.headline : "", headline);
  assert.equal(savedHero?.contentStatus, "APPROVED");
  assert.equal((savedHero as { copyMeta?: { origin?: string } } | undefined)?.copyMeta?.origin, "MANUAL");
  const summary = visualLessonResult({
    landingPageProjectId: saved.value.id,
    direction: saved.value.draftDocument.strategy!.visualDirection!,
    draftRevision: saved.value.draftRevision,
  });
  assert.equal(visualLessonResponseSchema.safeParse(summary).success, true);
  const encoded = JSON.stringify(summary);
  assert.equal(encoded.includes("colors"), false);
  assert.equal(encoded.includes("typography"), false);
  assert.equal(encoded.includes("#"), false);
  assert.equal(summary.themeFingerprint.length, 64);
  const stale = await saveLandingPageVisualDirection(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: stamped.record.draftRevision,
    theme: current.theme,
    sections: sectionsOf(saved.value.draftDocument.sections),
    direction: choice(current.theme),
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, "LANDING_PAGE_DRAFT_CONFLICT");
  const empty = await createLandingPageProject(store, { userId: "user-a", title: "Vazia", slug: "vazia", projectId: "project-a" });
  if (!empty.ok) throw new Error(empty.code);
  const missing = await saveLandingPageVisualDirection(store, {
    userId: "user-a",
    landingPageProjectId: empty.value.id,
    expectedRevision: empty.value.draftRevision,
    theme: defaultLandingPageTheme(),
    sections: [],
    direction: choice(defaultLandingPageTheme()),
  });
  assert.equal(missing.ok, false);
});

test("contraste crítico bloqueia e atenção, variantes e avisos não alteram a copy", async () => {
  const { store, page } = await withSections();
  const theme = page.draftDocument.theme;
  const critical = { ...theme, colors: { ...theme.colors, text: "#bbbbbb", background: "#cccccc" } };
  const blocked = await saveLandingPageVisualDirection(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    theme: critical,
    sections: sectionsOf(page.draftDocument.sections),
    direction: choice(critical),
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "LANDING_PAGE_THEME_CONTRAST");
  assert.equal(page.draftRevision, (await store.findByIdForUser(page.id, "user-a"))?.draftRevision);
  const muted = { ...theme, colors: { ...theme.colors, background: "#ffffff", surface: "#ffffff", text: "#111111", mutedText: "#8a8a8a", primary: "#111111", primaryText: "#ffffff", border: "#dddddd" } };
  const allowed = await saveLandingPageVisualDirection(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    theme: muted,
    sections: sectionsOf(page.draftDocument.sections.map((section) => ({
      id: section.id,
      variant: section.type === "HERO" ? "centered" : section.variant,
      settings: section.type === "HERO" ? { backgroundRole: "SURFACE" as const, alignment: "CENTER" as const, emphasis: "FEATURED" as const } : section.settings,
    }))),
    direction: choice(muted),
  });
  assert.equal(allowed.ok, true);
  if (!allowed.ok) return;
  const hero = allowed.value.draftDocument.sections.find((section) => section.type === "HERO");
  assert.equal(hero?.settings.backgroundRole, "SURFACE");
  assert.equal(hero?.settings.alignment, "CENTER");
  assert.equal(hero?.settings.emphasis, "FEATURED");
  assert.equal(hero?.variant, "centered");
  assert.equal(hero?.contentStatus, "PLACEHOLDER");
  const invalidVariant = await saveLandingPageVisualDirection(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: allowed.value.draftRevision,
    theme: muted,
    sections: sectionsOf(allowed.value.draftDocument.sections.map((section) => ({
      id: section.id,
      variant: section.type === "HERO" ? "photo" : section.variant,
      settings: section.settings,
    }))),
    direction: choice(muted),
  });
  assert.equal(invalidVariant.ok, false);
  const featured = allowed.value.draftDocument.sections.map((section, index) => index < 4 ? { ...section, settings: { ...section.settings, emphasis: "FEATURED" as const } } : section);
  const featuredWarnings = evaluateVisualHierarchy(muted, featured);
  assert.ok(featuredWarnings.includes("TOO_MANY_FEATURED_SECTIONS"));
  assert.match(visualWarningMessage("TOO_MANY_FEATURED_SECTIONS"), /muitas seções em destaque/);
  assert.match(visualWarningMessage("PRIMARY_USED_AS_BACKGROUND_TOO_OFTEN"), /cor principal em muitas seções/);
  assert.match(visualWarningMessage("EXCESSIVE_CENTER_ALIGNMENT"), /centralizada/);
  const snapshot = JSON.stringify(allowed.value.draftDocument);
  evaluateVisualHierarchy(muted, featured);
  assert.equal(JSON.stringify(allowed.value.draftDocument), snapshot);
  const withFeatured = await saveLandingPageVisualDirection(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: allowed.value.draftRevision,
    theme: muted,
    sections: featured.map((section) => ({ sectionId: section.id, visualSettings: section.settings, variant: section.variant })),
    direction: choice(muted, featuredWarnings),
  });
  assert.equal(withFeatured.ok, true);
  const centered = allowed.value.draftDocument.sections.map((section) => ({ ...section, settings: { ...section.settings, alignment: "CENTER" as const, emphasis: "NORMAL" as const, backgroundRole: "DEFAULT" as const } }));
  assert.ok(evaluateVisualHierarchy(theme, centered).includes("EXCESSIVE_CENTER_ALIGNMENT"));
  const primaryRun = allowed.value.draftDocument.sections.map((section, index) => ({ ...section, settings: { ...section.settings, backgroundRole: index < 3 ? "PRIMARY" as const : "DEFAULT" as const, emphasis: "NORMAL" as const, alignment: "LEFT" as const } }));
  assert.ok(evaluateVisualHierarchy(theme, primaryRun).includes("PRIMARY_USED_AS_BACKGROUND_TOO_OFTEN"));
  const skipped = await saveLandingPageVisualDirection(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: withFeatured.ok ? withFeatured.value.draftRevision : allowed.value.draftRevision,
    theme: muted,
    sections: featured.map((section) => ({ sectionId: section.id, visualSettings: section.settings, variant: section.variant })),
    direction: choice(muted, []),
  });
  assert.equal(skipped.ok, false);
  if (!skipped.ok) assert.equal(skipped.code, "LANDING_PAGE_VISUAL_REVIEW");
});

test("preview autenticado reflete o tema salvo e a interface cabe sem CSS livre", async () => {
  const { store, page } = await withSections();
  const theme = themePreset("CONTRASTE");
  const saved = await saveLandingPageVisualDirection(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    theme,
    sections: sectionsOf(page.draftDocument.sections.map((section) => ({
      id: section.id,
      variant: section.variant,
      settings: section.type === "HERO" ? { backgroundRole: "SURFACE" as const, alignment: "LEFT" as const, emphasis: "FEATURED" as const } : section.settings,
    }))),
    direction: { startingPoint: "PRESET", preset: "CONTRASTE", primaryVisualGoal: "PRIMARY_ACTION", warningsReviewed: evaluateVisualHierarchy(theme, page.draftDocument.sections) },
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const revision = saved.value.draftRevision;
  const markup = renderToStaticMarkup(createElement(LandingPageRenderer, { document: saved.value.draftDocument, mode: "PREVIEW" }));
  assert.match(markup, /data-preview-action="disabled"/);
  assert.match(markup, /data-background-role="SURFACE"/);
  assert.match(markup, /data-emphasis="FEATURED"/);
  assert.match(markup, /data-alignment="LEFT"/);
  assert.match(markup, new RegExp(theme.colors.primary));
  assert.match(markup, /overflow-x-hidden/);
  assert.match(markup, /break-words/);
  assert.equal(markup.includes("gtag"), false);
  assert.equal(markup.includes("style=\"color: red\""), false);
  assert.equal((await store.findByIdForUser(page.id, "user-a"))?.draftRevision, revision);
  const today = editor(saved.value, "today");
  assert.match(today, /Como sua página está hoje/);
  assert.match(today, /experiência melhor depois de preparar os textos principais/);
  assert.match(today, /overflow-x-hidden/);
  assert.match(today, /grid-cols-1/);
  assert.match(today, /min-w-0/);
  const start = editor(saved.value, "start");
  assert.match(start, /Sóbrio/);
  assert.match(start, /Editorial/);
  assert.equal(start.includes("ideal para"), false);
  const sections = editor(saved.value, "sections");
  assert.match(sections, /Texto em duas colunas/);
  assert.match(sections, /Cartões/);
  assert.match(sections, /grid-cols-1/);
  const review = editor(saved.value, "review", theme, viewOf(saved.value).sections.map((section, index) => index < 4 ? { ...section, settings: { ...section.settings, emphasis: "FEATURED" } } : section));
  assert.match(review, /muitas seções em destaque/);
  assert.match(review, /Salvar direção visual/);
  const empty = editor({ ...page, draftDocument: { ...page.draftDocument, sections: [] } }, "today");
  assert.match(empty, /Monte a estrutura da sua landing page/);
  assert.match(empty, /\/aulas\/organize-as-secoes-da-pagina/);
  const source = [
    readFileSync(new URL("../src/components/learning/LandingPageVisualDirectionTool.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("../src/components/learning/LandingPageVisualDirectionEditor.tsx", import.meta.url), "utf8"),
  ].join("\n");
  assert.equal(source.includes("outline-none"), false);
  assert.equal(source.includes("trackEvent"), false);
  assert.equal(source.includes("openai"), false);
  const domain = readFileSync(new URL("../src/lib/landing-page/theme/visual-direction.ts", import.meta.url), "utf8");
  assert.equal(domain.includes("openai"), false);
  assert.equal(domain.includes("upload"), false);
  const adr = readFileSync(new URL("../docs/adr/landing-page-builder-v1.md", import.meta.url), "utf8");
  assert.match(adr, /BEFORE_PUBLIC_RELEASE/);
  assert.match(adr, /strategy\.visualDirection/);
});
