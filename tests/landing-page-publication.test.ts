import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPageRenderer } from "../src/components/landing-page/LandingPageRenderer";
import { siteConfig } from "../src/data/site-config";
import { resolveLandingPageAction } from "../src/lib/landing-page/action-resolver";
import { landingPageActionSchema } from "../src/lib/landing-page/actions";
import { createEmptyLandingPageDocument, landingPageDocumentSchema, type LandingPageDocumentV1 } from "../src/lib/landing-page/document";
import { experienceReviewFixture } from "../src/lib/landing-page/experience/fixture";
import { createMemoryLandingPageLeadStore } from "../src/lib/landing-page/leads/store";
import { deleteLandingPageMedia } from "../src/lib/landing-page/media/service";
import { createMemoryLandingPageMediaStore } from "../src/lib/landing-page/media/memory-store";
import type { LandingPageMediaStorage } from "../src/lib/landing-page/media/storage";
import { createMemoryLandingPageMetricStore, recordLandingPageMeasurementEvents } from "../src/lib/landing-page/measurement/metrics";
import { createMemoryLandingPageStore } from "../src/lib/landing-page/memory-store";
import { LIVE_MEDIA_STORE_READY, landingPagePublicRuntimeEnabled } from "../src/lib/landing-page/publication/gate";
import { handlePublicLandingEvent, handlePublicLandingForm, PUBLIC_FORM_RATE_LIMIT_MESSAGE } from "../src/lib/landing-page/publication/http";
import { isPublicInternalRouteAllowed } from "../src/lib/landing-page/publication/internal-route";
import { createPublicLifecycleTracker, reportPublicLandingEvent } from "../src/lib/landing-page/publication/lifecycle";
import { createMemoryLandingPagePublicationStore } from "../src/lib/landing-page/publication/memory-store";
import { publicLandingMetadata } from "../src/lib/landing-page/publication/metadata";
import { evaluateLandingPagePublicationReadiness } from "../src/lib/landing-page/publication/readiness";
import {
  getLandingPagePublication,
  landingPageHasUnpublishedChanges,
  listLandingPagePublications,
  publicationLogEvent,
  publishLandingPage,
  republishLandingPage,
  rollbackLandingPage,
  unpublishLandingPage,
} from "../src/lib/landing-page/publication/service";
import {
  buildLandingPagePublicationSnapshot,
  documentFromPublicationSnapshot,
  hashLandingPagePublicationSnapshot,
  PUBLICATION_SNAPSHOT_SCHEMA_VERSION,
  validatePublicationSnapshot,
} from "../src/lib/landing-page/publication/snapshot";
import { createLandingPageProject, updateLandingPageDraft, updateLandingPageSlug } from "../src/lib/landing-page/service";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";
import { commerceStatusForCreate } from "../src/lib/learning/catalog-commerce";
import { reconcileLesson11Slug, SITE_LESSON_11_CANONICAL_SLUG, SITE_LESSON_11_LEGACY_SLUG } from "../src/lib/learning/site-lesson-11-slug";
import { sitesCourseIsPubliclyVisible, sitesCourseSeed } from "../src/lib/learning/sites-course";
import type { PublicationMediaInput } from "../src/lib/landing-page/publication/snapshot";

const visual = { backgroundRole: "DEFAULT" as const, alignment: "LEFT" as const, emphasis: "NORMAL" as const };

function review(revision: number) {
  return {
    version: 1 as const,
    reviewedDraftRevision: revision,
    reviewedViewports: ["DESKTOP" as const],
    checklist: [],
    findings: [],
    summary: {
      status: "READY_FOR_NEXT_STEP" as const,
      headline: "Revisado" as const,
      openBlockerCount: 0,
      openAttentionCount: 0,
      deferredCount: 0,
    },
  };
}

function readyDocument(revision = 1): LandingPageDocumentV1 {
  const document = createEmptyLandingPageDocument();
  document.conversion.primaryAction = { type: "WHATSAPP", phone: "5511999990000", message: "Olá" };
  document.measurement = {
    version: 1,
    primaryConversionEvent: "WHATSAPP_CLICK",
    enabledEvents: ["PAGE_VIEW", "CTA_CLICK", "WHATSAPP_CLICK", "FORM_START", "FORM_SUBMIT"],
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
      content: { headline: "Móveis sob medida", subheadline: "Prazo e medida combinados", primaryCta: { type: "WHATSAPP", phone: "5511999990000" } },
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
    {
      id: "formulario",
      type: "FORM",
      variant: "default",
      order: 2,
      enabled: true,
      contentStatus: "APPROVED",
      content: { heading: "Mensagem", intro: "Deixe um recado.", fields: ["name", "email"], submitLabel: "Enviar", successMessage: "Recebemos sua mensagem." },
      settings: visual,
    },
  ];
  return landingPageDocumentSchema.parse(document);
}

function media(projectId: string, id = "media-1", fileSize = 1000): PublicationMediaInput {
  return {
    id,
    landingPageProjectId: projectId,
    status: "READY",
    publicUrl: "https://cdn.example/foto.jpg",
    altText: "Bancada de madeira",
    width: 800,
    height: 600,
    fileSize,
  };
}

