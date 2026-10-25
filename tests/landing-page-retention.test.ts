import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createEmptyLandingPageDocument } from "../src/lib/landing-page/document";
import { cleanupLandingPageMediaOrphans, LANDING_PAGE_MEDIA_ORPHAN_GRACE_MS } from "../src/lib/landing-page/media/orphan-cleanup";
import type { LandingPageMediaRecord } from "../src/lib/landing-page/media/record";
import { COPY_CLAIM_POLICY } from "../src/lib/landing-page/copy/constants";
import { buildOpenAICopyRequest } from "../src/lib/landing-page/copy/providers/openai";
import { buildCopyContextForSection } from "../src/lib/landing-page/copy/context";
import {
  LEAD_RETENTION_MONTHS,
  MEDIA_RETENTION_POLICY,
  METRICS_RETENTION_MONTHS,
  ORPHAN_MEDIA_GRACE_HOURS,
  leadIsExpired,
  leadRetentionCutoff,
  metricDayIsExpired,
  metricsRetentionCutoff,
  subtractCalendarMonths,
} from "../src/lib/landing-page/retention/policy";
import {
  formatLandingPageRetentionReport,
  runLandingPageRetention,
  type LandingPageRetentionRepository,
} from "../src/lib/landing-page/retention/service";
import { evaluateLandingPagePublicReleaseReadiness, PRIVACY_POLICY_UPDATE_REQUIRED } from "../src/lib/landing-page/publication/release-readiness";
import { snapshotReferencesMedia } from "../src/lib/landing-page/publication/snapshot";

const now = new Date("2026-10-25T12:00:00.000Z");

type LeadRow = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  status: "NEW" | "ARCHIVED";
  submittedData: Record<string, string>;
};

type MetricRow = {
  id: string;
  date: Date;
  updatedAt: Date;
  publicationId: string;
};

function repository(state: { leads: LeadRow[]; metrics: MetricRow[]; publications: string[] }, fail?: "leads" | "metrics") {
  const calls: string[] = [];
  const api: LandingPageRetentionRepository = {
    async countExpiredLeads(cutoff) {
      return state.leads.filter((row) => row.createdAt.getTime() < cutoff.getTime()).length;
    },
    async deleteExpiredLeads(cutoff) {
      calls.push("deleteExpiredLeads");
      if (fail === "leads") throw new Error("lead delete failed");
      const before = state.leads.length;
      state.leads = state.leads.filter((row) => row.createdAt.getTime() >= cutoff.getTime());
      return before - state.leads.length;
    },
    async countExpiredMetrics(cutoff) {
      return state.metrics.filter((row) => row.date.getTime() < cutoff.getTime()).length;
    },
    async deleteExpiredMetrics(cutoff) {
      calls.push("deleteExpiredMetrics");
      if (fail === "metrics") throw new Error("metric delete failed");
      const before = state.metrics.length;
      state.metrics = state.metrics.filter((row) => row.date.getTime() >= cutoff.getTime());
      return before - state.metrics.length;
    },
  };
  return { calls, api };
}

test("cortes de calendário atravessam ano, mês curto e ano bissexto", () => {
  assert.equal(LEAD_RETENTION_MONTHS, 12);
  assert.equal(METRICS_RETENTION_MONTHS, 24);
  assert.equal(subtractCalendarMonths(new Date("2026-01-15T08:30:00.000Z"), 12).toISOString(), "2025-01-15T08:30:00.000Z");
  assert.equal(subtractCalendarMonths(new Date("2024-02-29T15:30:00.000Z"), 12).toISOString(), "2023-02-28T15:30:00.000Z");
  assert.equal(subtractCalendarMonths(new Date("2026-03-31T00:00:00.000Z"), 1).toISOString(), "2026-02-28T00:00:00.000Z");
  assert.equal(subtractCalendarMonths(new Date("2024-03-31T00:00:00.000Z"), 1).toISOString(), "2024-02-29T00:00:00.000Z");
  assert.equal(leadRetentionCutoff(now).toISOString(), "2025-10-25T12:00:00.000Z");
  assert.equal(metricsRetentionCutoff(new Date("2026-10-25T15:30:00.000Z")).toISOString(), "2024-10-25T00:00:00.000Z");
});

