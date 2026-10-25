import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPageRenderer } from "../src/components/landing-page/LandingPageRenderer";
import { resolveLandingPageAction } from "../src/lib/landing-page/action-resolver";
import { createEmptyLandingPageDocument, type LandingPageDocumentV1 } from "../src/lib/landing-page/document";
import { consumeLandingPageFormRateLimit, resetLandingPageFormRateLimit } from "../src/lib/landing-page/forms/rate-limit";
import { submitLandingPageForm } from "../src/lib/landing-page/forms/submit";
import { createMemoryLandingPageLeadStore } from "../src/lib/landing-page/leads/store";
import { inspectLandingPageImage } from "../src/lib/landing-page/media/bytes";
import { cleanupLandingPageMediaOrphans } from "../src/lib/landing-page/media/orphan-cleanup";
import type { LandingPageMediaRecord } from "../src/lib/landing-page/media/record";
import { consumeLandingPageMediaRateLimit, resetLandingPageMediaRateLimit } from "../src/lib/landing-page/media/rate-limit";
import { createMemoryLandingPageStore } from "../src/lib/landing-page/memory-store";
import { createMemoryLandingPageMetricStore } from "../src/lib/landing-page/measurement/metrics";
import { LIVE_MEDIA_STORE_READY, landingPagePublicRouteEnabled, landingPagePublicRuntimeEnabled } from "../src/lib/landing-page/publication/gate";
import { handlePublicLandingEvent, handlePublicLandingForm, PUBLIC_FORM_RATE_LIMIT_MESSAGE } from "../src/lib/landing-page/publication/http";
import { isPublicInternalRouteAllowed } from "../src/lib/landing-page/publication/internal-route";
import { createMemoryLandingPagePublicationStore } from "../src/lib/landing-page/publication/memory-store";
import { publicationLogEvent, publishLandingPage, republishLandingPage, unpublishLandingPage } from "../src/lib/landing-page/publication/service";
import { createPublicLifecycleTracker } from "../src/lib/landing-page/publication/lifecycle";
import {
  CAPTCHA_REQUIRED_AT_LAUNCH,
  evaluateLandingPageProductionReadinessConfig,
  evaluateLandingPagePublicReleaseReadiness,
  LEAD_RETENTION_POLICY,
  MEDIA_RETENTION_POLICY,
  METRICS_RETENTION_POLICY,
  PRIVACY_POLICY_UPDATE_REQUIRED,
} from "../src/lib/landing-page/publication/release-readiness";
import { documentFromPublicationSnapshot } from "../src/lib/landing-page/publication/snapshot";
import { clientAddressLabel, landingPageAbuseKey } from "../src/lib/landing-page/rate-limit/abuse-key";
import { createMemoryDurableRateLimiter } from "../src/lib/landing-page/rate-limit/durable";
import { LANDING_PAGE_RATE_POLICIES } from "../src/lib/landing-page/rate-limit/policies";
import { landingPageRateLimitSecret } from "../src/lib/landing-page/rate-limit/secret";
import { consumeCopyAssistRateLimit, resetCopyAssistRateLimit } from "../src/lib/landing-page/copy/rate-limit";
import { createLandingPageProject, updateLandingPageDraft } from "../src/lib/landing-page/service";
import { consultoriaLandingFixture } from "../src/lib/landing-page/fixtures";

const visual = { backgroundRole: "DEFAULT" as const, alignment: "LEFT" as const, emphasis: "NORMAL" as const };
const SECRET = "test-rate-limit-secret-with-32-chars";

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

function readyDocument(revision: number): LandingPageDocumentV1 {
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
      content: { heading: "Conversar", description: "A conversa começa por aqui.", action: { type: "WHATSAPP", phone: "5511999990000" } },
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
  return document;
}

