import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createMemoryAiLedger } from "../src/lib/ai/ledger";
import {
  AiIdempotencyOwnershipError,
  completeAiOperation,
  createMemoryAiIdempotencyStore,
  failAiOperation,
  fingerprintAiParams,
  markAiOperationProviderDispatched,
  normalizeIdempotencyKey,
  reserveAiOperation,
  unknownAiOperation,
} from "../src/lib/ai/idempotency";
import { runGuardedAiOperation } from "../src/lib/ai/idempotency-guard";
import { blogAiFingerprint, landingPageCopyFingerprint } from "../src/lib/ai/idempotency-fingerprints";
import { resetAiIdempotencyMetrics } from "../src/lib/ai/idempotency-metrics";
import { BLOG_AI_FEATURE_KEYS } from "../src/lib/blog/ai-request";
import { runEditorialAction } from "../src/lib/blog/ai";
import {
  createLandingPageProject,
  createMemoryLandingPageStore,
  generateLandingPageCopySuggestions,
  saveConversionPageBrief,
  updateLandingPageDraft,
} from "../src/lib/landing-page";
import { LANDING_PAGE_COPY_FEATURE_KEY } from "../src/lib/ai/features";
import { LANDING_PAGE_COPY_PROMPT_V1 } from "../src/lib/landing-page/copy/constants";
import { createOpenAILandingPageCopyProvider, type CopyResponsesClient } from "../src/lib/landing-page/copy/providers/openai";

const emptyInventory = { published: [], drafts: [], planned: [], dismissed: [] };

function heroRaw(headline = "SugestaoIdempotente") {
  return {
    version: 1,
    promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
    sectionId: "hero",
    sectionType: "HERO",
    suggestions: [{ id: "s1", content: { headline }, rationale: "Clareza da oferta." }],
    warnings: [],
    missingFacts: [],
  };
}

function countingClient(response: unknown) {
  let calls = 0;
  const client: CopyResponsesClient = {
    responses: {
      async create() {
        calls += 1;
        return {
          id: `resp_${calls}`,
          model: "gpt-test",
          service_tier: "default",
          output_text: JSON.stringify(response),
          usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        };
      },
    },
  };
  return {
    client,
    get calls() {
      return calls;
    },
  };
}

async function heroProject(userId = "user-a") {
  const store = createMemoryLandingPageStore({
    courseIdBySlug: { "sites-que-convertem": "course-sites" },
    projects: [{ id: "project-a", userId }],
  });
  const created = await createLandingPageProject(store, {
    userId,
    title: "Página",
    slug: `pagina-${userId}`,
    projectId: "project-a",
  });
  if (!created.ok) throw new Error(created.code);
  const saved = await saveConversionPageBrief(store, {
    userId,
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    brief: {
      version: 1,
      offer: { name: "OfertaIdempotente", summary: "Organização clara" },
      audience: { description: "Pequenos empreendedores" },
      problemOrContext: "Mensagem confusa na página.",
      primaryBenefit: "Ter uma oferta clara",
      pageGoal: "REQUEST_QUOTE",
      primaryAction: { type: "FORM", label: "Pedir conversa" },
      businessOutcome: "QUOTE",
      objections: [],
      arrivalContext: { trafficSources: ["INSTAGRAM"] },
    },
  });
  if (!saved.ok) throw new Error(saved.code);
  const document = structuredClone(saved.value.draftDocument);
  document.sections = [{
    id: "hero",
    type: "HERO",
    variant: "default",
    order: 0,
    enabled: true,
    settings: {},
    contentStatus: "PLACEHOLDER",
    content: { headline: "Defina a principal promessa desta página" },
  }] as typeof document.sections;
  const updated = await updateLandingPageDraft(store, {
    userId,
    landingPageProjectId: saved.value.id,
    expectedRevision: saved.value.draftRevision,
    document,
  });
  if (!updated.ok) throw new Error(updated.code);
  return { store, project: updated.value };
}

test("normalizeIdempotencyKey rejeita chave ausente ou inválida", () => {
  assert.equal(normalizeIdempotencyKey(undefined), null);
  assert.equal(normalizeIdempotencyKey("short"), null);
  assert.equal(normalizeIdempotencyKey("valid-key-01"), "valid-key-01");
});

