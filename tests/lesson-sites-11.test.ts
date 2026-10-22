import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPageMeasurementEditor } from "../src/components/learning/LandingPageMeasurementEditor";
import { assessLesson } from "../src/lib/editorial/readiness";
import { lessonBlockDataSchema, TOOL_KEYS } from "../src/lib/learning/blocks";
import { siteLesson11Blocks, siteLesson11Meta } from "../src/lib/learning/site-configure-o-que-precisa-ser-medido";
import { sitesCourseIsPubliclyVisible, sitesCourseSeed } from "../src/lib/learning/sites-course";
import { createEmptyLandingPageDocument, landingPageDocumentSchema, type LandingPageDocumentV1 } from "../src/lib/landing-page/document";
import { experienceReviewEffectiveStatus } from "../src/lib/landing-page/experience/review";
import { LANDING_PAGE_FORM_FIELD_TYPES, LANDING_PAGE_FORM_LIMITS, landingPageFormContentSchema } from "../src/lib/landing-page/forms/schema";
import { createMemoryLandingPageStore } from "../src/lib/landing-page/memory-store";
import { availableLandingPageMeasurementEvents, recommendLandingPageMeasurement } from "../src/lib/landing-page/measurement/availability";
import {
  futurePublicationBlockedByStaleExperienceReview,
  measurementJourneySteps,
  measurementLessonResult,
  measurementRecommendationCopy,
  measurementSetup,
  MEASUREMENT_RESULT_TITLE,
  SITE_MEASUREMENT_SLUG,
} from "../src/lib/landing-page/measurement/lesson-flow";
import { saveLandingPageMeasurementLesson } from "../src/lib/landing-page/measurement/lesson-plan";
import { buildLandingPageMeasurementSummary } from "../src/lib/landing-page/measurement/summary";
import { createMemoryLandingPageMetricStore, recordLandingPageMeasurementEvents } from "../src/lib/landing-page/measurement/metrics";
import { createLandingPageProject } from "../src/lib/landing-page/service";
import type { MeasurementPageView } from "../src/lib/landing-page/measurement/lesson-flow";

const visual = { backgroundRole: "DEFAULT" as const, alignment: "LEFT" as const, emphasis: "NORMAL" as const };
const phone = "5511999990000";
const externalUrl = "https://orcamento.example/pedido";

function pageDocument(): LandingPageDocumentV1 {
  const document = createEmptyLandingPageDocument();
  document.conversion.primaryAction = { type: "WHATSAPP", phone, message: "Olá" };
  document.conversion.businessOutcome = "Conversar com quem precisa do serviço";
  document.sections = [
    {
      id: "hero",
      type: "HERO",
      variant: "default",
      order: 0,
      enabled: true,
      contentStatus: "APPROVED",
      content: { headline: "Móveis sob medida", primaryCta: { type: "WHATSAPP", phone } },
      settings: visual,
    },
    {
      id: "formulario",
      type: "FORM",
      variant: "default",
      order: 1,
      enabled: true,
      contentStatus: "APPROVED",
      content: { heading: "Mensagem", intro: "Deixe um recado.", fields: ["name", "email"], submitLabel: "Enviar", successMessage: "Recebemos sua mensagem." },
      settings: visual,
    },
  ];
  return landingPageDocumentSchema.parse(document);
}