async function publishedPage() {
  const projects = createMemoryLandingPageStore({ courseIdBySlug: { "sites-que-convertem": "course-sites" } });
  const publications = createMemoryLandingPagePublicationStore(projects);
  const created = await createLandingPageProject(projects, { userId: "owner", title: "Oficina", slug: "oficina-sintetica" });
  if (!created.ok) throw new Error(created.code);
  const saved = await updateLandingPageDraft(projects, {
    userId: "owner",
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    document: readyDocument(created.value.draftRevision + 1),
  });
  if (!saved.ok) throw new Error(saved.code);
  const published = await publishLandingPage(
    { projects, publications },
    { userId: "owner", landingPageProjectId: saved.value.id, expectedDraftRevision: saved.value.draftRevision },
  );
  if (!published.ok) throw new Error(published.code);
  return { projects, publications, page: saved.value };
}

function post(body: unknown, headers?: Record<string, string>) {
  return new Request("https://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://localhost", host: "localhost", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function media(id: string, status: LandingPageMediaRecord["status"], ageMs: number): LandingPageMediaRecord {
  const updatedAt = new Date(Date.now() - ageMs);
  return {
    id,
    landingPageProjectId: "projeto",
    userId: "owner",
    type: "HERO_IMAGE",
    status,
    storageKey: `landing-media/${id}`,
    publicUrl: "https://example.blob.vercel-storage.com/sintetico.png",
    mimeType: "image/png",
    fileSize: 32,
    width: 1,
    height: 1,
    altText: "Imagem sintética",
    createdAt: updatedAt,
    updatedAt,
  };
}

test("limitador durável separa chave, visitante, projeto e janela", async () => {
  const limiter = createMemoryDurableRateLimiter();
  const input = { namespace: "landing-copy", key: "user-a", limit: 2, windowSeconds: 600, now: 1_000 };
  assert.equal((await limiter.consume(input)).allowed, true);
  assert.equal((await limiter.consume(input)).allowed, true);
  const blocked = await limiter.consume(input);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok((blocked.retryAfterSeconds ?? 0) > 0);
  assert.equal((await limiter.consume({ ...input, key: "user-b" })).allowed, true);
  assert.equal((await limiter.consume({ ...input, namespace: "landing-form", key: "publicacao-a:visitante-a" })).allowed, true);
  assert.equal((await limiter.consume({ ...input, namespace: "landing-form", key: "publicacao-a:visitante-b" })).allowed, true);
  assert.equal((await limiter.consume({ ...input, namespace: "landing-form", key: "publicacao-b:visitante-a" })).allowed, true);
  assert.equal((await limiter.consume({ ...input, now: 1_000 + 600_000 })).allowed, true);
  const raw = "203.0.113.8";
  await limiter.consume({ ...input, key: raw });
  assert.equal(JSON.stringify(limiter.snapshot()).includes(raw), false);
});

test("consumo concorrente não ultrapassa o limite", async () => {
  const limiter = createMemoryDurableRateLimiter();
  const results = await Promise.all(
    Array.from({ length: 20 }, () => limiter.consume({ namespace: "landing-copy", key: "user-a", limit: 10, windowSeconds: 600, now: 5_000 })),
  );
  assert.equal(results.filter((item) => item.allowed).length, 10);
});

test("copy, upload e formulário usam o limitador durável por dono ou visitante", async () => {
  resetCopyAssistRateLimit();
  for (let index = 0; index < LANDING_PAGE_RATE_POLICIES.copy.limit; index += 1) {
    assert.equal(await consumeCopyAssistRateLimit("user-copy", 2_000), true);
  }
  assert.equal(await consumeCopyAssistRateLimit("user-copy", 2_000), false);
  assert.equal(await consumeCopyAssistRateLimit("user-outro", 2_000), true);
  resetLandingPageMediaRateLimit();
  for (let index = 0; index < LANDING_PAGE_RATE_POLICIES.mediaUpload.limit; index += 1) {
    assert.equal(await consumeLandingPageMediaRateLimit("user-media", 2_000), true);
  }
  assert.equal(await consumeLandingPageMediaRateLimit("user-media", 2_000), false);
  resetLandingPageFormRateLimit();
  for (let index = 0; index < LANDING_PAGE_RATE_POLICIES.form.limit; index += 1) {
    assert.equal((await consumeLandingPageFormRateLimit({ publicationId: "pub-a", abuseKey: "pessoa-a" }, 2_000)).allowed, true);
  }
  assert.equal((await consumeLandingPageFormRateLimit({ publicationId: "pub-a", abuseKey: "pessoa-a" }, 2_000)).allowed, false);
  assert.equal((await consumeLandingPageFormRateLimit({ publicationId: "pub-a", abuseKey: "pessoa-b" }, 2_000)).allowed, true);
  assert.equal((await consumeLandingPageFormRateLimit({ publicationId: "pub-b", abuseKey: "pessoa-a" }, 2_000)).allowed, true);
});

test("chave de abuso muda com o tempo e não devolve o endereço", () => {
  const address = "203.0.113.9";
  const first = landingPageAbuseKey({ secret: SECRET, address, namespace: "landing-form", now: 1_000, windowSeconds: 600 });
  const same = landingPageAbuseKey({ secret: SECRET, address, namespace: "landing-form", now: 2_000, windowSeconds: 600 });
  const later = landingPageAbuseKey({ secret: SECRET, address, namespace: "landing-form", now: 601_000, windowSeconds: 600 });
  const other = landingPageAbuseKey({ secret: SECRET, address: "198.51.100.4", namespace: "landing-form", now: 1_000, windowSeconds: 600 });
  assert.equal(first, same);
  assert.notEqual(first, later);
  assert.notEqual(first, other);
  assert.equal(first.includes(address), false);
  assert.equal(clientAddressLabel(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })), "203.0.113.9");
  assert.equal(landingPageRateLimitSecret({}), null);
  assert.equal(landingPageRateLimitSecret({ LANDING_PAGE_RATE_LIMIT_SECRET: "curto" }), null);
  assert.equal(landingPageRateLimitSecret({ LANDING_PAGE_RATE_LIMIT_SECRET: SECRET }), SECRET);
  const source = readFileSync("src/lib/landing-page/rate-limit/secret.ts", "utf8");
  assert.equal(source.includes("NEXT_PUBLIC_"), false);
  assert.equal(source.includes("fallback"), false);
});

