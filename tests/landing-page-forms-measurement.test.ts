import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPageRenderer } from "../src/components/landing-page/LandingPageRenderer";
import { buildSafeWhatsAppUrl, landingPageActionSchema } from "../src/lib/landing-page/actions";
import { resolveLandingPageAction } from "../src/lib/landing-page/action-resolver";
import { validateLandingPageAction } from "../src/lib/landing-page/action-validation";
import { commerceStatusForCreate } from "../src/lib/learning/catalog-commerce";
import { TOOL_KEYS } from "../src/lib/learning/blocks";
import { sitesCourseIsPubliclyVisible, sitesCourseSeed } from "../src/lib/learning/sites-course";
import {
  createEmptyLandingPageDocument,
  createLandingPageProject,
  createMemoryLandingPageStore,
  landingPageDocumentSchema,
  landingPageMeasurementSchema,
  updateLandingPageDraft,
} from "../src/lib/landing-page";
import {
  saveLandingPageConversionMeasurementPlan,
  updateLandingPageActionConfiguration,
  updateLandingPageFormConfiguration,
  updateLandingPageMeasurement,
} from "../src/lib/landing-page/conversion/service";
import { EXPERIENCE_CAPABILITIES_V1 } from "../src/lib/landing-page/experience/schema";
import { evaluateLandingPageExperience } from "../src/lib/landing-page/experience/evaluate";
import { experienceReviewEffectiveStatus } from "../src/lib/landing-page/experience/review";
import { saveLandingPageExperienceReview } from "../src/lib/landing-page/experience/service";
import { validateLandingPageFormPayload } from "../src/lib/landing-page/forms/payload";
import { consumeLandingPageFormRateLimit, resetLandingPageFormRateLimit } from "../src/lib/landing-page/forms/rate-limit";
import { landingPageFormContentSchema, LANDING_PAGE_FORM_FIELD_TYPES, LANDING_PAGE_FORM_LIMITS, type LandingPageFormFieldInput } from "../src/lib/landing-page/forms/schema";
import { submitLandingPageForm } from "../src/lib/landing-page/forms/submit";
import { consultoriaLandingFixture } from "../src/lib/landing-page/fixtures";
import { archiveLandingPageLead, getLandingPageLead, listLandingPageLeads } from "../src/lib/landing-page/leads/service";
import { createMemoryLandingPageLeadStore } from "../src/lib/landing-page/leads/store";
import { recommendLandingPageMeasurement } from "../src/lib/landing-page/measurement/availability";
import { createMemoryLandingPageMetricStore, landingPageClickEvents, recordLandingPageMeasurementEvents } from "../src/lib/landing-page/measurement/metrics";
import { LANDING_PAGE_MEASUREMENT_EVENTS, LANDING_PAGE_MEASUREMENT_LABELS } from "../src/lib/landing-page/measurement/schema";
import { summarizeLandingPageMetrics } from "../src/lib/landing-page/measurement/service";
import { buildLandingPageMeasurementSummary } from "../src/lib/landing-page/measurement/summary";
import { validateLandingPageMeasurement } from "../src/lib/landing-page/measurement/validate";
import type { LandingPageDocumentV1 } from "../src/lib/landing-page/document";

const visual = { backgroundRole: "DEFAULT" as const, alignment: "LEFT" as const, emphasis: "NORMAL" as const };
const allow = () => true;