function reviewAt(revision: number) {
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

async function readyProject(document = pageDocument()) {
  const store = createMemoryLandingPageStore({ courseIdBySlug: { "sites-que-convertem": "course-sites" } });
  const created = await createLandingPageProject(store, { userId: "owner", title: "Página", slug: "pagina-medida" });
  if (!created.ok) throw new Error(created.code);
  document.experienceReview = reviewAt(2);
  document.strategy = {
    ...document.strategy,
    experienceReview: {
      version: 1,
      status: "READY_FOR_NEXT_STEP",
      reviewedDraftRevision: 2,
      reviewedViewports: ["DESKTOP"],
      openBlockerCount: 0,
      openAttentionCount: 0,
      deferredCount: 0,
    },
  };
  const saved = await store.updateDraftAtomic({
    id: created.value.id,
    userId: "owner",
    expectedRevision: 1,
    document,
    status: "READY_TO_PREVIEW",
  });
  if (!saved.ok) throw new Error(saved.reason);
  return { store, page: saved.record };
}

const whatsappPlan = {
  version: 1 as const,
  primaryConversionEvent: "WHATSAPP_CLICK" as const,
  enabledEvents: ["PAGE_VIEW", "CTA_CLICK", "WHATSAPP_CLICK"] as const,
};

test("aula 11 tem 33 blocos, 4 checkpoints, ferramenta e transição", () => {
  assert.equal(siteLesson11Blocks.length, 33);
  assert.equal(siteLesson11Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 4);
  const tool = siteLesson11Blocks.find((block) => block.data.type === "TOOL");
  const result = siteLesson11Blocks.find((block) => block.data.type === "RESULT");
  assert.equal(tool?.data.type === "TOOL" && tool.data.toolKey, "LANDING_PAGE_MEASUREMENT_PLAN_V1");
  assert.equal(result?.data.type === "RESULT" && result.data.title, MEASUREMENT_RESULT_TITLE);
  assert.equal(siteLesson11Meta.estimatedMinutes, 30);
  assert.equal(siteLesson11Meta.accessType, "PAID");
  assert.equal(siteLesson11Meta.priceCents, 3990);
  assert.equal(siteLesson11Meta.commerceStatus, "NOT_FOR_SALE");
  assert.equal(SITE_MEASUREMENT_SLUG, "configure-o-que-precisa-ser-medido");
  const text = siteLesson11Blocks.map((block) => JSON.stringify(block.data)).join("\n");
  assert.match(text, /Publicar uma página sem definir o que observar pode fazer você receber números sem saber o que eles significam/);
  assert.match(text, /GA4/);
  assert.match(text, /GTM/);
  assert.match(text, /Meta Pixel/);
  assert.match(text, /Agora você não tem apenas uma ação na página/);
  assert.match(text, /Na última etapa, vamos revisar tudo o que foi construído, corrigir pendências e colocar sua landing page no ar/);
  assert.equal(text.includes("tempo real"), false);
  assert.equal(text.includes("CTR"), false);
  assert.equal(text.includes("melhor métrica para seu negócio"), false);
  for (const block of siteLesson11Blocks) assert.equal(lessonBlockDataSchema.safeParse(block.data).success, true);
  const assessment = assessLesson(
    { ...siteLesson11Meta, status: "PUBLISHED" },
    siteLesson11Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.equal(assessment.ready, true, assessment.issues.join(" "));
  const checkpoints = siteLesson11Blocks.filter((block) => block.data.type === "CHECKPOINT");
  assert.equal(checkpoints[0]?.data.type === "CHECKPOINT" && checkpoints[0].data.correctOptionId, "nao");
  assert.equal(checkpoints[1]?.data.type === "CHECKPOINT" && checkpoints[1].data.correctOptionId, "sim");
  assert.equal(checkpoints[2]?.data.type === "CHECKPOINT" && checkpoints[2].data.correctOptionId, "nao");
  assert.equal(checkpoints[3]?.data.type === "CHECKPOINT" && checkpoints[3].data.correctOptionId, "sim");
  const lesson = sitesCourseSeed.modules.flatMap((module) => module.lessons).find((item) => item.slug === SITE_MEASUREMENT_SLUG);
  assert.equal(lesson?.plannedTool, "LANDING_PAGE_MEASUREMENT_PLAN_V1");
  assert.equal(lesson?.plannedResult, MEASUREMENT_RESULT_TITLE);
  assert.equal(sitesCourseSeed.status, "DRAFT");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(sitesCourseIsPubliclyVisible(), false);
  assert.equal((TOOL_KEYS as readonly string[]).includes("LANDING_PAGE_MEASUREMENT_PLAN_V1"), true);
  assert.equal(existsSync("src/app/p"), false);
  assert.equal(existsSync("src/lib/learning/site-revisao-antes-do-trafego.ts"), false);
});

test("a ferramenta exige projeto, seções e posse", async () => {
  assert.equal(measurementSetup({ pageCount: 0, sectionCount: 2 }), "NO_PROJECT");
  assert.equal(measurementSetup({ pageCount: 1, sectionCount: 0 }), "NO_SECTIONS");
  const { store, page } = await readyProject();
  const empty = pageDocument();
  empty.sections = [];
  const cleared = await store.updateDraftAtomic({
    id: page.id,
    userId: "owner",
    expectedRevision: page.draftRevision,
    document: empty,
    status: "READY_TO_PREVIEW",
  });
  if (!cleared.ok) throw new Error(cleared.reason);
  const missingSections = await saveLandingPageMeasurementLesson(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: cleared.record.draftRevision,
    measurement: whatsappPlan,
    confirmed: true,
  });
  assert.equal(missingSections.ok, false);
  if (missingSections.ok) return;
  assert.equal(missingSections.code, "INVALID_INPUT");
  const { store: owned, page: ownedPage } = await readyProject();
  const denied = await saveLandingPageMeasurementLesson(owned, {
    userId: "outra-pessoa",
    landingPageProjectId: ownedPage.id,
    expectedRevision: ownedPage.draftRevision,
    measurement: whatsappPlan,
    confirmed: true,
  });
  assert.equal(denied.ok, false);
  if (denied.ok) return;
  assert.equal(denied.code, "NOT_FOUND");
  assert.equal(ownedPage.draftRevision, (await owned.findByIdForUser(ownedPage.id, "owner"))?.draftRevision);
});

test("ação, eventos e conversão principal seguem a página real", async () => {
  const whatsapp = pageDocument();
  assert.equal(recommendLandingPageMeasurement(whatsapp).primaryConversionEvent, "WHATSAPP_CLICK");
  assert.match(measurementRecommendationCopy(whatsapp) ?? "", /clique no WhatsApp parece ser o sinal mais próximo/);
  assert.equal((measurementRecommendationCopy(whatsapp) ?? "").includes("melhor métrica para seu negócio"), false);
  assert.ok(availableLandingPageMeasurementEvents(whatsapp).includes("PAGE_VIEW"));
  assert.ok(availableLandingPageMeasurementEvents(whatsapp).includes("CTA_CLICK"));
  assert.ok(availableLandingPageMeasurementEvents(whatsapp).includes("WHATSAPP_CLICK"));
  assert.ok(availableLandingPageMeasurementEvents(whatsapp).includes("FORM_SUBMIT"));

  const external = pageDocument();
  external.conversion.primaryAction = { type: "EXTERNAL_URL", url: externalUrl };
  external.sections = external.sections.filter((section) => section.type !== "FORM");
  const hero = external.sections.find((section) => section.id === "hero");
  if (hero?.type === "HERO") hero.content = { headline: "Móveis sob medida", primaryCta: { type: "EXTERNAL_URL", url: externalUrl } };
  assert.equal(recommendLandingPageMeasurement(external).primaryConversionEvent, "CTA_CLICK");
  assert.equal(availableLandingPageMeasurementEvents(external).includes("WHATSAPP_CLICK"), false);
  assert.equal(availableLandingPageMeasurementEvents(external).includes("FORM_START"), false);
  assert.equal(availableLandingPageMeasurementEvents(external).includes("FORM_SUBMIT"), false);
  assert.match(measurementRecommendationCopy(external) ?? "", /não controla o que acontece no destino/);

  const form = pageDocument();
  form.conversion.primaryAction = { type: "FORM_ANCHOR", sectionId: "formulario" };
  assert.equal(recommendLandingPageMeasurement(form).primaryConversionEvent, "FORM_SUBMIT");
  assert.match(measurementRecommendationCopy(form) ?? "", /envio aceito/);

  const internal = pageDocument();
  internal.conversion.primaryAction = { type: "INTERNAL_ROUTE", path: "/contato" };
  assert.equal(recommendLandingPageMeasurement(internal).primaryConversionEvent, "CTA_CLICK");

  const { store, page } = await readyProject();
  const invalidPhone = await saveLandingPageMeasurementLesson(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    action: { type: "WHATSAPP", phone: "123" },
    measurement: whatsappPlan,
    confirmed: true,
  });
  assert.equal(invalidPhone.ok, false);
  const unsafe = await saveLandingPageMeasurementLesson(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    action: { type: "EXTERNAL_URL", url: "javascript:alert(1)" },
    measurement: { version: 1, primaryConversionEvent: "CTA_CLICK", enabledEvents: ["PAGE_VIEW", "CTA_CLICK"] },
    confirmed: true,
  });
  assert.equal(unsafe.ok, false);
  const missingForm = await saveLandingPageMeasurementLesson(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    action: { type: "FORM_ANCHOR", sectionId: "nao-existe" },
    measurement: { version: 1, primaryConversionEvent: "FORM_SUBMIT", enabledEvents: ["PAGE_VIEW", "FORM_SUBMIT"] },
    confirmed: true,
  });
  assert.equal(missingForm.ok, false);
  const unavailable = await saveLandingPageMeasurementLesson(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    measurement: { version: 1, primaryConversionEvent: "WHATSAPP_CLICK", enabledEvents: ["PAGE_VIEW"] },
    confirmed: true,
  });
  assert.equal(unavailable.ok, false);
  if (unavailable.ok) return;
  assert.equal(unavailable.code, "LANDING_PAGE_MEASUREMENT_INVALID");
  const unconfirmed = await saveLandingPageMeasurementLesson(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    measurement: whatsappPlan,
    confirmed: false,
  });
  assert.equal(unconfirmed.ok, false);
  assert.equal((await store.findByIdForUser(page.id, "owner"))?.draftRevision, page.draftRevision);
  const internalSave = await saveLandingPageMeasurementLesson(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    action: { type: "INTERNAL_ROUTE", path: "/contato" },
    measurement: { version: 1, primaryConversionEvent: "CTA_CLICK", enabledEvents: ["PAGE_VIEW", "CTA_CLICK"] },
    confirmed: true,
  });
  assert.equal(internalSave.ok, true);
  if (!internalSave.ok) return;
  assert.equal(internalSave.value.draftDocument.conversion.primaryAction?.type, "INTERNAL_ROUTE");

  const { store: externalStore, page: externalPage } = await readyProject(external);
  const impossible = await saveLandingPageMeasurementLesson(externalStore, {
    userId: "owner",
    landingPageProjectId: externalPage.id,
    expectedRevision: externalPage.draftRevision,
    measurement: { version: 1, primaryConversionEvent: "FORM_SUBMIT", enabledEvents: ["PAGE_VIEW", "CTA_CLICK", "FORM_SUBMIT"] },
    confirmed: true,
  });
  assert.equal(impossible.ok, false);
});

