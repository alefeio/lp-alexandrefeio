import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPagePublicationEditor } from "../src/components/learning/LandingPagePublicationEditor";
import { LandingPageRenderer } from "../src/components/landing-page/LandingPageRenderer";
import { siteConfig } from "../src/data/site-config";
import { assessLesson } from "../src/lib/editorial/readiness";
import { lessonBlockDataSchema, TOOL_KEYS } from "../src/lib/learning/blocks";
import { isLessonComplete, type ProgressRuleBlock } from "../src/lib/learning/progress";
import { siteLesson12Blocks, siteLesson12Meta } from "../src/lib/learning/site-revisao-antes-do-trafego";
import { sitesCourseIsPubliclyVisible, sitesCourseLessons, sitesCourseSeed } from "../src/lib/learning/sites-course";
import { createEmptyLandingPageDocument, landingPageDocumentSchema, type LandingPageDocumentV1 } from "../src/lib/landing-page/document";
import { createMemoryLandingPageLeadStore } from "../src/lib/landing-page/leads/store";
import { createMemoryLandingPageStore } from "../src/lib/landing-page/memory-store";
import { createMemoryLandingPageMetricStore, recordLandingPageMeasurementEvents } from "../src/lib/landing-page/measurement/metrics";
import { LIVE_MEDIA_STORE_READY, landingPagePublicRuntimeEnabled } from "../src/lib/landing-page/publication/gate";
import { handlePublicLandingEvent, handlePublicLandingForm } from "../src/lib/landing-page/publication/http";
import {
  PUBLICATION_LIVE_COPY,
  PUBLICATION_RESULT_TITLE,
  PUBLICATION_RUNTIME_OFF_COPY,
  publicationIssueCopy,
  publicationIssueHref,
  publicationLessonResponseSchema,
  publicationPublicUrl,
  publicationResultDisplay,
  toPublicationPageView,
  type PublicationPageView,
} from "../src/lib/landing-page/publication/lesson-flow";
import { publicationHistoryForOwner, saveLandingPagePublicationLesson } from "../src/lib/landing-page/publication/lesson-plan";
import { createMemoryLandingPagePublicationStore } from "../src/lib/landing-page/publication/memory-store";
import { landingPageHasUnpublishedChanges, listLandingPagePublications } from "../src/lib/landing-page/publication/service";
import { documentFromPublicationSnapshot } from "../src/lib/landing-page/publication/snapshot";
import { createLandingPageProject, updateLandingPageDraft, updateLandingPageSlug } from "../src/lib/landing-page/service";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";

const visual = { backgroundRole: "DEFAULT" as const, alignment: "LEFT" as const, emphasis: "NORMAL" as const };

function review(revision: number) {
  return {
    version: 1 as const,
    reviewedDraftRevision: revision,
    reviewedViewports: ["DESKTOP" as const],
    checklist: [],
    findings: [],
    summary: { status: "READY_FOR_NEXT_STEP" as const, headline: "Revisado" as const, openBlockerCount: 0, openAttentionCount: 0, deferredCount: 0 },
  };
}

function readyDocument(revision = 2): LandingPageDocumentV1 {
  const document = createEmptyLandingPageDocument();
  document.conversion.primaryAction = { type: "WHATSAPP", phone: "5511999990000", message: "Olá" };
  document.measurement = {
    version: 1,
    primaryConversionEvent: "WHATSAPP_CLICK",
    enabledEvents: ["PAGE_VIEW", "CTA_CLICK", "WHATSAPP_CLICK"],
  };
  document.experienceReview = review(revision);
  document.sections = [
    {
      id: "hero",
      type: "HERO",
      variant: "default",
      order: 0,
      enabled: true,
      contentStatus: "APPROVED",
      content: { headline: "Móveis sob medida", subheadline: "Prazo combinado", primaryCta: { type: "WHATSAPP", phone: "5511999990000" } },
      settings: visual,
    },
    {
      id: "cta",
      type: "CTA",
      variant: "default",
      order: 1,
      enabled: true,
      contentStatus: "APPROVED",
      content: { heading: "Quero conversar", description: "A conversa começa por aqui.", action: { type: "WHATSAPP", phone: "5511999990000" } },
      settings: visual,
    },
  ];
  return landingPageDocumentSchema.parse(document);
}