async function readyPage(slug = "oficina-joao") {
  const projects = createMemoryLandingPageStore({ courseIdBySlug: { "sites-que-convertem": "course-sites" } });
  const publications = createMemoryLandingPagePublicationStore(projects);
  const created = await createLandingPageProject(projects, { userId: "owner", title: "Oficina", slug });
  if (!created.ok) throw new Error(created.code);
  const saved = await updateLandingPageDraft(projects, {
    userId: "owner",
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    document: readyDocument(created.value.draftRevision + 1),
  });
  if (!saved.ok) throw new Error(saved.code);
  return { projects, publications, page: saved.value };
}

function post(body: unknown) {
  return new Request("https://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://localhost", host: "localhost" },
    body: JSON.stringify(body),
  });
}

test("migration de publicação é aditiva", () => {
  const sql = readFileSync("prisma/migrations/20261022150000_add_landing_page_publication_runtime/migration.sql", "utf8");
  const core = readFileSync("prisma/migrations/20261020180000_add_landing_page_builder_core/migration.sql", "utf8");
  assert.equal(/drop table|truncate|delete from/i.test(sql), false);
  assert.match(sql, /ADD COLUMN "snapshotHash"/);
  assert.match(sql, /ADD COLUMN "sourceDraftRevision"/);
  assert.match(sql, /landing_page_active_publication_same_project/);
  assert.match(core, /landing_page_publication_landingPageProjectId_version_key/);
  assert.equal(/drop index "landing_page_publication_landingPageProjectId_version_key"/i.test(sql), false);
});

test("página válida fica pronta e página sem prova ou mídia também", () => {
  const document = readyDocument(2);
  const ready = evaluateLandingPagePublicationReadiness({ document, draftRevision: 2, slug: "oficina-joao", projectId: "project-1" });
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.blockers, []);
  assert.equal(ready.warnings.includes("NO_TRUST_PROOF"), true);
  assert.equal(ready.draftRevision, 2);
});

test("bloqueios de publicação não viram nota", () => {
  const base = readyDocument(2);
  const placeholder = structuredClone(base);
  placeholder.sections[0].contentStatus = "PLACEHOLDER";
  assert.equal(evaluateLandingPagePublicationReadiness({ document: placeholder, draftRevision: 2, slug: "oficina-joao", projectId: "p" }).blockers.includes("CORE_PLACEHOLDER"), true);

  const draft = structuredClone(base);
  draft.sections[0].contentStatus = "DRAFT";
  assert.equal(evaluateLandingPagePublicationReadiness({ document: draft, draftRevision: 2, slug: "oficina-joao", projectId: "p" }).blockers.includes("CORE_COPY_NOT_APPROVED"), true);

  const contrast = structuredClone(base);
  contrast.theme.colors.text = contrast.theme.colors.background;
  contrast.theme.colors.mutedText = contrast.theme.colors.background;
  assert.equal(evaluateLandingPagePublicationReadiness({ document: contrast, draftRevision: 2, slug: "oficina-joao", projectId: "p" }).blockers.includes("CONTRAST_CRITICAL"), true);

  const stale = structuredClone(base);
  assert.equal(evaluateLandingPagePublicationReadiness({ document: stale, draftRevision: 9, slug: "oficina-joao", projectId: "p" }).blockers.includes("EXPERIENCE_REVIEW_STALE"), true);
  const missing = structuredClone(base);
  delete missing.experienceReview;
  assert.equal(evaluateLandingPagePublicationReadiness({ document: missing, draftRevision: 2, slug: "oficina-joao", projectId: "p" }).blockers.includes("EXPERIENCE_REVIEW_MISSING"), true);

  const action = structuredClone(base);
  action.conversion.primaryAction = { type: "INTERNAL_ROUTE", path: "/admin" };
  assert.equal(evaluateLandingPagePublicationReadiness({ document: action, draftRevision: 2, slug: "oficina-joao", projectId: "p" }).blockers.includes("INVALID_ACTION"), true);

  const form = structuredClone(base);
  form.sections[2].content = { ...form.sections[2].content, successMessage: undefined };
  assert.equal(evaluateLandingPagePublicationReadiness({ document: form, draftRevision: 2, slug: "oficina-joao", projectId: "p" }).blockers.includes("INVALID_FORM"), true);

  const measurement = structuredClone(base);
  measurement.measurement.primaryConversionEvent = "FORM_SUBMIT";
  measurement.measurement.enabledEvents = ["FORM_SUBMIT"];
  measurement.sections = measurement.sections.filter((section) => section.type !== "FORM");
  assert.equal(evaluateLandingPagePublicationReadiness({ document: measurement, draftRevision: 2, slug: "oficina-joao", projectId: "p" }).blockers.includes("INVALID_PRIMARY_CONVERSION"), true);

  const unsupported = { ...structuredClone(base), registryVersion: "OUTRO" };
  assert.equal(evaluateLandingPagePublicationReadiness({ document: unsupported, draftRevision: 2, slug: "oficina-joao", projectId: "p" }).blockers.includes("UNSUPPORTED_REGISTRY"), true);
  assert.equal(evaluateLandingPagePublicationReadiness({ document: { schemaVersion: 99 }, draftRevision: 2, slug: "oficina-joao", projectId: "p" }).blockers.includes("INVALID_SCHEMA"), true);
  assert.equal(evaluateLandingPagePublicationReadiness({ document: base, draftRevision: 2, slug: "Admin", projectId: "p" }).blockers.includes("INVALID_SLUG"), true);
});