test("migration do limitador é só aditiva e não tem coluna de endereço", () => {
  const sql = readFileSync("prisma/migrations/20261022180000_add_landing_page_release_hardening/migration.sql", "utf8");
  assert.equal(/drop table|truncate|delete from/i.test(sql), false);
  assert.match(sql, /CREATE TABLE "landing_page_rate_limit_bucket"/);
  assert.match(sql, /ADD COLUMN "archivedAt"/);
  assert.equal(sql.toLowerCase().includes("inet"), false);
  assert.equal(sql.includes("rawAddress"), false);
});

test("formulário público recusa tipo, tamanho, schema e honeypot sem explicar o bot", async () => {
  const { publications, page } = await publishedPage();
  const leads = createMemoryLandingPageLeadStore();
  const metrics = createMemoryLandingPageMetricStore();
  const active = await publications.findActiveBySlug("oficina-sintetica");
  if (!active) throw new Error("missing");
  const deps = { publications, leads, metrics, consumeRateLimit: () => true, now: new Date("2026-10-22T12:00:00.000Z") };
  const wrongType = await handlePublicLandingForm(deps, new Request("https://localhost/api", { method: "POST", headers: { "content-type": "text/plain", host: "localhost" }, body: "{}" }), {
    slug: "oficina-sintetica",
    sectionId: "formulario",
  });
  assert.equal(wrongType.status, 415);
  const huge = await handlePublicLandingForm(deps, post("x".repeat(9000)), { slug: "oficina-sintetica", sectionId: "formulario" });
  assert.equal(huge.status, 413);
  const invalid = await handlePublicLandingForm(deps, post({ submissionId: "envio-curto", values: { name: "Ana" } }), { slug: "oficina-sintetica", sectionId: "formulario" });
  assert.equal(invalid.status, 400);
  const honeypot = await handlePublicLandingForm(
    deps,
    post({ submissionId: "envio-honeypot", values: { name: "Ana", email: "ana@example.com" }, website: "https://spam.example" }),
    { slug: page.slug, sectionId: "formulario" },
  );
  assert.equal(honeypot.status, 200);
  const honeypotBody = await honeypot.json();
  assert.equal(honeypotBody.accepted, true);
  assert.equal((await leads.listForProject(page.id)).length, 0);
  assert.equal(JSON.stringify(honeypotBody).toLowerCase().includes("honeypot"), false);
});