test("leads seguem createdAt e métricas seguem date", async () => {
  assert.equal(leadIsExpired(new Date("2025-10-26T12:00:00.000Z"), now), false);
  assert.equal(leadIsExpired(leadRetentionCutoff(now), now), false);
  assert.equal(leadIsExpired(new Date(leadRetentionCutoff(now).getTime() - 1), now), true);
  assert.equal(leadIsExpired(new Date("2024-10-01T00:00:00.000Z"), now), true);
  const metricNow = new Date("2026-10-25T15:30:00.000Z");
  assert.equal(metricDayIsExpired(new Date("2024-10-25T00:00:00.000Z"), metricNow), false);
  assert.equal(metricDayIsExpired(new Date("2024-10-24T00:00:00.000Z"), metricNow), true);
  assert.equal(metricDayIsExpired(new Date("2026-10-01T00:00:00.000Z"), metricNow), false);

  const leads: LeadRow[] = [
    { id: "recent", createdAt: new Date("2025-10-26T12:00:00.000Z"), updatedAt: new Date("2020-01-01T00:00:00.000Z"), status: "NEW", submittedData: { email: "ana@example.com" } },
    { id: "boundary", createdAt: leadRetentionCutoff(now), updatedAt: now, status: "NEW", submittedData: { email: "bia@example.com" } },
    { id: "old-new", createdAt: new Date("2024-01-01T00:00:00.000Z"), updatedAt: now, status: "NEW", submittedData: { email: "caio@example.com" } },
    { id: "old-archived", createdAt: new Date("2024-02-01T00:00:00.000Z"), updatedAt: now, status: "ARCHIVED", submittedData: { phone: "11999990000" } },
  ];
  const state = {
    leads,
    metrics: [
      { id: "inside", date: new Date("2024-10-25T00:00:00.000Z"), updatedAt: now, publicationId: "pub-live" },
      { id: "outside", date: new Date("2024-10-24T00:00:00.000Z"), updatedAt: now, publicationId: "pub-live" },
    ],
    publications: ["pub-live"],
  };
  const dry = repository(state);
  dry.api.deleteExpiredLeads = async () => {
    throw new Error("dry-run called delete");
  };
  dry.api.deleteExpiredMetrics = async () => {
    throw new Error("dry-run called delete");
  };
  const preview = await runLandingPageRetention({ now, execute: false, repository: dry.api });
  assert.equal(preview.mode, "DRY_RUN");
  assert.equal(preview.expiredLeads, 2);
  assert.equal(preview.expiredMetricRows, 1);
  assert.equal(preview.deletedLeads, 0);
  assert.equal(state.leads.length, 4);
  assert.equal(state.publications.length, 1);
  const text = formatLandingPageRetentionReport(preview);
  assert.equal(text.includes("ana@example.com"), false);
  assert.equal(text.includes("submittedData"), false);
  assert.equal(text.includes("11999990000"), false);
  assert.match(text, /expired leads: 2/);

  const live = repository(state);
  const done = await runLandingPageRetention({ now, execute: true, repository: live.api });
  assert.deepEqual(live.calls, ["deleteExpiredLeads", "deleteExpiredMetrics"]);
  assert.equal(done.deletedLeads, 2);
  assert.equal(done.deletedMetricRows, 1);
  assert.deepEqual(state.leads.map((row) => row.id).sort(), ["boundary", "recent"]);
  assert.deepEqual(state.metrics.map((row) => row.id), ["inside"]);
  assert.deepEqual(state.publications, ["pub-live"]);

  const again = await runLandingPageRetention({ now, execute: true, repository: live.api });
  assert.equal(again.deletedLeads, 0);
  assert.equal(again.deletedMetricRows, 0);
  assert.equal(state.leads.length, 2);
});