test("mídia e depoimento inválidos bloqueiam; avisos não bloqueiam", () => {
  const document = readyDocument(2);
  document.sections[0].content = { ...document.sections[0].content, mediaRef: { mediaId: "media-1", usage: "HERO", altText: "Bancada" } };
  const missing = evaluateLandingPagePublicationReadiness({ document, draftRevision: 2, slug: "oficina-joao", projectId: "project-1", media: [] });
  assert.equal(missing.blockers.includes("INVALID_MEDIA"), true);

  const notReady = evaluateLandingPagePublicationReadiness({
    document,
    draftRevision: 2,
    slug: "oficina-joao",
    projectId: "project-1",
    media: [{ ...media("project-1"), status: "UPLOADING", publicUrl: null }],
  });
  assert.equal(notReady.blockers.includes("MEDIA_NOT_READY"), true);

  const proofDocument = readyDocument(2);
  proofDocument.strategy = {
    copyFacts: {
      version: 1,
      trustProofs: [{ id: "proof-1", type: "TESTIMONIAL", title: "Cliente", quote: "O prazo foi cumprido.", authorName: "Ana", consentConfirmed: false, status: "READY_FOR_DISPLAY" }],
    },
  };
  proofDocument.sections.push({
    id: "depoimentos",
    type: "TESTIMONIALS",
    variant: "default",
    order: 3,
    enabled: true,
    contentStatus: "APPROVED",
    content: { heading: "Quem contratou", proofRefs: ["proof-1"] },
    settings: visual,
  });
  const consent = evaluateLandingPagePublicationReadiness({ document: landingPageDocumentSchema.parse(proofDocument), draftRevision: 2, slug: "oficina-joao", projectId: "project-1" });
  assert.equal(consent.blockers.includes("TESTIMONIAL_CONSENT"), true);

  const large = readyDocument(2);
  large.sections[0].content = { ...large.sections[0].content, mediaRef: { mediaId: "media-1", usage: "HERO", altText: "Bancada" } };
  const warned = evaluateLandingPagePublicationReadiness({
    document: large,
    draftRevision: 2,
    slug: "oficina-joao",
    projectId: "project-1",
    media: [media("project-1", "media-1", 2_000_000)],
  });
  assert.equal(warned.ready, true);
  assert.equal(warned.warnings.includes("LARGE_IMAGE"), true);
  assert.equal(warned.warnings.includes("NO_TRUST_PROOF"), true);

  const draftCopy = readyDocument(2);
  draftCopy.sections.push({
    id: "problema",
    type: "PROBLEM",
    variant: "default",
    order: 3,
    enabled: true,
    contentStatus: "DRAFT",
    content: { heading: "Contexto", description: "Situação real" },
    settings: visual,
  });
  const nonCore = evaluateLandingPagePublicationReadiness({ document: draftCopy, draftRevision: 2, slug: "oficina-joao", projectId: "project-1" });
  assert.equal(nonCore.ready, true);
  assert.equal(nonCore.warnings.includes("NON_CORE_DRAFT"), true);

  const deferred = readyDocument(2);
  deferred.experienceReview = {
    ...review(2),
    findings: [{
      id: "d1",
      code: "DEFER_COPY",
      category: "CONTENT",
      severity: "ATTENTION",
      scope: "PAGE",
      message: "Ajuste adiado",
      recommendation: "Revisar depois",
      source: "USER",
      status: "DEFERRED",
      deferReason: "Fica para a proxima revisao",
    }],
  };
  const deferredResult = evaluateLandingPagePublicationReadiness({ document: deferred, draftRevision: 2, slug: "oficina-joao", projectId: "project-1" });
  assert.equal(deferredResult.ready, true);
  assert.equal(deferredResult.warnings.includes("DEFERRED_ATTENTION"), true);
});

test("snapshot público não carrega estratégia, revisão nem fatos internos", () => {
  const document = readyDocument(2);
  document.strategy = {
    copyFacts: {
      version: 1,
      trustProofs: [
        { id: "proof-1", type: "CREDENTIAL", title: "Registro visível", description: "Conteúdo público da prova.", status: "READY_FOR_DISPLAY" },
        { id: "proof-2", type: "CREDENTIAL", title: "fato-interno-oculto", description: "segredo-interno-brief", status: "READY_FOR_DISPLAY" },
      ],
    },
  };
  document.experienceReview = { ...review(2), findings: [{ id: "f1", code: "X", category: "CONTENT", severity: "INFO", scope: "PAGE", message: "achado-secreto", recommendation: "Revisar", source: "USER", status: "RESOLVED" }] };
  document.sections.push({
    id: "confianca",
    type: "TRUST",
    variant: "default",
    order: 3,
    enabled: true,
    contentStatus: "APPROVED",
    content: { heading: "Confiança", items: [], proofRefs: ["proof-1"] },
    settings: visual,
  });
  const parsed = landingPageDocumentSchema.parse(document);
  const snapshot = buildLandingPagePublicationSnapshot(parsed, []);
  assert.ok(snapshot);
  const raw = JSON.stringify(snapshot);
  assert.equal(raw.includes("strategy"), false);
  assert.equal(raw.includes("experienceReview"), false);
  assert.equal(raw.includes("copyFacts"), false);
  assert.equal(raw.includes("segredo-interno-brief"), false);
  assert.equal(raw.includes("achado-secreto"), false);
  assert.equal(raw.includes("fato-interno-oculto"), false);
  assert.equal(raw.includes("LessonResult"), false);
  assert.equal(raw.includes("Registro visível"), true);
  assert.equal(snapshot.snapshotSchemaVersion, PUBLICATION_SNAPSHOT_SCHEMA_VERSION);
  assert.equal(snapshot.registryVersion, parsed.registryVersion);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.theme.colors.text, parsed.theme.colors.text);
  assert.equal(snapshot.conversion.primaryAction?.type, "WHATSAPP");
  assert.equal(snapshot.sections.some((section) => section.type === "FORM"), true);
  assert.equal(snapshot.measurement.primaryConversionEvent, "WHATSAPP_CLICK");
  assert.equal(validatePublicationSnapshot({ ...snapshot, strategy: { brief: true } }).ok, false);
  const again = hashLandingPagePublicationSnapshot(snapshot);
  assert.equal(hashLandingPagePublicationSnapshot(JSON.parse(raw)), again);
  assert.equal(hashLandingPagePublicationSnapshot({ b: 1, a: 2 }), hashLandingPagePublicationSnapshot({ a: 2, b: 1 }));
});