test("formulário respeita limite, obrigatoriedade e tipos fechados", () => {
  assert.deepEqual([...LANDING_PAGE_FORM_FIELD_TYPES], ["NAME", "EMAIL", "PHONE", "COMPANY", "MESSAGE"]);
  const fields = Array.from({ length: 8 }, (_, index) => ({
    id: `campo${index + 1}`,
    type: "NAME" as const,
    label: "Nome",
    required: false,
  }));
  assert.equal(landingPageFormContentSchema.safeParse({ fields }).success, true);
  assert.equal(landingPageFormContentSchema.safeParse({ fields: [...fields, { id: "extra", type: "EMAIL", label: "E-mail", required: false }] }).success, false);
  assert.equal(landingPageFormContentSchema.safeParse({ fields: [{ id: "email", type: "EMAIL", label: "x".repeat(81), required: true }] }).success, false);
  assert.equal(
    landingPageFormContentSchema.safeParse({
      fields: [
        { id: "email", type: "EMAIL", label: "E-mail", required: true },
        { id: "telefone", type: "PHONE", label: "Telefone", required: false },
      ],
    }).success,
    true,
  );
  assert.equal(LANDING_PAGE_FORM_LIMITS.maxFields, 8);
});

test("plano confirmado grava resumo, jornada e não inventa métrica", async () => {
  const { store, page } = await readyProject();
  const saved = await saveLandingPageMeasurementLesson(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    action: page.draftDocument.conversion.primaryAction,
    form: {
      sectionId: "formulario",
      content: {
        heading: "Mensagem",
        intro: "Deixe um recado.",
        fields: [
          { id: "name", type: "NAME", label: "Nome", required: true },
          { id: "email", type: "EMAIL", label: "E-mail", required: true },
        ],
        submitLabel: "Enviar",
        successMessage: "Recebemos sua mensagem.",
      },
    },
    measurement: whatsappPlan,
    confirmed: true,
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.value.status, "READY_TO_PREVIEW");
  assert.equal(saved.value.draftRevision, page.draftRevision + 1);
  assert.equal(saved.value.draftDocument.measurement.primaryConversionEvent, "WHATSAPP_CLICK");
  assert.equal(saved.value.draftDocument.strategy?.measurementPlan?.confirmed, true);
  assert.equal(saved.value.draftDocument.strategy?.measurementPlan?.version, 1);
  assert.equal(saved.value.draftDocument.strategy?.measurementPlan?.formPresent, true);
  assert.deepEqual(saved.value.draftDocument.measurement.enabledEvents, ["PAGE_VIEW", "CTA_CLICK", "WHATSAPP_CLICK"]);
  const journey = measurementJourneySteps(saved.value.draftDocument.measurement.enabledEvents, "WHATSAPP_CLICK");
  assert.equal(journey.at(-1)?.primary, true);
  assert.equal(journey.some((step) => "rate" in step), false);
  const summary = buildLandingPageMeasurementSummary(saved.value.draftDocument);
  assert.equal(summary.counts, null);
  const result = measurementLessonResult({
    landingPageProjectId: saved.value.id,
    document: saved.value.draftDocument,
    draftRevision: saved.value.draftRevision,
    completedAt: "2026-10-22T15:00:00.000Z",
  });
  assert.ok(result);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(phone), false);
  assert.equal(serialized.includes("wa.me"), false);
  assert.equal(serialized.includes("https://"), false);
  assert.equal(serialized.includes("ana@"), false);
  assert.equal(result?.formFieldCount, 2);
  assert.equal(result?.formPresent, true);
  assert.equal(result?.measurementConfirmed, true);
  assert.equal(result?.experienceReviewStatus, "READY_FOR_NEXT_STEP");
  assert.equal(experienceReviewEffectiveStatus(saved.value.draftDocument, saved.value.draftRevision), "READY_FOR_NEXT_STEP");
  assert.equal(futurePublicationBlockedByStaleExperienceReview(saved.value.draftDocument, saved.value.draftRevision), false);
  const hero = saved.value.draftDocument.sections.find((section) => section.id === "hero");
  assert.equal(hero?.type === "HERO" && hero.content.headline, "Móveis sob medida");
  const conflict = await saveLandingPageMeasurementLesson(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    measurement: whatsappPlan,
    confirmed: true,
  });
  assert.equal(conflict.ok, false);
  if (conflict.ok) return;
  assert.equal(conflict.code, "LANDING_PAGE_DRAFT_CONFLICT");
});