async function readyPage(document = readyDocument(2)) {
  const projects = createMemoryLandingPageStore({ courseIdBySlug: { "sites-que-convertem": "course-sites" } });
  const publications = createMemoryLandingPagePublicationStore(projects);
  const created = await createLandingPageProject(projects, { userId: "owner", title: "Oficina", slug: "oficina-joao" });
  if (!created.ok) throw new Error(created.code);
  const saved = await updateLandingPageDraft(projects, {
    userId: "owner",
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    document,
  });
  if (!saved.ok) throw new Error(saved.code);
  return { projects, publications, page: saved.value };
}

function pageView(page: Awaited<ReturnType<typeof readyPage>>["page"], runtimeEnabled: boolean): PublicationPageView {
  return toPublicationPageView(page, {
    media: [],
    history: [],
    activeVersion: null,
    activeSourceRevision: null,
    runtimeEnabled,
  });
}

test("aula 12 completa o conteúdo, a ferramenta e o resultado", () => {
  assert.equal(siteLesson12Blocks.length, 33);
  assert.equal(siteLesson12Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 4);
  const tool = siteLesson12Blocks.find((block) => block.data.type === "TOOL");
  const result = siteLesson12Blocks.find((block) => block.data.type === "RESULT");
  assert.equal(tool?.data.type === "TOOL" && tool.data.toolKey, "LANDING_PAGE_PUBLICATION_V1");
  assert.equal(result?.data.type === "RESULT" && result.data.title, PUBLICATION_RESULT_TITLE);
  assert.equal(siteLesson12Meta.title, "Revise e publique sua landing page");
  assert.equal(siteLesson12Meta.estimatedMinutes, 35);
  assert.equal(siteLesson12Meta.priceCents, 3990);
  assert.equal(siteLesson12Meta.commerceStatus, "NOT_FOR_SALE");
  assert.match(siteLesson12Blocks[1]?.data.type === "TEXT" ? siteLesson12Blocks[1].data.body : "", /colocar uma página real no ar/);
  for (const block of siteLesson12Blocks) assert.equal(lessonBlockDataSchema.safeParse(block.data).success, true);
  const assessment = assessLesson(
    { ...siteLesson12Meta, status: "PUBLISHED" },
    siteLesson12Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.equal(assessment.ready, true, assessment.issues.join(" "));
  const answers = ["nao", "sim", "nao", "sim"];
  const checkpoints = siteLesson12Blocks.filter((block) => block.data.type === "CHECKPOINT");
  checkpoints.forEach((block, index) => {
    assert.equal(block.data.type === "CHECKPOINT" && block.data.correctOptionId, answers[index]);
  });
  assert.equal((TOOL_KEYS as readonly string[]).includes("LANDING_PAGE_PUBLICATION_V1"), true);
  assert.equal((TOOL_KEYS as readonly string[]).includes("LANDING_PAGE_PUBLISH_V1"), false);
  const lesson = sitesCourseLessons().find((item) => item.slug === "revisao-antes-do-trafego");
  assert.equal(lesson?.plannedTool, "LANDING_PAGE_PUBLICATION_V1");
  assert.equal(lesson?.plannedResult, PUBLICATION_RESULT_TITLE);
  assert.equal(sitesCourseSeed.status, "DRAFT");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(sitesCourseIsPubliclyVisible(), false);
});

test("a conclusão da aula 12 fecha o curso pela engine existente", () => {
  const result = publicationLessonResponseSchema.parse({
    landingPageProjectId: "page-1",
    publicationId: "pub-1",
    publicationVersion: 1,
    snapshotSchemaVersion: 1,
    publicSlug: "oficina-joao",
    publicPath: "/p/oficina-joao",
    primaryActionType: "WHATSAPP",
    primaryConversionEvent: "WHATSAPP_CLICK",
    warningCount: 1,
    acknowledgedWarningCount: 1,
    publishedAt: "2026-10-22T12:00:00.000Z",
    sourceDraftRevision: 2,
  });
  const rules: ProgressRuleBlock[] = siteLesson12Blocks.map((block) => ({ ...block, retiredAt: null }));
  const answers = Object.fromEntries(
    rules.map((block) => {
      if (block.data.type === "CHECKPOINT" && block.data.correctOptionId) {
        return [block.blockKey, { viewed: true, response: { optionId: block.data.correctOptionId } }];
      }
      if (block.data.type === "TOOL") return [block.blockKey, { viewed: true, response: result }];
      return [block.blockKey, { viewed: true, response: null }];
    }),
  );
  assert.equal(isLessonComplete(rules, answers, true), true);
  assert.equal(isLessonComplete(rules, answers, false), false);
  const lessons = sitesCourseLessons();
  const completedLessons = lessons.length;
  assert.equal(lessons.at(-1)?.slug, "revisao-antes-do-trafego");
  assert.equal(completedLessons > 0 && completedLessons === lessons.length, true);
});

test("bloqueio não pode ser reconhecido e aviso pode", async () => {
  const { projects, publications, page } = await readyPage();
  const blocked = await saveLandingPagePublicationLesson(
    { projects, publications, runtimeEnabled: true },
    { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: page.draftRevision, acknowledgedWarningCodes: ["NO_TRUST_PROOF", "CORE_PLACEHOLDER"] },
  );
  assert.equal(blocked.ok, false);
  assert.equal(blocked.lessonComplete, false);
  assert.equal((await listLandingPagePublications({ publications }, { userId: "owner", landingPageProjectId: page.id }))?.length ?? 0, 0);

  const pending = await saveLandingPagePublicationLesson(
    { projects, publications, runtimeEnabled: true },
    { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: page.draftRevision },
  );
  assert.equal(pending.ok, false);
  if (!pending.ok) assert.equal(pending.warnings.includes("NO_TRUST_PROOF"), true);

  const stranger = await saveLandingPagePublicationLesson(
    { projects, publications, runtimeEnabled: true },
    { userId: "outra", landingPageProjectId: page.id, expectedDraftRevision: page.draftRevision, acknowledgedWarningCodes: ["NO_TRUST_PROOF"] },
  );
  assert.equal(stranger.ok, false);
  if (!stranger.ok) assert.equal(stranger.code, "NOT_FOUND");
});

test("cada bloqueio humano aponta para a aula certa e impede a publicação", async () => {
  const cases: Array<{ name: string; mutate: (document: LandingPageDocumentV1) => void; code: string; href: string }> = [
    { name: "provisorio", code: "CORE_PLACEHOLDER", href: "/aulas/mensagem-que-deixa-a-oferta-clara", mutate: (document) => { document.sections[0].contentStatus = "PLACEHOLDER"; } },
    { name: "copy", code: "CORE_COPY_NOT_APPROVED", href: "/aulas/mensagem-que-deixa-a-oferta-clara", mutate: (document) => { document.sections[0].contentStatus = "DRAFT"; } },
    { name: "contraste", code: "CONTRAST_CRITICAL", href: "/aulas/hierarquia-visual-e-atencao", mutate: (document) => { document.theme.colors.text = document.theme.colors.background; } },
    { name: "acao", code: "INVALID_ACTION", href: "/aulas/configure-o-que-precisa-ser-medido", mutate: (document) => { document.conversion.primaryAction = { type: "INTERNAL_ROUTE", path: "/admin" }; } },
    { name: "revisao", code: "EXPERIENCE_REVIEW_STALE", href: "/aulas/pagina-mobile-e-experiencia", mutate: (document) => { document.experienceReview = review(1); } },
  ];
  for (const item of cases) {
    const document = readyDocument(2);
    item.mutate(document);
    const { projects, publications, page } = await readyPage(landingPageDocumentSchema.parse(document));
    const saved = await saveLandingPagePublicationLesson(
      { projects, publications, runtimeEnabled: true },
      { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: page.draftRevision, acknowledgedWarningCodes: ["NO_TRUST_PROOF"] },
    );
    assert.equal(saved.lessonComplete, false, item.name);
    assert.equal(saved.ok, false, item.name);
    if (!saved.ok) assert.equal(saved.blockers.includes(item.code), true, item.name);
    assert.equal(publicationIssueHref(item.code), item.href);
    assert.match(publicationIssueCopy(item.code, "blocker"), /página|texto|cores|ação|experiência/i);
  }
  assert.match(publicationIssueCopy("NO_TRUST_PROOF", "warning"), /inventá-las/);
  assert.equal(publicationIssueHref("LARGE_IMAGE"), "/aulas/hierarquia-visual-e-atencao");
  assert.equal(publicationIssueHref("DEFERRED_ATTENTION"), "/aulas/pagina-mobile-e-experiencia");
  assert.match(publicationIssueCopy("EXPERIENCE_REVIEW_STALE", "blocker"), /depois da última revisão/);
});

test("runtime desligado não conclui a aula mesmo com publicação gravada", async () => {
  const { projects, publications, page } = await readyPage();
  const saved = await saveLandingPagePublicationLesson(
    { projects, publications, runtimeEnabled: false },
    { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: page.draftRevision, acknowledgedWarningCodes: ["NO_TRUST_PROOF"] },
  );
  assert.equal(saved.ok, true);
  assert.equal(saved.lessonComplete, false);
  assert.equal(saved.result, null);
  if (saved.ok && !saved.lessonComplete) assert.equal(saved.code, "RUNTIME_DISABLED");
  const history = await listLandingPagePublications({ publications }, { userId: "owner", landingPageProjectId: page.id });
  assert.equal(history?.length, 1);
  const markup = renderToStaticMarkup(createElement(LandingPagePublicationEditor, {
    page: pageView(page, false),
    onPublish: async () => ({ ok: true, lessonComplete: false, message: PUBLICATION_RUNTIME_OFF_COPY }),
  }));
  assert.match(markup, new RegExp(PUBLICATION_RUNTIME_OFF_COPY));
  assert.equal(markup.includes(PUBLICATION_LIVE_COPY), false);
  assert.equal(markup.includes("Parabéns"), false);
});

test("runtime ligado conclui, mostra o caminho e isola o rascunho", async () => {
  const { projects, publications, page } = await readyPage();
  const saved = await saveLandingPagePublicationLesson(
    { projects, publications, runtimeEnabled: true },
    { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: page.draftRevision, acknowledgedWarningCodes: ["NO_TRUST_PROOF"] },
  );
  assert.equal(saved.lessonComplete, true);
  if (!saved.lessonComplete) return;
  assert.equal(saved.result.publicPath, "/p/oficina-joao");
  assert.equal(saved.result.publicSlug, "oficina-joao");
  assert.equal(saved.result.publicationVersion, 1);
  assert.equal(saved.result.sourceDraftRevision, page.draftRevision);
  assert.equal("snapshot" in saved.result, false);
  assert.equal(JSON.stringify(saved.result).includes("5511"), false);
  assert.equal(JSON.stringify(saved.result).includes("https://"), false);
  assert.equal(publicationResultDisplay(saved.result).endereco, "/p/oficina-joao");
  assert.equal(publicationPublicUrl("oficina-joao", true), `${siteConfig.url}/p/oficina-joao`);
  assert.equal(publicationPublicUrl("oficina-joao", false), null);

  const active = await publications.findActiveBySlug("oficina-joao");
  assert.equal(active?.publication.snapshot.sections.find((section) => section.type === "HERO")?.content.headline, "Móveis sob medida");
  const edited = readyDocument(page.draftRevision + 1);
  edited.sections[0].content = { ...edited.sections[0].content, headline: "Frase nova" };
  const draft = await updateLandingPageDraft(projects, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    document: edited,
  });
  if (!draft.ok) throw new Error(draft.code);
  const still = await publications.findActiveBySlug("oficina-joao");
  assert.equal(still?.publication.snapshot.sections.find((section) => section.type === "HERO")?.content.headline, "Móveis sob medida");
  assert.equal(landingPageHasUnpublishedChanges(draft.value.draftRevision, still?.publication.sourceDraftRevision ?? null), true);
  const locked = await updateLandingPageSlug(projects, { userId: "owner", landingPageProjectId: page.id, slug: "outro-endereco" });
  assert.equal(locked.ok, false);

  const second = await saveLandingPagePublicationLesson(
    { projects, publications, runtimeEnabled: true },
    { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: draft.value.draftRevision, acknowledgedWarningCodes: ["NO_TRUST_PROOF"] },
  );
  assert.equal(second.lessonComplete, true);
  if (second.lessonComplete) assert.equal(second.result.publicationVersion, 2);
  const live = await publications.findActiveBySlug("oficina-joao");
  assert.equal(live?.publication.version, 2);
  assert.equal(live?.publication.snapshot.sections.find((section) => section.type === "HERO")?.content.headline, "Frase nova");

  const unchanged = readyDocument(draft.value.draftRevision + 1);
  unchanged.sections[0].content = { ...unchanged.sections[0].content, headline: "Frase nova" };
  unchanged.sections.push({
    id: "oculta",
    type: "PROBLEM",
    variant: "default",
    order: 3,
    enabled: false,
    contentStatus: "APPROVED",
    content: { heading: "Fora", description: "Não entra na versão." },
    settings: visual,
  });
  const quiet = await updateLandingPageDraft(projects, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: draft.value.draftRevision,
    document: landingPageDocumentSchema.parse(unchanged),
  });
  if (!quiet.ok) throw new Error(quiet.code);
  const repeat = await saveLandingPagePublicationLesson(
    { projects, publications, runtimeEnabled: true },
    { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: quiet.value.draftRevision, acknowledgedWarningCodes: ["NO_TRUST_PROOF"] },
  );
  assert.equal(repeat.lessonComplete, true);
  if (repeat.ok && repeat.lessonComplete) assert.equal(repeat.code, "LANDING_PAGE_NO_PUBLIC_CHANGES");
  const history = await publicationHistoryForOwner({ publications }, { userId: "owner", landingPageProjectId: page.id });
  assert.deepEqual(history?.map((item) => item.version), [1, 2]);
  assert.equal(history?.filter((item) => item.active).length, 1);
  assert.equal(JSON.stringify(history).includes("snapshot"), false);
  assert.equal(JSON.stringify(history).includes("headline"), false);
});