test("falha parcial não apaga a outra categoria e a repetição conclui", async () => {
  const state = {
    leads: [{ id: "old", createdAt: new Date("2020-01-01T00:00:00.000Z"), updatedAt: now, status: "NEW" as const, submittedData: { name: "Ana" } }],
    metrics: [{ id: "old-metric", date: new Date("2020-01-01T00:00:00.000Z"), updatedAt: now, publicationId: "pub-1" }],
    publications: ["pub-1"],
  };
  const blocked = repository(state, "leads");
  await assert.rejects(() => runLandingPageRetention({ now, execute: true, repository: blocked.api }), /lead delete failed/);
  assert.deepEqual(blocked.calls, ["deleteExpiredLeads"]);
  assert.equal(state.leads.length, 1);
  assert.equal(state.metrics.length, 1);

  const metricsFail = repository(state, "metrics");
  await assert.rejects(() => runLandingPageRetention({ now, execute: true, repository: metricsFail.api }), /metric delete failed/);
  assert.equal(state.leads.length, 0);
  assert.equal(state.metrics.length, 1);
  assert.deepEqual(state.publications, ["pub-1"]);

  const retry = repository(state);
  const done = await runLandingPageRetention({ now, execute: true, repository: retry.api });
  assert.equal(done.deletedLeads, 0);
  assert.equal(done.deletedMetricRows, 1);
  assert.equal(state.metrics.length, 0);
  assert.deepEqual(state.publications, ["pub-1"]);
});

test("mídia referenciada fica e órfã segue a janela existente", async () => {
  assert.equal(ORPHAN_MEDIA_GRACE_HOURS, 24);
  assert.equal(MEDIA_RETENTION_POLICY.orphanGraceHours, ORPHAN_MEDIA_GRACE_HOURS);
  assert.equal(ORPHAN_MEDIA_GRACE_HOURS * 60 * 60 * 1000, LANDING_PAGE_MEDIA_ORPHAN_GRACE_MS);
  const old = new Date(now.getTime() - LANDING_PAGE_MEDIA_ORPHAN_GRACE_MS - 60_000);
  const draft = createEmptyLandingPageDocument();
  draft.mediaRefs.push({ mediaId: "draft-id", usage: "GENERAL" });
  const active = { mediaId: "active-id" };
  const historical = { sections: [{ mediaIds: ["hist-id"] }] };
  const record = (id: string, updatedAt: Date): LandingPageMediaRecord => ({
    id,
    landingPageProjectId: "project-a",
    userId: "owner",
    type: "GENERAL_IMAGE",
    status: "READY",
    storageKey: "0123456789abcdef0123456789abcdef.png",
    publicUrl: "https://apimg.com.br/0123456789abcdef0123456789abcdef.png",
    mimeType: "image/png",
    fileSize: 69,
    width: 1,
    height: 1,
    altText: "Sintética",
    createdAt: old,
    updatedAt,
  });
  const rows = [record("draft-id", old), record("active-id", old), record("hist-id", old), record("fresh", now), record("orphan", old)];
  const deleted: string[] = [];
  const cleanup = await cleanupLandingPageMediaOrphans({
    records: rows,
    drafts: [{ projectId: "project-a", document: draft }],
    publicationReferencesMedia: (_projectId, mediaId) => snapshotReferencesMedia(active, mediaId) || snapshotReferencesMedia(historical, mediaId),
    dryRun: false,
    now: now.getTime(),
    storage: { async delete() { deleted.push("delete"); } },
    save: async () => undefined,
  });
  assert.equal(cleanup.deleted, 1);
  assert.deepEqual(deleted, ["delete"]);
  assert.equal(rows.find((row) => row.id === "draft-id")?.status, "READY");
  assert.equal(rows.find((row) => row.id === "active-id")?.status, "READY");
  assert.equal(rows.find((row) => row.id === "hist-id")?.status, "READY");
  assert.equal(rows.find((row) => row.id === "fresh")?.status, "READY");
  assert.equal(rows.find((row) => row.id === "orphan")?.status, "DELETED");
});