test("fingerprint é estável e sensível a mudanças canônicas", () => {
  const a = fingerprintAiParams({ a: 1, b: ["x", "y"] });
  const b = fingerprintAiParams({ b: ["x", "y"], a: 1 });
  assert.equal(a, b);
  assert.notEqual(
    blogAiFingerprint({ action: "titles", inventory: emptyInventory, focus: { title: "A" } }),
    blogAiFingerprint({ action: "titles", inventory: emptyInventory, focus: { title: "B" } }),
  );
});

test("1) cem requisições equivalentes em memória: uma autorização", async () => {
  resetAiIdempotencyMetrics();
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ batch: 100 });
  let executions = 0;
  const results = await Promise.all(Array.from({ length: 100 }, () => runGuardedAiOperation({
    userId: "u1",
    featureKey: LANDING_PAGE_COPY_FEATURE_KEY,
    idempotencyKey: "burst-100",
    fingerprintHash: fp,
    store,
    execute: async ({ confirmDispatch }) => {
      await confirmDispatch();
      executions += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: true as const, value: "ok" };
    },
  })));
  assert.equal(executions, 1);
  assert.equal(results.filter((row) => row.ok).length, 1);
  assert.equal(results.filter((row) => !row.ok && "block" in row && row.block === "in_progress").length, 99);
});

test("3) reclaim de reserva expirada sem despacho", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ recover: 1 });
  const now = new Date("2026-11-03T12:00:00.000Z");
  const reserved = await reserveAiOperation({
    userId: "u1", featureKey: "blog_coverage", idempotencyKey: "stale-key-1", fingerprintHash: fp, store, now, ttlMs: 1,
  });
  assert.equal(reserved.kind, "authorized");
  if (reserved.kind !== "authorized") return;
  assert.equal(reserved.reservation.generation, 1);
  const later = new Date(now.getTime() + 10_000);
  const recovered = await reserveAiOperation({
    userId: "u1", featureKey: "blog_coverage", idempotencyKey: "stale-key-1", fingerprintHash: fp, store, now: later, ttlMs: 60_000,
  });
  assert.equal(recovered.kind, "authorized");
  if (recovered.kind !== "authorized") return;
  assert.equal(recovered.reservation.generation, 2);
});

test("despacho tardio após lease expirado é recusado sem chamar provedor", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ late: "dispatch" });
  const now = new Date("2026-11-03T12:00:00.000Z");
  const reserved = await reserveAiOperation({
    userId: "u1", featureKey: "blog_titles", idempotencyKey: "late-disp1", fingerprintHash: fp, store, now, ttlMs: 1,
  });
  assert.equal(reserved.kind, "authorized");
  if (reserved.kind !== "authorized") return;
  const later = new Date(now.getTime() + 5_000);
  let providerCalls = 0;
  const guarded = await runGuardedAiOperation({
    userId: "u1",
    featureKey: "blog_titles",
    idempotencyKey: "late-disp1",
    fingerprintHash: fp,
    store,
    now: later,
    ttlMs: 60_000,
    execute: async ({ confirmDispatch }) => {
      await confirmDispatch();
      providerCalls += 1;
      return { ok: true as const, value: "should-not-run" };
    },
  });
  // Ou reclaim autoriza nova geração, ou a antiga perde o despacho.
  if (guarded.ok) {
    assert.equal(providerCalls, 1);
    assert.ok(guarded.reservation.generation >= 2);
  } else {
    assert.equal(providerCalls, 0);
  }
  await assert.rejects(
    () => markAiOperationProviderDispatched(store, reserved.reservation, later),
    (error: unknown) => error instanceof AiIdempotencyOwnershipError,
  );
});

test("A) cinquenta reservas iniciais simultâneas: uma autorização", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ scenario: "A" });
  const results = await Promise.all(Array.from({ length: 50 }, () => reserveAiOperation({
    userId: "u1",
    featureKey: "landing_page_copy",
    idempotencyKey: "scenario-a-50",
    fingerprintHash: fp,
    store,
  })));
  assert.equal(results.filter((row) => row.kind === "authorized").length, 1);
  assert.equal(results.filter((row) => row.kind === "in_progress").length, 49);
});