test("preview continua sem ação e a página pública executa ação, formulário e evento", async () => {
  const { projects, publications, page } = await readyPage();
  const view = pageView(page, true);
  const preview = renderToStaticMarkup(createElement(LandingPagePublicationEditor, { page: view, previewOpen: true, onPublish: async () => ({ ok: false }) }));
  assert.match(preview, /Ver revisão final/);
  assert.match(preview, /data-preview-action="disabled"/);
  assert.equal(preview.includes("wa.me"), false);
  assert.equal(preview.includes("Publicar minha página"), true);

  const saved = await saveLandingPagePublicationLesson(
    { projects, publications, runtimeEnabled: true },
    { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: page.draftRevision, acknowledgedWarningCodes: ["NO_TRUST_PROOF"] },
  );
  if (!saved.lessonComplete) throw new Error("publicação");
  const active = await publications.findActiveBySlug("oficina-joao");
  if (!active) throw new Error("ativa");
  const publicDocument = documentFromPublicationSnapshot(active.publication.snapshot);
  if (!publicDocument) throw new Error("documento");
  const markup = renderToStaticMarkup(createElement(LandingPageRenderer, { document: publicDocument, mode: "PUBLIC", publicSlug: "oficina-joao" }));
  assert.match(markup, /wa.me/);
  assert.equal(markup.includes("data-preview-action"), false);
  const leads = createMemoryLandingPageLeadStore();
  const metrics = createMemoryLandingPageMetricStore();
  const formDocument = readyDocument(page.draftRevision);
  formDocument.sections.push({
    id: "formulario",
    type: "FORM",
    variant: "default",
    order: 2,
    enabled: true,
    contentStatus: "APPROVED",
    content: { heading: "Mensagem", intro: "Deixe um recado.", fields: ["name", "email"], submitLabel: "Enviar", successMessage: "Recebemos sua mensagem." },
    settings: visual,
  });
  formDocument.conversion.primaryAction = { type: "FORM_ANCHOR", sectionId: "formulario" };
  formDocument.measurement.primaryConversionEvent = "FORM_SUBMIT";
  formDocument.measurement.enabledEvents = ["PAGE_VIEW", "CTA_CLICK", "FORM_START", "FORM_SUBMIT"];
  const formPage = await readyPage(landingPageDocumentSchema.parse(formDocument));
  const formSaved = await saveLandingPagePublicationLesson(
    { projects: formPage.projects, publications: formPage.publications, runtimeEnabled: true },
    { userId: "owner", landingPageProjectId: formPage.page.id, expectedDraftRevision: formPage.page.draftRevision, acknowledgedWarningCodes: ["NO_TRUST_PROOF"] },
  );
  assert.equal(formSaved.lessonComplete, true);
  const formActive = await formPage.publications.findActiveBySlug("oficina-joao");
  if (!formActive) throw new Error("form");
  const response = await handlePublicLandingForm(
    { publications: formPage.publications, leads, metrics, consumeRateLimit: () => true },
    new Request("https://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://localhost", host: "localhost" },
      body: JSON.stringify({ values: { name: "Ana", email: "ana@example.com" }, submissionId: "submission-1", website: "", company_website: "" }),
    }),
    { slug: "oficina-joao", sectionId: "formulario" },
  );
  assert.equal(response.status, 200);
  const viewed = await recordLandingPageMeasurementEvents({
    source: "PUBLIC",
    sink: metrics,
    landingPageProjectId: formPage.page.id,
    publicationId: formActive.publication.id,
    events: ["PAGE_VIEW", "CTA_CLICK", "FORM_START"],
    date: "2026-10-22",
  });
  assert.equal(viewed.recorded, true);
  const event = await handlePublicLandingEvent(
    { publications: formPage.publications, metrics },
    new Request("https://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://localhost", host: "localhost" },
      body: JSON.stringify({ eventType: "CTA_CLICK", sectionId: "cta" }),
    }),
    { slug: "oficina-joao" },
  );
  assert.equal(event.status, 204);
  const counts = await metrics.listForProject(formPage.page.id);
  assert.equal(counts.some((item) => item.eventType === "FORM_SUBMIT" && item.count > 0), true);
  assert.equal(counts.some((item) => item.eventType === "PAGE_VIEW" && item.count > 0), true);
});