test("idempotência concorrente grava um lead e a métrica falha sem desfazer o envio", async () => {
  const { publications, page } = await publishedPage();
  const leads = createMemoryLandingPageLeadStore();
  const metrics = createMemoryLandingPageMetricStore();
  const document = documentFromPublicationSnapshot((await publications.findActiveBySlug(page.slug))?.publication.snapshot);
  if (!document) throw new Error("snapshot");
  const input = {
    landingPageProjectId: page.id,
    publication: { id: (await publications.findActiveBySlug(page.slug))!.publication.id, landingPageProjectId: page.id },
    formSectionId: "formulario",
    document,
    payload: { name: "Ana", email: "ana@example.com", website: "", company_website: "" },
    idempotencyKey: "envio-concorrente",
  };
  const results = await Promise.all([
    submitLandingPageForm({ leads, metrics, consumeRateLimit: () => true }, input),
    submitLandingPageForm({ leads, metrics, consumeRateLimit: () => true }, input),
  ]);
  assert.equal(results.filter((item) => item.ok && item.accepted).length, 2);
  assert.equal((await leads.listForProject(page.id)).length, 1);
  const failing = createMemoryLandingPageMetricStore();
  failing.increment = async () => {
    throw new Error("metric down");
  };
  const saved = await submitLandingPageForm(
    { leads, metrics: failing, consumeRateLimit: () => true, log: (event) => assert.equal(event.code, "METRIC_WRITE_FAILED") },
    { ...input, idempotencyKey: "envio-metrica" },
  );
  assert.equal(saved.ok, true);
  if (saved.ok && "accepted" in saved && saved.accepted) assert.equal(saved.duplicate, false);
  assert.equal((await leads.listForProject(page.id)).length, 2);
});

test("evento público aceita só a lista, ignora projeto do cliente e limita sem bloquear a ação", async () => {
  const { publications } = await publishedPage();
  const metrics = createMemoryLandingPageMetricStore();
  const deps = { publications, metrics, consumeEventLimit: async () => ({ allowed: true }) };
  const submit = await handlePublicLandingEvent(deps, post({ eventType: "FORM_SUBMIT" }), { slug: "oficina-sintetica" });
  assert.equal(submit.status, 400);
  const extra = await handlePublicLandingEvent(deps, post({ eventType: "PAGE_VIEW", email: "ana@example.com" }), { slug: "oficina-sintetica" });
  assert.equal(extra.status, 400);
  const foreign = await handlePublicLandingEvent(deps, post({ eventType: "PAGE_VIEW", projectId: "outro-projeto" }), { slug: "oficina-sintetica" });
  assert.equal(foreign.status, 400);
  const view = await handlePublicLandingEvent(deps, post({ eventType: "PAGE_VIEW" }), { slug: "oficina-sintetica" });
  assert.equal(view.status, 204);
  const limited = await handlePublicLandingEvent(
    { publications, metrics, consumeEventLimit: async () => ({ allowed: false, retryAfterSeconds: 12 }) },
    post({ eventType: "CTA_CLICK" }),
    { slug: "oficina-sintetica" },
  );
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "12");
  const body = await limited.json();
  assert.equal(JSON.stringify(body).includes("landing-public-event"), false);
  const broken = await handlePublicLandingEvent(
    {
      publications,
      metrics,
      consumeEventLimit: async () => {
        throw new Error("limiter down");
      },
    },
    post({ eventType: "FORM_START" }),
    { slug: "oficina-sintetica" },
  );
  assert.equal(broken.status, 204);
  const rows = await metrics.listForProject((await publications.findActiveBySlug("oficina-sintetica"))!.projectId);
  assert.equal(rows.some((row) => row.eventType === "FORM_SUBMIT"), false);
  assert.equal(JSON.stringify(rows).includes("203.0.113"), false);
});