test("só a mensuração mantém a revisão; ação ou formulário a deixam desatualizada", async () => {
  const { store, page } = await readyProject();
  const measured = await saveLandingPageMeasurementLesson(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    measurement: whatsappPlan,
    confirmed: true,
  });
  assert.equal(measured.ok, true);
  if (!measured.ok) return;
  assert.equal(measured.value.draftDocument.conversion.primaryAction?.type === "WHATSAPP" && measured.value.draftDocument.conversion.primaryAction.phone, phone);
  assert.equal(experienceReviewEffectiveStatus(measured.value.draftDocument, measured.value.draftRevision), "READY_FOR_NEXT_STEP");

  const changedAction = await saveLandingPageMeasurementLesson(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: measured.value.draftRevision,
    action: { type: "EXTERNAL_URL", url: externalUrl },
    measurement: { version: 1, primaryConversionEvent: "CTA_CLICK", enabledEvents: ["PAGE_VIEW", "CTA_CLICK"] },
    confirmed: true,
  });
  assert.equal(changedAction.ok, true);
  if (!changedAction.ok) return;
  assert.equal(experienceReviewEffectiveStatus(changedAction.value.draftDocument, changedAction.value.draftRevision), "STALE");
  assert.equal(futurePublicationBlockedByStaleExperienceReview(changedAction.value.draftDocument, changedAction.value.draftRevision), true);
  const staleResult = measurementLessonResult({
    landingPageProjectId: changedAction.value.id,
    document: changedAction.value.draftDocument,
    draftRevision: changedAction.value.draftRevision,
    completedAt: "2026-10-22T15:00:00.000Z",
  });
  assert.equal(staleResult?.experienceReviewStatus, "STALE");
  assert.equal(JSON.stringify(staleResult).includes(externalUrl), false);
  assert.equal(changedAction.value.status, "READY_TO_PREVIEW");

  const { store: formStore, page: formPage } = await readyProject();
  const changedForm = await saveLandingPageMeasurementLesson(formStore, {
    userId: "owner",
    landingPageProjectId: formPage.id,
    expectedRevision: formPage.draftRevision,
    form: {
      sectionId: "formulario",
      content: {
        heading: "Pedido de orçamento",
        intro: "Conte o que você precisa.",
        fields: [
          { id: "email", type: "EMAIL", label: "E-mail", required: true },
          { id: "telefone", type: "PHONE", label: "Telefone", required: false },
        ],
        submitLabel: "Pedir orçamento",
        successMessage: "Recebemos seu pedido.",
      },
    },
    measurement: { version: 1, primaryConversionEvent: "FORM_SUBMIT", enabledEvents: ["PAGE_VIEW", "FORM_START", "FORM_SUBMIT"] },
    confirmed: true,
  });
  assert.equal(changedForm.ok, true);
  if (!changedForm.ok) return;
  assert.equal(experienceReviewEffectiveStatus(changedForm.value.draftDocument, changedForm.value.draftRevision), "STALE");
  const formResult = measurementLessonResult({
    landingPageProjectId: changedForm.value.id,
    document: changedForm.value.draftDocument,
    draftRevision: changedForm.value.draftRevision,
    completedAt: "2026-10-22T15:00:00.000Z",
  });
  assert.equal(formResult?.primaryConversionEvent, "FORM_SUBMIT");
  assert.equal(formResult?.formFieldCount, 2);
  assert.equal(formResult?.experienceReviewStatus, "STALE");
  const hero = changedForm.value.draftDocument.sections.find((section) => section.id === "hero");
  assert.equal(hero?.type === "HERO" && hero.content.headline, "Móveis sob medida");
});