test("mídia pronta entra no snapshot e prova sem consentimento não", () => {
  const document = readyDocument(2);
  document.sections[0].content = { ...document.sections[0].content, mediaRef: { mediaId: "media-1", usage: "HERO", altText: "Bancada" } };
  const snapshot = buildLandingPagePublicationSnapshot(landingPageDocumentSchema.parse(document), [media("project-1")]);
  assert.equal(snapshot?.media[0]?.publicUrl, "https://cdn.example/foto.jpg");
  assert.equal(snapshot?.media[0]?.mediaId, "media-1");
  assert.equal(JSON.stringify(snapshot).includes("storageKey"), false);
  const blocked = readyDocument(2);
  blocked.strategy = { copyFacts: { version: 1, trustProofs: [{ id: "proof-1", type: "TESTIMONIAL", title: "Cliente", quote: "Texto", authorName: "Ana", status: "DRAFT" }] } };
  blocked.sections.push({ id: "depoimentos", type: "TESTIMONIALS", variant: "default", order: 3, enabled: true, contentStatus: "APPROVED", content: { heading: "Quem contratou", proofRefs: ["proof-1"] }, settings: visual });
  assert.equal(buildLandingPagePublicationSnapshot(landingPageDocumentSchema.parse(blocked), []), null);
});