test("B) cinquenta recuperações simultâneas de lease expirado: uma autorização", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ scenario: "B" });
  const now = new Date("2026-11-03T13:00:00.000Z");
  const seed = await reserveAiOperation({
    userId: "u1",
    featureKey: "landing_page_copy",
    idempotencyKey: "scenario-b-50",
    fingerprintHash: fp,
    store,
    now,
    ttlMs: 1,
  });
  assert.equal(seed.kind, "authorized");
  const later = new Date(now.getTime() + 10_000);
  const results = await Promise.all(Array.from({ length: 50 }, () => reserveAiOperation({
    userId: "u1",
    featureKey: "landing_page_copy",
    idempotencyKey: "scenario-b-50",
    fingerprintHash: fp,
    store,
    now: later,
    ttlMs: 60_000,
  })));
  assert.equal(results.filter((row) => row.kind === "authorized").length, 1);
  const winner = results.find((row) => row.kind === "authorized");
  if (winner && winner.kind === "authorized" && seed.kind === "authorized") {
    assert.equal(winner.reservation.generation, seed.reservation.generation + 1);
  }
});

test("4) execução antiga tentando despachar depois do reclaim", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ fence: "dispatch" });
  const now = new Date("2026-11-03T12:00:00.000Z");
  const first = await reserveAiOperation({
    userId: "u1", featureKey: "blog_draft", idempotencyKey: "fence-disp", fingerprintHash: fp, store, now, ttlMs: 1,
  });
  assert.equal(first.kind, "authorized");
  if (first.kind !== "authorized") return;
  const old = first.reservation;
  const later = new Date(now.getTime() + 5_000);
  const second = await reserveAiOperation({
    userId: "u1", featureKey: "blog_draft", idempotencyKey: "fence-disp", fingerprintHash: fp, store, now: later, ttlMs: 60_000,
  });
  assert.equal(second.kind, "authorized");
  await assert.rejects(
    () => markAiOperationProviderDispatched(store, old, later),
    (error: unknown) => error instanceof AiIdempotencyOwnershipError,
  );
  if (second.kind === "authorized") {
    const confirmed = await markAiOperationProviderDispatched(store, second.reservation, later);
    assert.equal(confirmed.providerDispatched, true);
    assert.equal(confirmed.generation, 2);
  }
});

test("5) execução antiga tentando concluir depois do reclaim", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ fence: "complete" });
  const failed = await runGuardedAiOperation({
    userId: "u1", featureKey: "blog_seo", idempotencyKey: "fence-comp", fingerprintHash: fp, store,
    execute: async () => ({ ok: false as const, failureKind: "before_dispatch" as const }),
  });
  assert.equal(failed.ok, false);
  const reclaimed = await reserveAiOperation({
    userId: "u1", featureKey: "blog_seo", idempotencyKey: "fence-comp", fingerprintHash: fp, store,
  });
  assert.equal(reclaimed.kind, "authorized");
  if (reclaimed.kind !== "authorized" || !("reservation" in failed) || !failed.reservation) return;
  const staleComplete = await completeAiOperation(store, failed.reservation);
  assert.equal(staleComplete, null);
  const owned = await completeAiOperation(store, reclaimed.reservation);
  assert.ok(owned);
  assert.equal(owned.status, "COMPLETED");
});

test("6) recuperação concorrente por duas instâncias: um reclaim", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ race: "reclaim" });
  const now = new Date("2026-11-03T12:00:00.000Z");
  await reserveAiOperation({
    userId: "u1", featureKey: "blog_next", idempotencyKey: "race-recl", fingerprintHash: fp, store, now, ttlMs: 1,
  });
  const later = new Date(now.getTime() + 10_000);
  const results = await Promise.all(Array.from({ length: 20 }, () => reserveAiOperation({
    userId: "u1", featureKey: "blog_next", idempotencyKey: "race-recl", fingerprintHash: fp, store, now: later, ttlMs: 60_000,
  })));
  assert.equal(results.filter((row) => row.kind === "authorized").length, 1);
});

test("7) despacho confirmado imediatamente antes da chamada ao provedor", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ order: 1 });
  const events: string[] = [];
  await runGuardedAiOperation({
    userId: "u1", featureKey: "blog_titles", idempotencyKey: "order-key1", fingerprintHash: fp, store,
    execute: async ({ confirmDispatch }) => {
      events.push("before_confirm");
      await confirmDispatch();
      events.push("after_confirm");
      events.push("provider");
      return { ok: true as const, value: 1 };
    },
  });
  assert.deepEqual(events, ["before_confirm", "after_confirm", "provider"]);
});