test("privacidade, gate e curso continuam fechados", () => {
  assert.equal(landingPagePublicRuntimeEnabled({}), false);
  assert.equal(LIVE_MEDIA_STORE_READY, false);
  const editor = readFileSync("src/components/learning/LandingPagePublicationEditor.tsx", "utf8");
  const flow = readFileSync("src/lib/landing-page/publication/lesson-flow.ts", "utf8");
  const tool = readFileSync("src/components/learning/LandingPagePublicationTool.tsx", "utf8");
  assert.equal(editor.includes("LANDING_PAGE_PUBLIC_RUNTIME_ENABLED"), false);
  assert.equal(tool.includes("trackEvent"), false);
  assert.equal(flow.includes("trackEvent"), false);
  assert.equal(editor.includes("min-w-["), false);
  assert.match(editor, /overflow-x-hidden/);
  assert.match(readFileSync("src/app/p/layout.tsx", "utf8"), /index: false/);
  assert.equal(readFileSync("src/app/p/layout.tsx", "utf8").includes("PlatformShell"), false);
  assert.equal(readFileSync("src/app/p/[slug]/page.tsx", "utf8").includes("GoogleTagManager"), false);
  assert.equal(buildPublicSitemap("https://alexandrefeio.com.br", { courses: [], lessons: [] }).some((entry) => entry.url.includes("/p/")), false);
  const rejected = publicationLessonResponseSchema.safeParse({
    landingPageProjectId: "page-1",
    publicationId: "pub-1",
    publicationVersion: 1,
    snapshotSchemaVersion: 1,
    publicSlug: "oficina-joao",
    publicPath: "/p/oficina-joao",
    primaryActionType: "WHATSAPP",
    primaryConversionEvent: "WHATSAPP_CLICK",
    warningCount: 0,
    acknowledgedWarningCount: 0,
    publishedAt: "2026-10-22T12:00:00.000Z",
    sourceDraftRevision: 2,
    snapshot: { headline: "segredo" },
    phone: "5511999990000",
  });
  assert.equal(rejected.success, false);
  assert.match(readFileSync("docs/courses/sites-que-convertem.md", "utf8"), /LANDING_PAGE_PUBLICATION_V1/);
  assert.match(readFileSync("docs/adr/landing-page-builder-v1.md", "utf8"), /BEFORE_PUBLIC_RELEASE/);
  assert.equal(readFileSync("src/lib/learning/catalog-deploy.ts", "utf8").includes("seedSiteRevisaoAntesDoTrafegoContent"), true);
});