test("limite do formulário responde 429 genérico", async () => {
  const { publications } = await publishedPage();
  const response = await handlePublicLandingForm(
    {
      publications,
      leads: createMemoryLandingPageLeadStore(),
      metrics: createMemoryLandingPageMetricStore(),
      consumeRateLimit: () => ({ allowed: false, retryAfterSeconds: 40 }),
    },
    post({ submissionId: "envio-limite", values: { name: "Ana", email: "ana@example.com" } }),
    { slug: "oficina-sintetica", sectionId: "formulario" },
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "40");
  const body = await response.json();
  assert.equal(body.message, PUBLIC_FORM_RATE_LIMIT_MESSAGE);
  assert.equal(JSON.stringify(body).includes("hashed"), false);
});

test("mídia órfã respeita simulação, publicação e falha de armazenamento", async () => {
  const old = media("solta", "READY", 48 * 60 * 60 * 1000);
  const published = media("publicada", "READY", 48 * 60 * 60 * 1000);
  const fresh = media("recente", "FAILED", 60 * 1000);
  const draft = createEmptyLandingPageDocument();
  draft.mediaRefs.push({ mediaId: "no-rascunho", usage: "HERO", altText: "Marca" });
  const referenced = media("no-rascunho", "READY", 48 * 60 * 60 * 1000);
  const dry = await cleanupLandingPageMediaOrphans({
    records: [old, published, fresh, referenced],
    drafts: [{ projectId: "projeto", document: draft }],
    publicationReferencesMedia: (_projectId, mediaId) => mediaId === "publicada",
  });
  assert.equal(dry.examined, 4);
  assert.equal(dry.eligible, 1);
  assert.equal(dry.deleted, 0);
  assert.equal(old.status, "READY");
  const removed = await cleanupLandingPageMediaOrphans({
    records: [old],
    drafts: [],
    publicationReferencesMedia: () => false,
    dryRun: false,
    storage: { delete: async () => undefined },
    save: async (record) => {
      record.status = "DELETED";
    },
  });
  assert.equal(removed.deleted, 1);
  const kept = media("falha", "READY", 48 * 60 * 60 * 1000);
  const failed = await cleanupLandingPageMediaOrphans({
    records: [kept],
    drafts: [],
    publicationReferencesMedia: () => false,
    dryRun: false,
    storage: {
      delete: async () => {
        throw new Error("blob");
      },
    },
    save: async () => undefined,
  });
  assert.equal(failed.failed, 1);
  assert.equal(failed.deleted, 0);
  assert.equal(kept.status, "READY");
});

test("JPEG e PNG perdem metadado e WebP com EXIF é recusado", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x58, 0x49, 0x46, 0x00, 0x00, 0xff, 0xd9]);
  const inspected = inspectLandingPageImage(jpeg, "image/jpeg");
  assert.ok(inspected);
  assert.equal(Buffer.from(inspected.bytes).includes(Buffer.from("EXIF")), false);
  const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x04, 0x74, 0x45, 0x58, 0x74, 0x61, 0x62, 0x63, 0x64, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0x00, 0x00, 0x00, 0x00,
  ]);
  const pngResult = inspectLandingPageImage(png, "image/png");
  assert.ok(pngResult);
  assert.equal(Buffer.from(pngResult.bytes).includes(Buffer.from("tEXt")), false);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x45, 0x58, 0x49, 0x46]);
  assert.equal(inspectLandingPageImage(webp, "image/webp"), null);
});