function pageDocument(): LandingPageDocumentV1 {
  const document = createEmptyLandingPageDocument();
  document.conversion.primaryAction = { type: "WHATSAPP", phone: "5511999990000", message: "Olá" };
  document.sections = [
    {
      id: "hero",
      type: "HERO",
      variant: "default",
      order: 0,
      enabled: true,
      contentStatus: "APPROVED",
      content: { headline: "Móveis sob medida", primaryCta: { type: "WHATSAPP", phone: "5511999990000" } },
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

function reviewAt(revision: number) {
  return {
    version: 1 as const,
    reviewedDraftRevision: revision,
    reviewedViewports: ["DESKTOP" as const],
    checklist: [],
    findings: [],
    summary: {
      status: "NEEDS_ADJUSTMENTS" as const,
      headline: "Precisa de ajustes" as const,
      openBlockerCount: 0,
      openAttentionCount: 0,
      deferredCount: 0,
    },
  };
}

async function readyProject() {
  const store = createMemoryLandingPageStore({ courseIdBySlug: { "sites-que-convertem": "course-sites" } });
  const created = await createLandingPageProject(store, { userId: "owner", title: "Página", slug: "pagina-medida" });
  if (!created.ok) throw new Error(created.code);
  const document = pageDocument();
  document.experienceReview = reviewAt(2);
  document.strategy = {
    experienceReview: {
      version: 1,
      status: "NEEDS_ADJUSTMENTS",
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

function formContent(fields: LandingPageFormFieldInput[]) {
  return landingPageFormContentSchema.parse({ heading: "Mensagem", fields, submitLabel: "Enviar" });
}

test("formulário V1 valida campos, limites e recusa HTML", () => {
  const valid = landingPageFormContentSchema.safeParse({
    heading: "Mensagem",
    intro: "Conte o que precisa.",
    fields: [
      { id: "nome", type: "NAME", label: "Nome", required: true },
      { id: "empresa", type: "COMPANY", label: "Empresa", required: false, placeholder: "Opcional" },
    ],
    submitLabel: "Enviar",
    successMessage: "Recebemos sua mensagem.",
  });
  assert.equal(valid.success, true);
  assert.equal(landingPageFormContentSchema.safeParse({ fields: [{ id: "cpf", type: "CPF", label: "CPF", required: true }] }).success, false);
  assert.equal(landingPageFormContentSchema.safeParse({ fields: [{ id: "senha", type: "PASSWORD", label: "Senha", required: true }] }).success, false);
  assert.equal(landingPageFormContentSchema.safeParse({ fields: [{ id: "arquivo", type: "FILE", label: "Arquivo", required: true }] }).success, false);
  assert.equal(landingPageFormContentSchema.safeParse({ fields: [{ id: "nota", type: "SHORT_TEXT", label: "Nota", required: true }] }).success, false);
  const tooMany = Array.from({ length: LANDING_PAGE_FORM_LIMITS.maxFields + 1 }, (_, index) => ({
    id: `campo-${index}`,
    type: "NAME" as const,
    label: "Nome",
    required: false,
  }));
  assert.equal(landingPageFormContentSchema.safeParse({ fields: tooMany }).success, false);
  assert.equal(landingPageFormContentSchema.safeParse({
    fields: [
      { id: "nome", type: "NAME", label: "Nome", required: true },
      { id: "nome", type: "NAME", label: "Outro nome", required: false },
    ],
  }).success, false);
  assert.equal(landingPageFormContentSchema.safeParse({ fields: [{ id: "nome", type: "NAME", label: "<b>Nome</b>", required: true }] }).success, false);
  assert.equal(landingPageFormContentSchema.safeParse({ fields: ["name"], successMessage: "<script>" }).success, false);
  assert.deepEqual(LANDING_PAGE_FORM_FIELD_TYPES, ["NAME", "EMAIL", "PHONE", "COMPANY", "MESSAGE"]);

  const content = formContent([
    { id: "nome", type: "NAME", label: "Nome", required: true },
    { id: "telefone", type: "PHONE", label: "Telefone", required: false },
    { id: "recado", type: "MESSAGE", label: "Mensagem", required: false },
  ]);
  assert.equal(validateLandingPageFormPayload(content, { nome: "Ana" }).ok, true);
  assert.equal(validateLandingPageFormPayload(content, {}).ok, false);
  assert.equal(validateLandingPageFormPayload(content, { nome: "Ana", telefone: "123" }).ok, false);
  assert.equal(validateLandingPageFormPayload(content, { nome: "Ana", telefone: "(11) 99999-0000" }).ok, true);
  const email = formContent([{ id: "email", type: "EMAIL", label: "E-mail", required: true }]);
  assert.equal(validateLandingPageFormPayload(email, { email: "ana@example.com" }).ok, true);
  assert.equal(validateLandingPageFormPayload(email, { email: "ana" }).ok, false);
  assert.equal(validateLandingPageFormPayload(content, { nome: "A".repeat(121) }).ok, false);
  assert.equal(validateLandingPageFormPayload(content, { nome: "Ana", recado: "B".repeat(2001) }).ok, false);
  assert.equal(validateLandingPageFormPayload(content, { nome: "<b>Ana</b>" }).ok, false);
  const phoneOnly = validateLandingPageFormPayload(content, { nome: "Ana", telefone: "(11) 99999-0000" });
  assert.equal(phoneOnly.ok, true);
  if (phoneOnly.ok) assert.equal(phoneOnly.data.telefone, "11999990000");
});

test("ação valida WhatsApp, URL https e formulário da mesma página", () => {
  const document = pageDocument();
  assert.equal(buildSafeWhatsAppUrl("(11) 99999-0000", "Quero conversar")?.startsWith("https://wa.me/11999990000?text="), true);
  assert.equal(buildSafeWhatsAppUrl("5511<script>99990000"), null);
  assert.equal(buildSafeWhatsAppUrl("javascript:alert(1)"), null);
  assert.equal(validateLandingPageAction({ type: "WHATSAPP", phone: "5511999990000" }, document).ok, true);
  assert.equal(validateLandingPageAction({ type: "WHATSAPP", phone: "123" }, document).ok, false);
  assert.equal(validateLandingPageAction({ type: "EXTERNAL_URL", url: "https://exemplo.com/contato" }, document).ok, true);
  assert.equal(landingPageActionSchema.safeParse({ type: "EXTERNAL_URL", url: "http://exemplo.com" }).success, false);
  assert.equal(landingPageActionSchema.safeParse({ type: "EXTERNAL_URL", url: "javascript:alert(1)" }).success, false);
  assert.equal(landingPageActionSchema.safeParse({ type: "EXTERNAL_URL", url: "data:text/html,hi" }).success, false);
  assert.equal(landingPageActionSchema.safeParse({ type: "EXTERNAL_URL", url: "file:///tmp/a" }).success, false);
  assert.equal(validateLandingPageAction({ type: "FORM_ANCHOR", sectionId: "formulario" }, document).ok, true);
  assert.equal(validateLandingPageAction({ type: "FORM_ANCHOR", sectionId: "ausente" }, document).ok, false);
  assert.equal(validateLandingPageAction({ type: "FORM_ANCHOR" }, document).ok, false);
  const first = resolveLandingPageAction({ type: "EXTERNAL_URL", url: "https://exemplo.com/a", label: "Quero conversar" });
  const second = resolveLandingPageAction({ type: "EXTERNAL_URL", url: "https://exemplo.com/b", label: "Quero conversar" });
  assert.equal(first?.label, "Quero conversar");
  assert.notEqual(first?.href, second?.href);
  assert.equal(resolveLandingPageAction({ type: "WHATSAPP", phone: "5511999990000" })?.href.startsWith("https://wa.me/5511999990000"), true);
});

test("envio grava um lead, respeita honeypot, limite e idempotência", async () => {
  const document = pageDocument();
  const publication = { id: "pub-1", landingPageProjectId: "lp-1" };
  const leads = createMemoryLandingPageLeadStore();
  const metrics = createMemoryLandingPageMetricStore();
  const logs: Array<{ code: string }> = [];
  const base = {
    landingPageProjectId: "lp-1",
    publication,
    formSectionId: "formulario",
    document,
    idempotencyKey: "envio-001",
  };
  const sent = await submitLandingPageForm(
    { leads, metrics, consumeRateLimit: allow, log: (event) => logs.push(event) },
    { ...base, payload: { name: "Ana", email: "ana@example.com" } },
  );
  assert.equal(sent.ok && sent.accepted && !sent.duplicate, true);
  if (!sent.ok || !sent.accepted) return;
  assert.equal((await leads.listForProject("lp-1")).length, 1);
  assert.equal((await metrics.listForProject("lp-1")).find((row) => row.eventType === "FORM_SUBMIT")?.count, 1);

  const again = await submitLandingPageForm(
    { leads, metrics, consumeRateLimit: () => false },
    { ...base, payload: { name: "Ana", email: "ana@example.com" } },
  );
  assert.equal(again.ok && again.accepted && again.duplicate, true);
  assert.equal((await leads.listForProject("lp-1")).length, 1);
  assert.equal((await metrics.listForProject("lp-1")).find((row) => row.eventType === "FORM_SUBMIT")?.count, 1);

  const missing = await submitLandingPageForm(
    { leads, metrics, consumeRateLimit: allow },
    { ...base, idempotencyKey: "envio-002", payload: { email: "ana@example.com" } },
  );
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.code, "INVALID");
  const badEmail = await submitLandingPageForm(
    { leads, metrics, consumeRateLimit: allow },
    { ...base, idempotencyKey: "envio-003", payload: { name: "Ana", email: "ana" } },
  );
  assert.equal(badEmail.ok, false);
  const huge = await submitLandingPageForm(
    { leads, metrics, consumeRateLimit: allow },
    { ...base, idempotencyKey: "envio-004", payload: { name: "A".repeat(LANDING_PAGE_FORM_LIMITS.payloadJson) } },
  );
  assert.equal(huge.ok, false);
  const trap = await submitLandingPageForm(
    { leads, metrics, consumeRateLimit: allow },
    { ...base, idempotencyKey: "envio-005", payload: { name: "Ana", email: "spam@example.com", website: "http://spam.example" } },
  );
  assert.equal(trap.ok && trap.accepted, false);
  assert.equal((await leads.listForProject("lp-1")).some((lead) => JSON.stringify(lead.submittedData).includes("spam@")), false);
  assert.equal((await metrics.listForProject("lp-1")).find((row) => row.eventType === "FORM_SUBMIT")?.count, 1);

  let attempts = 0;
  const limited = await submitLandingPageForm(
    { leads, metrics, consumeRateLimit: () => { attempts += 1; return false; } },
    { ...base, idempotencyKey: "envio-006", payload: { name: "Ana", email: "ana@example.com" } },
  );
  assert.equal(limited.ok, false);
  if (!limited.ok) assert.equal(limited.code, "RATE_LIMITED");
  assert.equal(attempts, 1);
  assert.equal(await submitLandingPageForm(
    { leads, metrics, consumeRateLimit: allow },
    { ...base, landingPageProjectId: "lp-2", publication: { id: "pub-1", landingPageProjectId: "lp-1" }, idempotencyKey: "envio-007", payload: { name: "Ana", email: "ana@example.com" } },
  ).then((result) => result.ok ? "" : result.code), "UNAVAILABLE");

  const failing = createMemoryLandingPageMetricStore();
  failing.increment = async () => { throw new Error("metric down ana@example.com"); };
  const kept = await submitLandingPageForm(
    { leads, metrics: failing, consumeRateLimit: allow, log: (event) => logs.push(event) },
    { ...base, idempotencyKey: "envio-008", payload: { name: "Bia", email: "bia@example.com" } },
  );
  assert.equal(kept.ok && kept.accepted && !kept.duplicate, true);
  assert.equal((await leads.listForProject("lp-1")).length, 2);
  assert.equal(JSON.stringify(logs).includes("bia@example.com"), false);
  assert.equal(JSON.stringify(logs).includes("ana@example.com"), false);
});

test("lead fica com o dono e a métrica não carrega dado pessoal", async () => {
  const { store, page } = await readyProject();
  const other = createMemoryLandingPageStore({ courseIdBySlug: { "sites-que-convertem": "course-sites" } });
  const outsider = await createLandingPageProject(other, { userId: "outra", title: "Outra", slug: "outra-pagina" });
  if (!outsider.ok) throw new Error(outsider.code);
  const leads = createMemoryLandingPageLeadStore();
  const metrics = createMemoryLandingPageMetricStore();
  const document = page.draftDocument;
  const sent = await submitLandingPageForm(
    { leads, metrics, consumeRateLimit: allow },
    {
      landingPageProjectId: page.id,
      publication: { id: "pub-1", landingPageProjectId: page.id },
      formSectionId: "formulario",
      document,
      idempotencyKey: "envio-dono",
      payload: { name: "Ana", email: "ana@example.com" },
    },
  );
  if (!sent.ok || !sent.accepted) throw new Error("envio");
  const owned = await listLandingPageLeads(store, leads, { userId: "owner", landingPageProjectId: page.id });
  assert.equal(owned.ok, true);
  const denied = await listLandingPageLeads(store, leads, { userId: "outra", landingPageProjectId: page.id });
  assert.equal(denied.ok, false);
  const read = await getLandingPageLead(store, leads, { userId: "owner", landingPageProjectId: page.id, leadId: sent.leadId });
  assert.equal(read.ok, true);
  const hidden = await getLandingPageLead(store, leads, { userId: "outra", landingPageProjectId: outsider.value.id, leadId: sent.leadId });
  assert.equal(hidden.ok, false);
  const archived = await archiveLandingPageLead(store, leads, { userId: "owner", landingPageProjectId: page.id, leadId: sent.leadId });
  assert.equal(archived.ok && archived.value.status, "ARCHIVED");
  const blocked = await archiveLandingPageLead(store, leads, { userId: "outra", landingPageProjectId: page.id, leadId: sent.leadId });
  assert.equal(blocked.ok, false);

  const summary = await summarizeLandingPageMetrics(store, metrics, { userId: "owner", landingPageProjectId: page.id });
  assert.equal(summary.ok, true);
  if (!summary.ok) return;
  assert.equal(JSON.stringify(summary.value).includes("ana@example.com"), false);
  assert.equal(JSON.stringify(summary.value).includes("Móveis"), false);
  assert.equal(JSON.stringify(await metrics.listForProject(page.id)).includes("visitor"), false);
  const outsiderSummary = await summarizeLandingPageMetrics(store, metrics, { userId: "outra", landingPageProjectId: page.id });
  assert.equal(outsiderSummary.ok, false);
});

test("mensuração aceita só eventos possíveis e resume sem números", () => {
  const document = pageDocument();
  const suggested = recommendLandingPageMeasurement(document);
  assert.equal(suggested.primaryConversionEvent, "WHATSAPP_CLICK");
  assert.equal(suggested.enabledEvents.includes("PAGE_VIEW"), true);
  assert.equal(suggested.enabledEvents.includes("FORM_SUBMIT"), true);
  const saved = { version: 1 as const, primaryConversionEvent: "WHATSAPP_CLICK" as const, enabledEvents: suggested.enabledEvents };
  const valid = validateLandingPageMeasurement(document, saved);
  assert.equal(valid.valid, true);
  assert.equal("score" in valid, false);
  assert.equal(validateLandingPageMeasurement(document, { version: 1, primaryConversionEvent: null, enabledEvents: ["PAGE_VIEW"] }).valid, false);
  assert.equal(validateLandingPageMeasurement(document, { version: 1, primaryConversionEvent: "FORM_SUBMIT", enabledEvents: ["FORM_SUBMIT"] }).valid, true);
  const external = pageDocument();
  external.conversion.primaryAction = { type: "EXTERNAL_URL", url: "https://exemplo.com/contato" };
  external.sections = external.sections.filter((section) => section.type !== "FORM");
  for (const section of external.sections) {
    if (section.type === "HERO") section.content.primaryCta = { type: "EXTERNAL_URL", url: "https://exemplo.com/contato" };
    if (section.type === "CTA") section.content.action = { type: "EXTERNAL_URL", url: "https://exemplo.com/contato" };
  }
  assert.equal(validateLandingPageMeasurement(external, { version: 1, primaryConversionEvent: "WHATSAPP_CLICK", enabledEvents: ["WHATSAPP_CLICK"] }).valid, false);
  assert.equal(validateLandingPageMeasurement(external, { version: 1, primaryConversionEvent: "FORM_SUBMIT", enabledEvents: ["FORM_SUBMIT"] }).valid, false);
  assert.equal(validateLandingPageMeasurement(external, { version: 1, primaryConversionEvent: "CTA_CLICK", enabledEvents: ["PAGE_VIEW", "CTA_CLICK"] }).valid, true);
  assert.equal(validateLandingPageMeasurement(external, { version: 1, primaryConversionEvent: "PAGE_VIEW", enabledEvents: ["PAGE_VIEW", "CTA_CLICK"] }).valid, true);
  assert.deepEqual(landingPageMeasurementSchema.parse({ enabled: false, events: ["page_view", "booking_click"] }).enabledEvents, []);
  assert.deepEqual(landingPageMeasurementSchema.parse({ enabled: true, events: ["page_view", "custom_conversion"] }).enabledEvents, ["PAGE_VIEW"]);
  const summary = buildLandingPageMeasurementSummary(document);
  assert.equal(summary.primaryAction, "WhatsApp");
  assert.equal(summary.primaryConversion, "Ainda não confirmada");
  assert.equal(summary.counts, null);
  assert.equal(summary.availableEvents.some((event) => event.label === LANDING_PAGE_MEASUREMENT_LABELS.PAGE_VIEW), true);
  assert.deepEqual(LANDING_PAGE_MEASUREMENT_EVENTS, ["PAGE_VIEW", "CTA_CLICK", "WHATSAPP_CLICK", "FORM_START", "FORM_SUBMIT"]);
});

test("contadores diários separam publicação e data e não guardam visita bruta", async () => {
  const metrics = createMemoryLandingPageMetricStore();
  const projectId = "lp-metric";
  await metrics.increment({ landingPageProjectId: projectId, publicationId: "pub-a", date: "2026-10-22", eventType: "PAGE_VIEW" });
  await metrics.increment({ landingPageProjectId: projectId, publicationId: "pub-a", date: "2026-10-22", eventType: "PAGE_VIEW" });
  await metrics.increment({ landingPageProjectId: projectId, publicationId: "pub-b", date: "2026-10-22", eventType: "PAGE_VIEW" });
  await metrics.increment({ landingPageProjectId: projectId, publicationId: "pub-a", date: "2026-10-23", eventType: "PAGE_VIEW" });
  await recordLandingPageMeasurementEvents({
    source: "PUBLIC",
    sink: metrics,
    landingPageProjectId: projectId,
    publicationId: "pub-a",
    date: "2026-10-22",
    events: landingPageClickEvents("WHATSAPP"),
  });
  await recordLandingPageMeasurementEvents({
    source: "PUBLIC",
    sink: metrics,
    landingPageProjectId: projectId,
    publicationId: "pub-a",
    date: "2026-10-22",
    events: ["FORM_START"],
  });
  const preview = await recordLandingPageMeasurementEvents({
    source: "PREVIEW",
    sink: metrics,
    landingPageProjectId: projectId,
    publicationId: "pub-a",
    date: "2026-10-22",
    events: ["PAGE_VIEW", "CTA_CLICK", "FORM_SUBMIT"],
  });
  assert.equal(preview.recorded, false);
  const rows = await metrics.listForProject(projectId);
  assert.equal(rows.find((row) => row.publicationId === "pub-a" && row.date === "2026-10-22" && row.eventType === "PAGE_VIEW")?.count, 2);
  assert.equal(rows.find((row) => row.publicationId === "pub-b" && row.eventType === "PAGE_VIEW")?.count, 1);
  assert.equal(rows.find((row) => row.date === "2026-10-23" && row.eventType === "PAGE_VIEW")?.count, 1);
  assert.equal(rows.find((row) => row.eventType === "CTA_CLICK")?.count, 1);
  assert.equal(rows.find((row) => row.eventType === "WHATSAPP_CLICK")?.count, 1);
  assert.equal(rows.find((row) => row.eventType === "FORM_START")?.count, 1);
  assert.equal(rows.some((row) => row.eventType === "FORM_SUBMIT"), false);
  assert.equal(JSON.stringify(rows).includes("email"), false);
  assert.equal(JSON.stringify(rows).includes("cookie"), false);
  assert.deepEqual(landingPageClickEvents("WHATSAPP"), ["CTA_CLICK", "WHATSAPP_CLICK"]);
  assert.deepEqual(landingPageClickEvents("EXTERNAL_URL"), ["CTA_CLICK"]);
  assert.equal(Object.keys(rows[0] ?? {}).sort().join(), "count,date,eventType,landingPageProjectId,publicationId");
});

test("preview não mede, não grava lead e mostra destino sem abrir", () => {
  const html = renderToStaticMarkup(createElement(LandingPageRenderer, { document: consultoriaLandingFixture(), mode: "PREVIEW", media: [] }));
  assert.match(html, /data-preview-action="disabled"/);
  assert.match(html, /Destino configurado/);
  assert.match(html, /Envio desativado no modo de visualização/);
  assert.equal(html.includes("https://wa.me/"), false);
  assert.equal(html.includes("type=\"submit\""), true);
  assert.match(html, /disabled/);
  const renderer = readFileSync("src/components/landing-page/LandingPageRenderer.tsx", "utf8");
  assert.equal(renderer.includes("recordLandingPageMeasurementEvents"), false);
  assert.equal(renderer.includes("submitLandingPageForm"), false);
});

test("ação e formulário deixam a revisão stale; mensuração sozinha não", async () => {
  const { store, page } = await readyProject();
  assert.equal(page.status, "READY_TO_PREVIEW");
  assert.equal(experienceReviewEffectiveStatus(page.draftDocument, page.draftRevision), "NEEDS_ADJUSTMENTS");
  const measured = await updateLandingPageMeasurement(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    measurement: {
      version: 1,
      primaryConversionEvent: "WHATSAPP_CLICK",
      enabledEvents: ["PAGE_VIEW", "CTA_CLICK", "WHATSAPP_CLICK", "FORM_START", "FORM_SUBMIT"],
    },
  });
  assert.equal(measured.ok, true);
  if (!measured.ok) return;
  assert.equal(experienceReviewEffectiveStatus(measured.value.draftDocument, measured.value.draftRevision), "NEEDS_ADJUSTMENTS");
  assert.equal(measured.value.draftDocument.strategy?.measurementPlan?.primaryConversionEvent, "WHATSAPP_CLICK");
  assert.equal(JSON.stringify(measured.value.draftDocument.strategy?.measurementPlan).includes("ana@"), false);
  const before = measured.value.draftDocument.sections.find((section) => section.type === "CTA");
  const changed = await updateLandingPageActionConfiguration(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: measured.value.draftRevision,
    target: { kind: "SECTION", sectionId: "cta" },
    action: { type: "WHATSAPP", phone: "5511988887777" },
  });
  assert.equal(changed.ok, true);
  if (!changed.ok) return;
  assert.equal(experienceReviewEffectiveStatus(changed.value.draftDocument, changed.value.draftRevision), "STALE");
  const cta = changed.value.draftDocument.sections.find((section) => section.id === "cta");
  assert.equal(cta?.type === "CTA" && cta.content.heading, "Quero conversar");
  assert.equal(cta?.type === "CTA" && cta.content.action.type === "WHATSAPP" && cta.content.action.phone, "5511988887777");
  assert.equal(before?.type === "CTA" && before.content.description, "A conversa começa por aqui.");
  assert.deepEqual(changed.value.draftDocument.theme, page.draftDocument.theme);
  assert.equal(changed.value.status, "READY_TO_PREVIEW");
  const rereviewed = await saveLandingPageExperienceReview(store, null, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: changed.value.draftRevision,
    review: { reviewedViewports: ["DESKTOP"], checklist: [], userFindings: [], decisions: [] },
  });
  assert.equal(rereviewed.ok, true);
  if (!rereviewed.ok) return;
  assert.notEqual(experienceReviewEffectiveStatus(rereviewed.value.draftDocument, rereviewed.value.draftRevision), "STALE");
  const formed = await updateLandingPageFormConfiguration(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: rereviewed.value.draftRevision,
    sectionId: "formulario",
    content: { heading: "Mensagem", fields: [{ id: "nome", type: "NAME", label: "Nome", required: true }], submitLabel: "Enviar" },
  });
  assert.equal(formed.ok, true);
  if (!formed.ok) return;
  assert.equal(experienceReviewEffectiveStatus(formed.value.draftDocument, formed.value.draftRevision), "STALE");
  const hero = formed.value.draftDocument.sections.find((section) => section.id === "hero");
  assert.equal(hero?.type === "HERO" && hero.content.headline, "Móveis sob medida");
});

test("plano de conversão e mensuração grava uma vez e as capacidades ficam no núcleo", async () => {
  const { store, page } = await readyProject();
  const saved = await saveLandingPageConversionMeasurementPlan(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    action: { target: { kind: "PRIMARY" }, action: { type: "FORM_ANCHOR", sectionId: "formulario" } },
    form: { sectionId: "formulario", content: { heading: "Mensagem", fields: ["name", "phone"], submitLabel: "Enviar" } },
    measurement: { version: 1, primaryConversionEvent: "FORM_SUBMIT", enabledEvents: ["PAGE_VIEW", "CTA_CLICK", "FORM_START", "FORM_SUBMIT"] },
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.value.draftRevision, page.draftRevision + 1);
  assert.equal(saved.value.draftDocument.conversion.primaryAction?.type, "FORM_ANCHOR");
  assert.equal(experienceReviewEffectiveStatus(saved.value.draftDocument, saved.value.draftRevision), "STALE");
  assert.equal(saved.value.status, "READY_TO_PREVIEW");
  assert.deepEqual(EXPERIENCE_CAPABILITIES_V1, { formsFunctional: true, publicationAvailable: true, measurementAvailable: true });
  const withForm = pageDocument();
  assert.equal(evaluateLandingPageExperience(withForm).some((finding) => finding.code === "FORM_PLATFORM_UNAVAILABLE"), false);
  assert.equal(evaluateLandingPageExperience(withForm, { capabilities: { formsFunctional: false, publicationAvailable: false, measurementAvailable: true } }).some((finding) => finding.code === "FORM_PLATFORM_UNAVAILABLE"), true);
  assert.equal(existsSync("src/app/p/[slug]/page.tsx"), true);
  assert.match(readFileSync("src/app/p/layout.tsx", "utf8"), /index: false/);
  assert.equal(existsSync("src/lib/learning/site-mensuracao-da-pagina.ts"), false);
  assert.equal((TOOL_KEYS as readonly string[]).includes("LANDING_PAGE_MEASUREMENT_V1"), false);
  assert.equal(sitesCourseSeed.status, "PUBLISHED");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(sitesCourseIsPubliclyVisible(), true);
  assert.equal(commerceStatusForCreate(), "NOT_FOR_SALE");
  const migration = readFileSync("prisma/migrations/20261022120000_add_landing_page_forms_measurement/migration.sql", "utf8");
  assert.equal(/drop|truncate/i.test(migration), false);
  assert.match(migration, /CREATE TABLE "landing_page_lead"/);
  assert.match(migration, /CREATE TABLE "landing_page_metric_daily"/);
  assert.equal(migration.includes("ip"), false);
  assert.equal(migration.includes("userAgent"), false);
  assert.equal(migration.includes("visitor"), false);
  const submitSource = readFileSync("src/lib/landing-page/forms/submit.ts", "utf8");
  const metricSource = readFileSync("src/lib/landing-page/measurement/metrics.ts", "utf8");
  assert.equal(/trackEvent|gtag|dataLayer|openai/i.test(submitSource + metricSource), false);
  assert.match(metricSource, /sem fingerprint/);
  assert.equal(metricSource.includes("visitorId"), false);
  resetLandingPageFormRateLimit();
  const firstVisitor = await consumeLandingPageFormRateLimit({ publicationId: "publicacao-a", abuseKey: "visitante-a" }, 1_000);
  const secondVisitor = await consumeLandingPageFormRateLimit({ publicationId: "publicacao-a", abuseKey: "visitante-b" }, 1_000);
  const otherPublication = await consumeLandingPageFormRateLimit({ publicationId: "publicacao-b", abuseKey: "visitante-a" }, 1_000);
  assert.equal(firstVisitor.allowed, true);
  assert.equal(secondVisitor.allowed, true);
  assert.equal(otherPublication.allowed, true);
  const parsed = landingPageDocumentSchema.safeParse(createEmptyLandingPageDocument());
  assert.equal(parsed.success, true);
  const preserved = await updateLandingPageDraft(store, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: saved.value.draftRevision,
    document: saved.value.draftDocument,
  });
  assert.equal(preserved.ok, true);
});