test("publicar, republicar, rollback e despublicar isolam o rascunho", async () => {
  const { projects, publications, page } = await readyPage();
  const denied = await publishLandingPage({ projects, publications }, { userId: "other", landingPageProjectId: page.id, expectedDraftRevision: page.draftRevision });
  assert.equal(denied.ok, false);
  const conflict = await publishLandingPage({ projects, publications }, { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: page.draftRevision + 3 });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.code, "LANDING_PAGE_DRAFT_CONFLICT");

  const placeholder = readyDocument(page.draftRevision + 1);
  placeholder.sections[0].contentStatus = "PLACEHOLDER";
  const blockedSave = await updateLandingPageDraft(projects, { userId: "owner", landingPageProjectId: page.id, expectedRevision: page.draftRevision, document: placeholder });
  if (!blockedSave.ok) throw new Error(blockedSave.code);
  const blocked = evaluateLandingPagePublicationReadiness({ document: blockedSave.value.draftDocument, draftRevision: blockedSave.value.draftRevision, slug: page.slug, projectId: page.id });
  const ignored = await publishLandingPage(
    { projects, publications },
    { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: blockedSave.value.draftRevision, acknowledgedWarningCodes: blocked.blockers },
  );
  assert.equal(ignored.ok, false);
  const restored = await updateLandingPageDraft(projects, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: blockedSave.value.draftRevision,
    document: readyDocument(blockedSave.value.draftRevision + 1),
  });
  if (!restored.ok) throw new Error(restored.code);

  const published = await publishLandingPage({ projects, publications }, { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: restored.value.draftRevision });
  assert.equal(published.ok, true);
  if (!published.ok) return;
  assert.equal(published.publication.version, 1);
  assert.equal(published.publication.isActive, true);
  assert.equal(published.warnings.includes("NO_TRUST_PROOF"), true);
  const locked = await updateLandingPageSlug(projects, { userId: "owner", landingPageProjectId: page.id, slug: "outro-endereco" });
  assert.equal(locked.ok, false);
  if (!locked.ok) assert.equal(locked.code, "LANDING_PAGE_SLUG_LOCKED_AFTER_PUBLICATION");

  const current = await projects.findByIdForUser(page.id, "owner");
  if (!current) throw new Error("missing");
  const edited = structuredClone(current.draftDocument);
  edited.sections.push({
    id: "nota",
    type: "PROBLEM",
    variant: "default",
    order: 9,
    enabled: false,
    contentStatus: "DRAFT",
    content: { heading: "Nota interna", description: "Não entra na página pública." },
    settings: visual,
  });
  edited.experienceReview = review(current.draftRevision + 1);
  const saved = await updateLandingPageDraft(projects, { userId: "owner", landingPageProjectId: page.id, expectedRevision: current.draftRevision, document: edited });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const still = await publications.findActiveBySlug(page.slug);
  const publicHero = still?.publication.snapshot.sections.find((section) => section.type === "HERO");
  assert.equal(publicHero?.type === "HERO" && publicHero.content.headline, "Móveis sob medida");
  assert.equal(landingPageHasUnpublishedChanges(saved.value.draftRevision, still?.publication.sourceDraftRevision), true);

  const same = await republishLandingPage({ projects, publications }, { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: saved.value.draftRevision });
  assert.equal(same.ok, false);
  if (!same.ok) assert.equal(same.code, "LANDING_PAGE_NO_PUBLIC_CHANGES");

  const changed = structuredClone(saved.value.draftDocument);
  const heroB = changed.sections.find((section) => section.type === "HERO");
  if (heroB?.type !== "HERO") throw new Error("hero");
  heroB.content = { ...heroB.content, headline: "Versão B" };
  changed.experienceReview = review(saved.value.draftRevision + 1);
  const savedB = await updateLandingPageDraft(projects, { userId: "owner", landingPageProjectId: page.id, expectedRevision: saved.value.draftRevision, document: changed });
  if (!savedB.ok) throw new Error(savedB.code);
  const next = await republishLandingPage({ projects, publications }, { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: savedB.value.draftRevision });
  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.publication.version, 2);
  const history = await listLandingPagePublications({ publications }, { userId: "owner", landingPageProjectId: page.id });
  assert.equal(history?.length, 2);
  assert.equal(history?.[0]?.version, 1);
  assert.equal(history?.[0]?.isActive, false);
  assert.equal("snapshot" in (history?.[0] ?? {}), false);
  const liveB = await publications.findActiveBySlug(page.slug);
  const heroLive = liveB?.publication.snapshot.sections.find((section) => section.type === "HERO");
  assert.equal(heroLive?.type === "HERO" && heroLive.content.headline, "Versão B");

  const metrics = createMemoryLandingPageMetricStore();
  await metrics.increment({ landingPageProjectId: page.id, publicationId: published.publication.id, date: "2026-10-22", eventType: "PAGE_VIEW" });
  await metrics.increment({ landingPageProjectId: page.id, publicationId: next.publication.id, date: "2026-10-22", eventType: "PAGE_VIEW" });
  const rows = await metrics.listForProject(page.id);
  assert.equal(rows.filter((row) => row.publicationId === published.publication.id).length, 1);
  assert.equal(rows.filter((row) => row.publicationId === next.publication.id).length, 1);

  const rolled = await rollbackLandingPage({ projects, publications }, { userId: "owner", landingPageProjectId: page.id, publicationId: published.publication.id });
  assert.equal(rolled.ok, true);
  if (!rolled.ok) return;
  assert.equal(rolled.publication.version, 3);
  assert.equal(rolled.publication.rollbackSourcePublicationId, published.publication.id);
  const versionA = await getLandingPagePublication({ publications }, { userId: "owner", landingPageProjectId: page.id, publicationId: published.publication.id });
  const versionC = await publications.findActiveBySlug(page.slug);
  assert.equal(versionC?.publication.id, rolled.publication.id);
  assert.equal(versionC?.publication.snapshotHash, versionA?.snapshotHash);
  assert.equal(versionA?.snapshot.sections.find((section) => section.type === "HERO")?.type === "HERO", true);
  const foreign = await getLandingPagePublication({ publications }, { userId: "other", landingPageProjectId: page.id, publicationId: published.publication.id });
  assert.equal(foreign, null);
  if (versionA) {
    versionA.snapshot.page.title = "mutado";
    const reread = await getLandingPagePublication({ publications }, { userId: "owner", landingPageProjectId: page.id, publicationId: versionA.id });
    assert.notEqual(reread?.snapshot.page.title, "mutado");
  }

  const removed = await unpublishLandingPage({ projects, publications }, { userId: "owner", landingPageProjectId: page.id });
  assert.equal(removed.ok, true);
  if (removed.ok) assert.equal(removed.activePublicationId, null);
  assert.equal(await publications.findActiveBySlug(page.slug), null);
  const again = await unpublishLandingPage({ projects, publications }, { userId: "owner", landingPageProjectId: page.id });
  assert.equal(again.ok, true);
  const after = await listLandingPagePublications({ publications }, { userId: "owner", landingPageProjectId: page.id });
  assert.equal(after?.length, 3);
  const stillLocked = await updateLandingPageSlug(projects, { userId: "owner", landingPageProjectId: page.id, slug: "novo-slug" });
  assert.equal(stillLocked.ok, false);

  const revivedDocument = structuredClone(savedB.value.draftDocument);
  const latest = await projects.findByIdForUser(page.id, "owner");
  if (!latest) throw new Error("missing");
  revivedDocument.experienceReview = review(latest.draftRevision + 1);
  const savedC = await updateLandingPageDraft(projects, { userId: "owner", landingPageProjectId: page.id, expectedRevision: latest.draftRevision, document: revivedDocument });
  if (!savedC.ok) throw new Error(savedC.code);
  const revived = await publishLandingPage({ projects, publications }, { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: savedC.value.draftRevision });
  assert.equal(revived.ok, true);
  if (revived.ok) assert.equal(revived.publication.version, 4);
});