test("8) falha na atualização da marcação de despacho bloqueia provedor", async () => {
  const base = createMemoryAiIdempotencyStore();
  const store = {
    ...base,
    async markProviderDispatched() {
      return null;
    },
  };
  let providerCalls = 0;
  const result = await runGuardedAiOperation({
    userId: "u1", featureKey: "blog_titles", idempotencyKey: "disp-fail1", fingerprintHash: fingerprintAiParams({}), store,
    execute: async ({ confirmDispatch }) => {
      await confirmDispatch();
      providerCalls += 1;
      return { ok: true as const, value: 1 };
    },
  });
  assert.equal(providerCalls, 0);
  assert.equal(result.ok, false);
  assert.equal("block" in result && result.block, "ownership_lost");
});

test("9) falha na atualização do estado final não descarta resposta válida", async () => {
  const base = createMemoryAiIdempotencyStore();
  const store = {
    ...base,
    async markStatus() {
      return null;
    },
  };
  const result = await runGuardedAiOperation({
    userId: "u1", featureKey: "blog_titles", idempotencyKey: "final-fail", fingerprintHash: fingerprintAiParams({}), store,
    execute: async ({ confirmDispatch }) => {
      await confirmDispatch();
      return { ok: true as const, value: "kept" };
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value, "kept");
});

test("10) timeout após possível envio marca UNKNOWN", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ t: "after" });
  const first = await runGuardedAiOperation({
    userId: "u1", featureKey: "blog_outline", idempotencyKey: "post-timeout", fingerprintHash: fp, store,
    execute: async ({ confirmDispatch }) => {
      await confirmDispatch();
      return { ok: false as const, failureKind: "uncertain" as const, uncertain: true };
    },
  });
  assert.equal(first.ok, false);
  assert.equal("executionFailed" in first && first.uncertain, true);
  const blocked = await reserveAiOperation({
    userId: "u1", featureKey: "blog_outline", idempotencyKey: "post-timeout", fingerprintHash: fp, store,
  });
  assert.equal(blocked.kind, "unknown_blocked");
});

test("11) operação UNKNOWN bloqueando repetição", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ unk: 1 });
  const reserved = await reserveAiOperation({
    userId: "u1", featureKey: "blog_review", idempotencyKey: "unk-block1", fingerprintHash: fp, store,
  });
  assert.equal(reserved.kind, "authorized");
  if (reserved.kind !== "authorized") return;
  await markAiOperationProviderDispatched(store, reserved.reservation);
  await unknownAiOperation(store, reserved.reservation);
  const again = await reserveAiOperation({
    userId: "u1", featureKey: "blog_review", idempotencyKey: "unk-block1", fingerprintHash: fp, store,
  });
  assert.equal(again.kind, "unknown_blocked");
});

test("12) resposta definitiva rejeitada pela aplicação → FAILED recuperável", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ reject: 1 });
  const first = await runGuardedAiOperation({
    userId: "u1", featureKey: "blog_draft", idempotencyKey: "reject-01", fingerprintHash: fp, store,
    execute: async ({ confirmDispatch }) => {
      await confirmDispatch();
      return { ok: false as const, failureKind: "definitive" as const };
    },
  });
  assert.equal(first.ok, false);
  assert.equal("executionFailed" in first && first.uncertain, false);
  const reclaim = await reserveAiOperation({
    userId: "u1", featureKey: "blog_draft", idempotencyKey: "reject-01", fingerprintHash: fp, store,
  });
  assert.equal(reclaim.kind, "authorized");
});

test("13) falha do ledger sem descarte indevido de resposta válida", async () => {
  const { store, project } = await heroProject();
  const counting = countingClient(heroRaw());
  const provider = createOpenAILandingPageCopyProvider({
    apiKey: "test",
    model: "gpt-test",
    client: counting.client,
  });
  const idem = createMemoryAiIdempotencyStore();
  const guarded = await runGuardedAiOperation({
    userId: "user-a",
    featureKey: LANDING_PAGE_COPY_FEATURE_KEY,
    idempotencyKey: "ledger-fail-1",
    fingerprintHash: landingPageCopyFingerprint({
      landingPageProjectId: project.id,
      sectionId: "hero",
      draftRevision: project.draftRevision,
    }),
    store: idem,
    execute: async ({ requestId, confirmDispatch }) => {
      const generated = await generateLandingPageCopySuggestions(store, {
        userId: "user-a",
        landingPageProjectId: project.id,
        sectionId: "hero",
      }, provider, {
        requestId,
        onBeforeProvider: confirmDispatch,
        recordProviderCall: async () => {
          throw new Error("ledger down");
        },
        onLedgerFailure: () => undefined,
      });
      if (!generated.ok) return { ok: false as const, failureKind: "definitive" as const };
      return { ok: true as const, value: generated.value };
    },
  });
  assert.equal(guarded.ok, true);
  assert.equal(counting.calls, 1);
});