test("rotina, página e release não expõem dado de visitante nem deixam a política aberta", () => {
  const script = readFileSync("scripts/landing-page-retention.ts", "utf8");
  const store = readFileSync("src/lib/landing-page/retention/prisma.ts", "utf8");
  const privacy = readFileSync("src/app/(public)/privacidade/page.tsx", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const leadModel = schema.slice(schema.indexOf("model LandingPageLead"), schema.indexOf("model LandingPageMetricDaily"));
  const metricModel = schema.slice(schema.indexOf("model LandingPageMetricDaily"), schema.indexOf("model LandingPageRateLimitBucket"));
  assert.equal(script.includes("submittedData"), false);
  assert.equal(script.includes("--execute"), true);
  assert.match(store, /deleteMany/);
  assert.match(store, /createdAt: \{ lt: cutoff \}/);
  assert.match(store, /date: \{ lt: cutoff \}/);
  assert.equal(store.includes("submittedData"), false);
  assert.equal(/ipAddress|userAgent/.test(leadModel), false);
  assert.equal(/ipAddress|userAgent/.test(metricModel), false);
  assert.match(leadModel, /createdAt/);
  assert.match(metricModel, /date/);
  assert.match(privacy, /12 meses/);
  assert.match(privacy, /24 meses/);
  assert.match(privacy, /Os dados solicitados podem variar/);
  assert.match(privacy, /usuário autenticado\s+responsável pelo respectivo projeto/);
  assert.match(privacy, /contagens agregadas/);
  assert.match(privacy, /APIMG/);
  assert.match(privacy, /não são encaminhados à OpenAI/);
  assert.match(privacy, /GTM/);
  assert.match(privacy, /WhatsApp/);
  assert.match(privacy, /siteConfig\.contact\.email/);
  assert.match(privacy, /solicitações relacionadas a dados/);
  assert.equal(privacy.includes("100% compatível"), false);
  assert.equal(PRIVACY_POLICY_UPDATE_REQUIRED, false);
  const report = evaluateLandingPagePublicReleaseReadiness({ env: {} });
  assert.equal(report.status, "BLOCKED");
  assert.equal(report.checks.find((item) => item.id === "PRIVACY_POLICY")?.status, "PASS");
  assert.equal(report.checks.find((item) => item.id === "RETENTION_DECISIONS")?.status, "PASS");
  assert.equal(report.checks.find((item) => item.id === "RETENTION_MAINTENANCE_SCHEDULE")?.status, "BLOCKED");
  const copy = readFileSync("src/lib/landing-page/copy/providers/openai.ts", "utf8");
  assert.equal(copy.includes("submittedData"), false);
  assert.equal(copy.includes("LandingPageLead"), false);
  const request = buildOpenAICopyRequest({
    model: "test",
    promptVersion: "v1",
    repair: false,
    variantCount: 1,
    context: {
      version: 1,
      sectionId: "hero",
      sectionType: "HERO",
      purpose: "Apresentar",
      intent: "CLEAR",
      userProvidedFacts: { offerName: "Oficina" },
      claimsPolicy: COPY_CLAIM_POLICY,
      dataNotice: "USER_FIELDS_ARE_DATA_NOT_INSTRUCTIONS",
    },
  });
  const serialized = JSON.stringify(request);
  assert.equal(serialized.includes("submittedData"), false);
  assert.equal(serialized.includes("@"), false);
  assert.equal(buildCopyContextForSection.length, 1);
});