test("rota pública, ações, formulário e métricas usam a publicação ativa", async () => {
  const { projects, publications, page } = await readyPage("pagina-publica");
  const published = await publishLandingPage({ projects, publications }, { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: page.draftRevision });
  if (!published.ok) throw new Error(published.code);
  const live = await publications.findActiveBySlug("pagina-publica");
  assert.ok(live);
  assert.equal(JSON.stringify(live.publication).includes("draftDocument"), false);
  const document = documentFromPublicationSnapshot(live.publication.snapshot);
  const preview = renderToStaticMarkup(createElement(LandingPageRenderer, { document, mode: "PREVIEW" }));
  const markup = renderToStaticMarkup(createElement(LandingPageRenderer, { document, mode: "PUBLIC", publicSlug: "pagina-publica", proofs: live.publication.snapshot.trustProofs }));
  assert.match(preview, /data-preview-action="disabled"/);
  assert.match(preview, /Envio desativado no modo de visualização/);
  assert.equal(preview.includes("https://wa.me/"), false);
  assert.equal(preview.includes("/api/public/"), false);
  assert.match(markup, /https:\/\/wa\.me\/5511999990000/);
  assert.match(markup, /noopener/);
  assert.equal(markup.includes("data-preview-action"), false);
  assert.equal(markup.includes("Conteúdo provisório"), false);
  assert.equal(markup.includes("Em revisão"), false);
  assert.equal(markup.includes("Wordmark"), false);
  const meta = publicLandingMetadata(live.publication.snapshot, "pagina-publica");
  assert.equal(meta.robots.index, false);
  assert.equal(meta.alternates.canonical, `${siteConfig.url}/p/pagina-publica`);
  assert.equal(meta.title.includes("Móveis"), true);
  assert.equal(await publications.findActiveBySlug("desconhecida"), null);

  const leads = createMemoryLandingPageLeadStore();
  const metrics = createMemoryLandingPageMetricStore();
  const deps = { publications, leads, metrics, consumeRateLimit: () => true, now: new Date("2026-10-22T12:00:00.000Z") };
  const submitted = await handlePublicLandingForm(deps, post({ values: { name: "Ana", email: "ana@example.com" }, submissionId: "submission-1", website: "", company_website: "" }), { slug: "pagina-publica", sectionId: "formulario" });
  assert.equal(submitted.status, 200);
  const body = await submitted.json() as { successMessage?: string; message?: string };
  assert.equal(body.successMessage, "Recebemos sua mensagem.");
  const stored = await leads.listForProject(page.id);
  assert.equal(stored.length, 1);
  assert.equal(stored[0]?.publicationId, published.publication.id);
  assert.equal(stored[0]?.landingPageProjectId, page.id);
  const duplicate = await handlePublicLandingForm(deps, post({ values: { name: "Ana", email: "ana@example.com" }, submissionId: "submission-1", website: "", company_website: "" }), { slug: "pagina-publica", sectionId: "formulario" });
  assert.equal(duplicate.status, 200);
  assert.equal((await leads.listForProject(page.id)).length, 1);

  const honeypot = await handlePublicLandingForm(deps, post({ values: { name: "Bot", email: "bot@example.com" }, submissionId: "submission-2", website: "https://spam.example" }), { slug: "pagina-publica", sectionId: "formulario" });
  assert.equal(honeypot.status, 200);
  assert.equal((await honeypot.text()).toLowerCase().includes("honeypot"), false);
  assert.equal((await leads.listForProject(page.id)).length, 1);

  const limited = await handlePublicLandingForm({ ...deps, consumeRateLimit: () => false }, post({ values: { name: "Ana", email: "ana@example.com" }, submissionId: "submission-3" }), { slug: "pagina-publica", sectionId: "formulario" });
  const limitedBody = await limited.json() as { message?: string };
  assert.equal(limited.status, 429);
  assert.equal(limitedBody.message, PUBLIC_FORM_RATE_LIMIT_MESSAGE);
  assert.equal(JSON.stringify(limitedBody).includes("prisma"), false);

  const invalid = await handlePublicLandingForm(deps, post({ values: { name: "Ana" }, submissionId: "submission-4" }), { slug: "pagina-publica", sectionId: "formulario" });
  assert.equal(invalid.status, 400);

  const failing = createMemoryLandingPageMetricStore();
  failing.increment = async () => { throw new Error("metric down"); };
  const savedAnyway = await handlePublicLandingForm({ ...deps, metrics: failing, leads: createMemoryLandingPageLeadStore() }, post({ values: { name: "Ana", email: "ana@example.com" }, submissionId: "submission-5" }), { slug: "pagina-publica", sectionId: "formulario" });
  assert.equal(savedAnyway.status, 200);

  const viewed = await handlePublicLandingEvent(deps, post({ eventType: "PAGE_VIEW" }), { slug: "pagina-publica" });
  assert.equal(viewed.status, 204);
  const clicked = await handlePublicLandingEvent(deps, post({ eventType: "WHATSAPP_CLICK" }), { slug: "pagina-publica" });
  assert.equal(clicked.status, 204);
  const started = await handlePublicLandingEvent(deps, post({ eventType: "FORM_START", sectionId: "formulario" }), { slug: "pagina-publica" });
  assert.equal(started.status, 204);
  const forged = await handlePublicLandingEvent(deps, post({ eventType: "FORM_SUBMIT" }), { slug: "pagina-publica" });
  assert.equal(forged.status, 400);
  const fingerprint = await handlePublicLandingEvent(deps, post({ eventType: "PAGE_VIEW", visitorId: "abc" }), { slug: "pagina-publica" });
  assert.equal(fingerprint.status, 400);
  const counts = await metrics.listForProject(page.id);
  assert.equal(counts.find((row) => row.eventType === "PAGE_VIEW" && row.publicationId === published.publication.id)?.count, 1);
  assert.equal(counts.find((row) => row.eventType === "CTA_CLICK")?.count, 1);
  assert.equal(counts.find((row) => row.eventType === "WHATSAPP_CLICK")?.count, 1);
  assert.equal(counts.find((row) => row.eventType === "FORM_START")?.count, 1);
  assert.equal(counts.some((row) => row.eventType === "FORM_SUBMIT" && row.count > 0), true);
  assert.equal(JSON.stringify(counts).includes("visitor"), false);
  assert.equal(Object.keys(counts[0] ?? {}).sort().join(), "count,date,eventType,landingPageProjectId,publicationId");

  const quiet = readyDocument(page.draftRevision);
  quiet.measurement.enabledEvents = ["WHATSAPP_CLICK"];
  quiet.measurement.primaryConversionEvent = "WHATSAPP_CLICK";
  const quietReady = evaluateLandingPagePublicationReadiness({ document: quiet, draftRevision: page.draftRevision, slug: page.slug, projectId: page.id });
  assert.equal(quietReady.ready, true);
  const previewMetrics = await recordLandingPageMeasurementEvents({ source: "PREVIEW", sink: metrics, landingPageProjectId: page.id, publicationId: published.publication.id, events: ["PAGE_VIEW"], date: "2026-10-22" });
  assert.equal(previewMetrics.recorded, false);

  assert.equal(resolveLandingPageAction({ type: "WHATSAPP", phone: "5511999990000" })?.href.startsWith("https://wa.me/"), true);
  assert.equal(resolveLandingPageAction({ type: "EXTERNAL_URL", url: "https://exemplo.com/contato" })?.external, true);
  assert.equal(landingPageActionSchema.safeParse({ type: "EXTERNAL_URL", url: "javascript:alert(1)" }).success, false);
  assert.equal(resolveLandingPageAction({ type: "INTERNAL_ROUTE", path: "/admin" }), null);
  assert.equal(resolveLandingPageAction({ type: "INTERNAL_ROUTE", path: "/app/projetos" }), null);
  assert.equal(isPublicInternalRouteAllowed("/diretor"), false);
  assert.equal(resolveLandingPageAction({ type: "FORM_ANCHOR", sectionId: "formulario" })?.href, "#formulario");
  assert.equal(reportPublicLandingEvent("pagina-publica", { eventType: "CTA_CLICK" }, async () => { throw new Error("down"); }), undefined);

  const tracker = createPublicLifecycleTracker();
  assert.equal(tracker.once("page"), true);
  assert.equal(tracker.once("page"), false);
  assert.equal(tracker.once("form"), true);
  assert.equal(tracker.once("form"), false);

  const removed = await unpublishLandingPage({ projects, publications }, { userId: "owner", landingPageProjectId: page.id });
  assert.equal(removed.ok, true);
  const hidden = await handlePublicLandingForm(deps, post({ values: { name: "Ana", email: "ana@example.com" }, submissionId: "submission-9" }), { slug: "pagina-publica", sectionId: "formulario" });
  assert.equal(hidden.status, 404);
});