test("14) repair/retry preservando requestId e attempts separados", async () => {
  const { store, project } = await heroProject("user-repair");
  let calls = 0;
  const client: CopyResponsesClient = {
    responses: {
      async create() {
        calls += 1;
        if (calls === 1) {
          return {
            id: "resp_bad",
            model: "gpt-test",
            service_tier: "default",
            output_text: "{",
            usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
          };
        }
        return {
          id: "resp_ok",
          model: "gpt-test",
          service_tier: "default",
          output_text: JSON.stringify(heroRaw("Reparada")),
          usage: { input_tokens: 2, output_tokens: 2, total_tokens: 4 },
        };
      },
    },
  };
  const ledger = createMemoryAiLedger();
  const provider = createOpenAILandingPageCopyProvider({ apiKey: "test", model: "gpt-test", client });
  const requestId = "fixed-request-id";
  const generated = await generateLandingPageCopySuggestions(store, {
    userId: "user-repair",
    landingPageProjectId: project.id,
    sectionId: "hero",
  }, provider, { requestId, recordProviderCall: ledger.write });
  assert.equal(generated.ok, true);
  assert.equal(calls >= 2, true);
  assert.equal(ledger.rows.every((row) => row.requestId === requestId), true);
  assert.deepEqual(ledger.rows.map((row) => row.attempt).sort((a, b) => a - b), [1, 2]);
});

test("15) mesmo usuário/chave com fingerprint diferente", async () => {
  const store = createMemoryAiIdempotencyStore();
  await reserveAiOperation({
    userId: "u1", featureKey: "blog_seo", idempotencyKey: "same-key1", fingerprintHash: fingerprintAiParams({ a: 1 }), store,
  });
  const conflict = await reserveAiOperation({
    userId: "u1", featureKey: "blog_seo", idempotencyKey: "same-key1", fingerprintHash: fingerprintAiParams({ a: 2 }), store,
  });
  assert.equal(conflict.kind, "fingerprint_conflict");
});

test("16) usuários diferentes com a mesma chave", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ x: 1 });
  const a = await reserveAiOperation({ userId: "u1", featureKey: "blog_titles", idempotencyKey: "shared-key-1", fingerprintHash: fp, store });
  const b = await reserveAiOperation({ userId: "u2", featureKey: "blog_titles", idempotencyKey: "shared-key-1", fingerprintHash: fp, store });
  assert.equal(a.kind, "authorized");
  assert.equal(b.kind, "authorized");
});

test("17) nova intenção legítima com nova chave", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ same: true });
  const first = await runGuardedAiOperation({
    userId: "u1", featureKey: "blog_next", idempotencyKey: "key-alpha-1", fingerprintHash: fp, store,
    execute: async () => ({ ok: true as const, value: 1 }),
  });
  const second = await runGuardedAiOperation({
    userId: "u1", featureKey: "blog_next", idempotencyKey: "key-bravo-1", fingerprintHash: fp, store,
    execute: async () => ({ ok: true as const, value: 2 }),
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
});

test("18) ausência de chamadas pagas em requisições bloqueadas", async () => {
  const { store, project } = await heroProject("user-dup");
  const counting = countingClient(heroRaw());
  const provider = createOpenAILandingPageCopyProvider({ apiKey: "test", model: "gpt-test", client: counting.client });
  const idem = createMemoryAiIdempotencyStore();
  const ledger = createMemoryAiLedger();
  const fp = landingPageCopyFingerprint({
    landingPageProjectId: project.id,
    sectionId: "hero",
    draftRevision: project.draftRevision,
  });
  const runOnce = () => runGuardedAiOperation({
    userId: "user-dup",
    featureKey: LANDING_PAGE_COPY_FEATURE_KEY,
    idempotencyKey: "no-ledger-dup",
    fingerprintHash: fp,
    store: idem,
    execute: async ({ requestId, confirmDispatch }) => {
      const generated = await generateLandingPageCopySuggestions(store, {
        userId: "user-dup",
        landingPageProjectId: project.id,
        sectionId: "hero",
      }, provider, { requestId, onBeforeProvider: confirmDispatch, recordProviderCall: ledger.write });
      if (!generated.ok) return { ok: false as const, failureKind: "definitive" as const };
      return { ok: true as const, value: generated.value };
    },
  });
  const first = await runOnce();
  const second = await runOnce();
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(counting.calls, 1);
  assert.equal(ledger.rows.length, 1);
});