test("preview e simulação não abrem destino, não enviam formulário e não gravam métrica", async () => {
  const document = pageDocument();
  const page: MeasurementPageView = {
    id: "sintetica",
    title: "Sintética",
    status: "READY_TO_PREVIEW",
    draftRevision: 1,
    setup: "READY",
    effectiveStatus: "NOT_REVIEWED",
    document,
  };
  const markup = renderToStaticMarkup(createElement(LandingPageMeasurementEditor, { page, onSave: async () => undefined }));
  assert.equal(markup.includes("wa.me"), false);
  assert.equal(markup.includes("javascript:"), false);
  assert.match(markup, /data-preview-action="disabled"/);
  assert.match(markup, /data-preview-form="disabled"/);
  assert.match(markup, /data-preview-destination="configured"/);
  assert.match(markup, /Envio desativado no modo de visualização/);
  assert.match(markup, /Envio será ativado na página publicada/);
  assert.match(markup, /overflow-x-hidden/);
  assert.match(markup, /max-w-full/);
  assert.equal(markup.includes("min-w-["), false);
  const editorSource = readFileSync("src/components/learning/LandingPageMeasurementEditor.tsx", "utf8");
  assert.match(editorSource, /data-measurement-simulation/);
  assert.match(editorSource, /MEASUREMENT_DATA_LATER_COPY/);
  assert.equal(editorSource.includes("wa.me"), false);
  for (const width of [320, 375, 768, 1280]) {
    const framed = renderToStaticMarkup(createElement("div", { style: { width }, "data-width": width }, createElement(LandingPageMeasurementEditor, { page, onSave: async () => undefined })));
    assert.match(framed, /overflow-x-hidden/);
    assert.equal(framed.includes("min-w-["), false);
  }
  const metrics = createMemoryLandingPageMetricStore();
  const recorded = await recordLandingPageMeasurementEvents({
    source: "PREVIEW",
    sink: metrics,
    landingPageProjectId: "sintetica",
    publicationId: "pub",
    events: ["PAGE_VIEW", "WHATSAPP_CLICK", "FORM_SUBMIT"],
    date: "2026-10-22",
  });
  assert.equal(recorded.recorded, false);
  assert.equal((await metrics.listForProject("sintetica")).length, 0);
  const planSource = readFileSync("src/lib/landing-page/measurement/lesson-plan.ts", "utf8");
  assert.equal(planSource.includes("recordLandingPageMeasurementEvents"), false);
  assert.equal(planSource.includes("submitLandingPageForm"), false);
  assert.equal(planSource.toLowerCase().includes("openai"), false);
  assert.equal(planSource.includes("gtag"), false);
  assert.equal(planSource.includes("googletagmanager"), false);
  const devPage = readFileSync("src/app/dev/landing-measurement-lesson/page.tsx", "utf8");
  assert.match(devPage, /notFound/);
  assert.match(devPage, /index: false/);
  const missing = measurementLessonResult({
    landingPageProjectId: "sintetica",
    document,
    draftRevision: 1,
    completedAt: "2026-10-22T15:00:00.000Z",
  });
  assert.equal(missing, null);
});