test("mídia publicada não sai; mídia só do rascunho pode sair", async () => {
  const { projects, publications, page } = await readyPage("pagina-midia");
  const files = createMemoryLandingPageMediaStore();
  const storage: LandingPageMediaStorage = { async put() { return { url: "https://cdn.example/foto.jpg" }; }, async get() { return null; }, async delete() {} };
  const record = {
    id: "media-1",
    landingPageProjectId: page.id,
    userId: "owner",
    type: "HERO_IMAGE" as const,
    status: "READY" as const,
    storageKey: "media-1",
    publicUrl: "https://cdn.example/foto.jpg",
    mimeType: "image/jpeg",
    fileSize: 1000,
    width: 800,
    height: 600,
    altText: "Bancada",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await files.insert(record);
  await files.insert({ ...record, id: "media-2", storageKey: "media-2" });
  const document = readyDocument(page.draftRevision + 1);
  document.sections[0].content = { ...document.sections[0].content, mediaRef: { mediaId: "media-1", usage: "HERO", altText: "Bancada" } };
  const saved = await updateLandingPageDraft(projects, { userId: "owner", landingPageProjectId: page.id, expectedRevision: page.draftRevision, document });
  if (!saved.ok) throw new Error(saved.code);
  const input = [media(page.id)];
  const published = await publishLandingPage({ projects, publications, media: input }, { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: saved.value.draftRevision });
  assert.equal(published.ok, true);
  const blocked = await deleteLandingPageMedia(projects, files, storage, { userId: "owner", mediaId: "media-1" }, publications);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "LANDING_PAGE_MEDIA_IN_USE");
  const cleared = structuredClone(saved.value.draftDocument);
  const hero = cleared.sections.find((section) => section.type === "HERO");
  if (hero?.type === "HERO") {
    const content = { ...hero.content };
    delete content.mediaRef;
    hero.content = content;
  }
  cleared.experienceReview = review(saved.value.draftRevision + 1);
  const without = await updateLandingPageDraft(projects, { userId: "owner", landingPageProjectId: page.id, expectedRevision: saved.value.draftRevision, document: cleared });
  if (!without.ok) throw new Error(without.code);
  const stillBlocked = await deleteLandingPageMedia(projects, files, storage, { userId: "owner", mediaId: "media-1" }, publications);
  assert.equal(stillBlocked.ok, false);
  const unused = await deleteLandingPageMedia(projects, files, storage, { userId: "owner", mediaId: "media-2" }, publications);
  assert.equal(unused.ok, true);
  const rollback = await rollbackLandingPage({ projects, publications, media: [] }, { userId: "owner", landingPageProjectId: page.id, publicationId: published.ok ? published.publication.id : "" });
  assert.equal(rollback.ok, false);
  if (!rollback.ok) assert.equal(rollback.code, "LANDING_PAGE_ROLLBACK_UNAVAILABLE");
});