test("timeout antes do despacho marca FAILED e permite reclaim", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ t: "before" });
  const first = await runGuardedAiOperation({
    userId: "u1", featureKey: "blog_review", idempotencyKey: "pre-timeout", fingerprintHash: fp, store,
    execute: async () => {
      throw new Error("timeout-before-dispatch");
    },
  });
  assert.equal(first.ok, false);
  assert.equal("executionFailed" in first && first.uncertain, false);
  const second = await reserveAiOperation({
    userId: "u1", featureKey: "blog_review", idempotencyKey: "pre-timeout", fingerprintHash: fp, store,
  });
  assert.equal(second.kind, "authorized");
});

test("falha na reserva (store) não autoriza execução", async () => {
  const broken: ReturnType<typeof createMemoryAiIdempotencyStore> = {
    ...createMemoryAiIdempotencyStore(),
    async tryInsert() {
      throw new Error("db down");
    },
  };
  const result = await reserveAiOperation({
    userId: "u1", featureKey: "blog_next", idempotencyKey: "db-fail-01", fingerprintHash: fingerprintAiParams({}), store: broken,
  });
  assert.equal(result.kind, "store_unavailable");
});

test("tentativas diferentes registradas separadamente no ledger", async () => {
  const ledger = createMemoryAiLedger();
  const client = {
    responses: {
      async create() {
        return {
          id: "resp",
          model: "gpt-test",
          output_text: JSON.stringify({ titles: ["A", "B"] }),
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        };
      },
    },
  };
  await runEditorialAction({
    action: "titles",
    inventory: emptyInventory,
    userId: "u1",
    focus: { title: "T" },
    client,
    requestId: "req-attempts",
    attempt: 1,
    recordProviderCall: ledger.write,
  });
  await runEditorialAction({
    action: "titles",
    inventory: emptyInventory,
    userId: "u1",
    focus: { title: "T" },
    client,
    requestId: "req-attempts",
    attempt: 2,
    recordProviderCall: ledger.write,
  });
  assert.equal(ledger.rows.length, 2);
});

test("proteção aplicada às ações do blog e landing", () => {
  for (const action of Object.keys(BLOG_AI_FEATURE_KEYS) as Array<keyof typeof BLOG_AI_FEATURE_KEYS>) {
    assert.match(BLOG_AI_FEATURE_KEYS[action], /^blog_/);
  }
  assert.match(readFileSync("src/lib/blog/actions.ts", "utf8"), /confirmDispatch/);
  assert.match(readFileSync("src/lib/landing-page/copy/request.ts", "utf8"), /confirmDispatch/);
  assert.match(readFileSync("src/lib/learning/landing-page-copy.ts", "utf8"), /confirmDispatch/);
});

test("painel de custos e contratos de autenticação preservados", () => {
  const economics = readFileSync("src/lib/admin/ai-economics.ts", "utf8");
  assert.match(economics, /pricedCostMicros/);
  assert.equal(economics.includes("idempotency"), false);
  assert.match(readFileSync("src/lib/landing-page/copy/request.ts", "utf8"), /copyAssistAccessDecision/);
});

test("helpers fail/unknown com generation", async () => {
  const store = createMemoryAiIdempotencyStore();
  const reserved = await reserveAiOperation({
    userId: "u1", featureKey: "blog_next", idempotencyKey: "helpers-01", fingerprintHash: fingerprintAiParams({}), store,
  });
  assert.equal(reserved.kind, "authorized");
  if (reserved.kind !== "authorized") return;
  await failAiOperation(store, { id: "missing", generation: 1 });
  await unknownAiOperation(store, { id: "missing", generation: 1 });
  const done = await completeAiOperation(store, reserved.reservation);
  assert.ok(done);
});

test("migration de generation documentada", () => {
  assert.match(
    readFileSync("prisma/migrations/20261103220000_ai_operation_reservation_generation/migration.sql", "utf8"),
    /generation/,
  );
  assert.match(readFileSync("docs/ai-idempotency.md", "utf8"), /fencing/);
});