test("configuração de release não imprime segredo e produção sem segredo fica fechada", () => {
  const secret = "release-secret-value-that-must-stay-hidden";
  const missing = evaluateLandingPageProductionReadinessConfig({});
  assert.equal(missing.checks.find((item) => item.id === "RATE_LIMIT_SECRET")?.status, "BLOCKED");
  assert.equal(missing.checks.find((item) => item.id === "MEDIA_STORAGE_CONFIG")?.status, "BLOCKED");
  const closed = landingPagePublicRouteEnabled({ NODE_ENV: "production", LANDING_PAGE_PUBLIC_RUNTIME_ENABLED: "true" });
  assert.equal(closed, false);
  assert.equal(landingPagePublicRuntimeEnabled({}), false);
  assert.equal(LIVE_MEDIA_STORE_READY, true);
  const report = evaluateLandingPagePublicReleaseReadiness({
    env: {
      NODE_ENV: "production",
      LANDING_PAGE_PUBLIC_RUNTIME_ENABLED: "true",
      LANDING_PAGE_RATE_LIMIT_SECRET: secret,
      APIMG_UPLOAD_URL: "https://apimg.com.br/v1/upload",
      APIMG_API_KEY: "apimg-key-hidden",
      APIMG_UPLOAD_FOLDER: "alexandre-feio/uploads",
      APIMG_SITE_UPLOAD_FOLDER: "alexandre-feio/site",
    },
    liveMediaStoreReady: false,
  });
  assert.equal(report.status, "BLOCKED");
  assert.equal(JSON.stringify(report).includes(secret), false);
  assert.equal(JSON.stringify(report).includes("apimg-key-hidden"), false);
  assert.equal(report.checks.find((item) => item.id === "PRIVACY_POLICY")?.status, "PASS");
  assert.equal(report.checks.find((item) => item.id === "RETENTION_DECISIONS")?.status, "PASS");
  assert.equal(report.checks.find((item) => item.id === "RETENTION_MAINTENANCE_SCHEDULE")?.status, "BLOCKED");
  assert.equal(report.checks.find((item) => item.id === "RETENTION_MAINTENANCE_SCHEDULE")?.kind, "MANUAL_RELEASE_STEP");
  assert.equal(CAPTCHA_REQUIRED_AT_LAUNCH, "NOT_REQUIRED_FOR_MVP");
  assert.equal(LEAD_RETENTION_POLICY.months, 12);
  assert.equal(LEAD_RETENTION_POLICY.basis, "createdAt");
  assert.equal(LEAD_RETENTION_POLICY.action, "DELETE");
  assert.equal(METRICS_RETENTION_POLICY.months, 24);
  assert.equal(METRICS_RETENTION_POLICY.basis, "date");
  assert.equal(METRICS_RETENTION_POLICY.action, "DELETE");
  assert.equal(MEDIA_RETENTION_POLICY.referenced, "RETAIN_WHILE_REFERENCED_OR_HISTORICAL");
  assert.equal(MEDIA_RETENTION_POLICY.orphanGraceHours, 24);
  assert.equal(PRIVACY_POLICY_UPDATE_REQUIRED, false);
});

test("privacidade, cabeçalhos e conteúdo público continuam contidos", () => {
  const privacy = readFileSync("src/app/(public)/privacidade/page.tsx", "utf8");
  assert.match(privacy, /landing pages/);
  const headers = readFileSync("next.config.ts", "utf8");
  assert.match(headers, /X-Content-Type-Options/);
  assert.match(headers, /strict-origin-when-cross-origin/);
  assert.match(headers, /frame-ancestors 'none'/);
  const layout = readFileSync("src/app/p/layout.tsx", "utf8");
  const page = readFileSync("src/app/p/[slug]/page.tsx", "utf8");
  assert.equal(layout.includes("PlatformShell"), false);
  assert.equal(page.includes("GoogleTagManager"), false);
  assert.equal(page.includes("dangerouslySetInnerHTML"), false);
  const renderer = readFileSync("src/components/landing-page/LandingPageRenderer.tsx", "utf8");
  assert.equal(renderer.includes("dangerouslySetInnerHTML"), false);
  const document = consultoriaLandingFixture();
  const hero = document.sections.find((section) => section.type === "HERO");
  if (!hero || hero.type !== "HERO") throw new Error("hero");
  hero.content.headline = "<script>alert(1)</script>";
  const html = renderToStaticMarkup(createElement(LandingPageRenderer, { document, mode: "PUBLIC" }));
  assert.equal(html.includes("<script>alert"), false);
  assert.match(html, /&lt;script&gt;alert/);
  assert.equal(resolveLandingPageAction({ type: "EXTERNAL_URL", url: "javascript:alert(1)" }), null);
  assert.equal(resolveLandingPageAction({ type: "EXTERNAL_URL", url: "data:text/html,hi" }), null);
  assert.equal(isPublicInternalRouteAllowed("/admin"), false);
  assert.equal(isPublicInternalRouteAllowed("/dev"), false);
  assert.equal(isPublicInternalRouteAllowed("/api"), false);
  const log = publicationLogEvent({ projectId: "p", code: "RATE_LIMITED", operation: "public-form", email: "ana@example.com", stack: "Error: secret" });
  assert.equal("email" in log, false);
  assert.equal("stack" in log, false);
  assert.equal(log.operation, "public-form");
});