test("gate, privacidade, slug legado e sitemap", () => {
  assert.equal(landingPagePublicRuntimeEnabled({}), false);
  assert.equal(landingPagePublicRuntimeEnabled({ LANDING_PAGE_PUBLIC_RUNTIME_ENABLED: "true" }), true);
  assert.equal(landingPagePublicRuntimeEnabled({ LANDING_PAGE_PUBLIC_RUNTIME_ENABLED: "false" }), false);
  assert.equal(LIVE_MEDIA_STORE_READY, true);
  const gate = readFileSync("src/lib/landing-page/publication/gate.ts", "utf8");
  assert.equal(gate.includes("NEXT_PUBLIC_LANDING_PAGE_PUBLIC_RUNTIME_ENABLED"), false);
  const root = readFileSync("src/app/layout.tsx", "utf8");
  const landing = readFileSync("src/app/p/[slug]/page.tsx", "utf8");
  assert.equal(root.includes("GoogleTagManager"), false);
  assert.equal(landing.includes("GoogleTagManager"), false);
  assert.equal(landing.includes("fbq"), false);
  assert.equal(landing.includes("draftDocument"), false);
  assert.match(readFileSync("src/app/p/layout.tsx", "utf8"), /index: false/);
  assert.equal(buildPublicSitemap("https://alexandrefeio.com.br", { courses: [], lessons: [] }).some((entry) => entry.url.includes("/p/")), false);
  assert.equal(readFileSync("src/app/sitemap.ts", "utf8").includes("/p/"), false);
  const logged = publicationLogEvent({ projectId: "p", publicationId: "pub", version: 1, code: "PUBLISHED", phone: "5511999990000", copy: "texto" });
  assert.equal(JSON.stringify(logged).includes("5511"), false);
  assert.equal(JSON.stringify(logged).includes("texto"), false);
  const publicationSource = readFileSync("src/lib/landing-page/publication/service.ts", "utf8");
  assert.equal(publicationSource.includes("openai"), false);
  assert.equal(publicationSource.includes("LessonProgress"), false);
  assert.equal(sitesCourseSeed.status, "DRAFT");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(sitesCourseIsPubliclyVisible(), false);
  assert.equal(commerceStatusForCreate(), "NOT_FOR_SALE");

  const moduleId = "module-sites";
  assert.deepEqual(reconcileLesson11Slug({ courseModuleIds: [moduleId], lessons: [] }), { action: "none" });
  assert.deepEqual(
    reconcileLesson11Slug({ courseModuleIds: [moduleId], lessons: [{ id: "legacy", slug: SITE_LESSON_11_LEGACY_SLUG, moduleId }] }),
    { action: "rename", id: "legacy", from: SITE_LESSON_11_LEGACY_SLUG, to: SITE_LESSON_11_CANONICAL_SLUG },
  );
  assert.deepEqual(
    reconcileLesson11Slug({ courseModuleIds: [moduleId], lessons: [{ id: "canonical", slug: SITE_LESSON_11_CANONICAL_SLUG, moduleId }] }),
    { action: "none" },
  );
  assert.deepEqual(
    reconcileLesson11Slug({
      courseModuleIds: [moduleId],
      lessons: [
        { id: "canonical", slug: SITE_LESSON_11_CANONICAL_SLUG, moduleId },
        { id: "legacy", slug: SITE_LESSON_11_LEGACY_SLUG, moduleId },
      ],
    }),
    { action: "conflict" },
  );
  const deploy = readFileSync("src/lib/learning/catalog-deploy.ts", "utf8");
  assert.match(deploy, /reconcileSiteLesson11Slug/);
  assert.equal(deploy.includes("lesson.delete"), false);
});

test("markup público não estoura a largura", () => {
  const fixture = experienceReviewFixture();
  const markup = renderToStaticMarkup(createElement(LandingPageRenderer, { document: fixture.document, mode: "PUBLIC", media: fixture.media }));
  assert.match(markup, /overflow-x-hidden/);
  assert.equal(markup.includes("min-w-["), false);
  assert.match(markup, /data-section-id="hero"|Móveis sob medida/);
  assert.match(markup, /break-words/);
  const form = renderToStaticMarkup(createElement(LandingPageRenderer, { document: readyDocument(1), mode: "PUBLIC", publicSlug: "oficina-joao" }));
  assert.match(form, /name="name"/);
  assert.match(form, /type="submit"/);
  assert.equal(form.includes("Envio desativado"), false);
});