test("smoke sintético publica, mede, recebe um lead e despublica", async () => {
  const { projects, publications, page } = await publishedPage();
  const leads = createMemoryLandingPageLeadStore();
  const metrics = createMemoryLandingPageMetricStore();
  const active = await publications.findActiveBySlug(page.slug);
  assert.ok(active);
  const document = documentFromPublicationSnapshot(active.publication.snapshot);
  assert.ok(document);
  assert.equal(document.strategy, undefined);
  const deps = { publications, leads, metrics, consumeRateLimit: () => true, consumeEventLimit: async () => ({ allowed: true }) };
  assert.equal((await handlePublicLandingEvent(deps, post({ eventType: "PAGE_VIEW" }), { slug: page.slug })).status, 204);
  assert.equal((await handlePublicLandingEvent(deps, post({ eventType: "WHATSAPP_CLICK" }), { slug: page.slug })).status, 204);
  assert.equal((await handlePublicLandingEvent(deps, post({ eventType: "FORM_START" }), { slug: page.slug })).status, 204);
  const sent = await handlePublicLandingForm(
    deps,
    post({ submissionId: "envio-smoke-1", values: { name: "Ana", email: "ana@example.com" } }),
    { slug: page.slug, sectionId: "formulario" },
  );
  assert.equal(sent.status, 200);
  const again = await handlePublicLandingForm(
    deps,
    post({ submissionId: "envio-smoke-1", values: { name: "Ana", email: "ana@example.com" } }),
    { slug: page.slug, sectionId: "formulario" },
  );
  assert.equal(again.status, 200);
  assert.equal((await leads.listForProject(page.id)).length, 1);
  const counts = await metrics.listForProject(page.id);
  assert.equal(counts.find((row) => row.eventType === "FORM_SUBMIT")?.count, 1);
  assert.equal(counts.find((row) => row.eventType === "PAGE_VIEW")?.count, 1);
  const changed = structuredClone(page.draftDocument);
  const hero = changed.sections.find((section) => section.type === "HERO");
  if (!hero || hero.type !== "HERO") throw new Error("hero");
  hero.content.headline = "Móveis sob medida nesta semana";
  changed.experienceReview = review(page.draftRevision + 1);
  const edited = await updateLandingPageDraft(projects, {
    userId: "owner",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    document: changed,
  });
  if (!edited.ok) throw new Error(edited.code);
  const againPublished = await republishLandingPage(
    { projects, publications },
    { userId: "owner", landingPageProjectId: page.id, expectedDraftRevision: edited.value.draftRevision },
  );
  assert.equal(againPublished.ok, true);
  const hidden = await unpublishLandingPage({ projects, publications }, { userId: "owner", landingPageProjectId: page.id });
  assert.equal(hidden.ok, true);
  const gone = await handlePublicLandingEvent(deps, post({ eventType: "PAGE_VIEW" }), { slug: page.slug });
  assert.equal(gone.status, 404);
  const tracker = createPublicLifecycleTracker();
  assert.equal(tracker.once("pagina:PAGE_VIEW"), true);
  assert.equal(tracker.once("pagina:PAGE_VIEW"), false);
  assert.equal(tracker.once("pagina:FORM_START"), true);
  assert.equal(tracker.once("pagina:FORM_START"), false);
});

test("contadores concorrentes não se perdem", async () => {
  const metrics = createMemoryLandingPageMetricStore();
  await Promise.all(
    Array.from({ length: 25 }, () =>
      metrics.increment({
        landingPageProjectId: "projeto",
        publicationId: "publicacao",
        date: "2026-10-22",
        eventType: "PAGE_VIEW",
      }),
    ),
  );
  const rows = await metrics.listForProject("projeto");
  assert.equal(rows[0]?.count, 25);
});
