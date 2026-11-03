import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createMemoryAiLedger } from "../src/lib/ai/ledger";
import {
  completeAiOperation,
  createMemoryAiIdempotencyStore,
  failAiOperation,
  fingerprintAiParams,
  normalizeIdempotencyKey,
  reserveAiOperation,
  unknownAiOperation,
} from "../src/lib/ai/idempotency";
import { runGuardedAiOperation } from "../src/lib/ai/idempotency-guard";
import { blogAiFingerprint, landingPageCopyFingerprint } from "../src/lib/ai/idempotency-fingerprints";
import { readAiIdempotencyMetrics, resetAiIdempotencyMetrics } from "../src/lib/ai/idempotency-metrics";
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
  const c = fingerprintAiParams({ a: 1, b: ["y", "x"] });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(landingPageCopyFingerprint({
    landingPageProjectId: "p1",
    sectionId: "hero",
    draftRevision: 2,
  }), landingPageCopyFingerprint({
    landingPageProjectId: "p1",
    sectionId: "hero",
    draftRevision: 2,
    promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
  }));
  assert.notEqual(
    blogAiFingerprint({ action: "titles", inventory: emptyInventory, focus: { title: "A" } }),
    blogAiFingerprint({ action: "titles", inventory: emptyInventory, focus: { title: "B" } }),
  );
});

test("1) primeira requisição válida autoriza execução", async () => {
  resetAiIdempotencyMetrics();
  const store = createMemoryAiIdempotencyStore();
  const reserved = await reserveAiOperation({
    userId: "u1",
    featureKey: "blog_titles",
    idempotencyKey: "intent-001",
    fingerprintHash: fingerprintAiParams({ v: 1 }),
    store,
  });
  assert.equal(reserved.kind, "authorized");
  assert.equal(readAiIdempotencyMetrics().authorized, 1);
});

test("2) duplo clique com mesma chave bloqueia a segunda", async () => {
  resetAiIdempotencyMetrics();
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ v: 1 });
  const first = await reserveAiOperation({
    userId: "u1", featureKey: "blog_draft", idempotencyKey: "dbl-click-01", fingerprintHash: fp, store,
  });
  const second = await reserveAiOperation({
    userId: "u1", featureKey: "blog_draft", idempotencyKey: "dbl-click-01", fingerprintHash: fp, store,
  });
  assert.equal(first.kind, "authorized");
  assert.equal(second.kind, "in_progress");
  assert.equal(readAiIdempotencyMetrics().in_progress, 1);
});

test("3) cem requisições simultâneas equivalentes autorizam exatamente uma", async () => {
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
    execute: async ({ markDispatched }) => {
      await markDispatched();
      executions += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: true as const, value: "ok" };
    },
  })));
  assert.equal(executions, 1);
  assert.equal(results.filter((row) => row.ok).length, 1);
  assert.equal(results.filter((row) => !row.ok && "block" in row && row.block === "in_progress").length, 99);
});

test("5) nova chave com mesma entrada permite nova geração", async () => {
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

test("6) mesma chave com fingerprint diferente retorna conflito", async () => {
  const store = createMemoryAiIdempotencyStore();
  await reserveAiOperation({
    userId: "u1", featureKey: "blog_seo", idempotencyKey: "same-key", fingerprintHash: fingerprintAiParams({ a: 1 }), store,
  });
  const conflict = await reserveAiOperation({
    userId: "u1", featureKey: "blog_seo", idempotencyKey: "same-key", fingerprintHash: fingerprintAiParams({ a: 2 }), store,
  });
  assert.equal(conflict.kind, "fingerprint_conflict");
});

test("7) isolamento entre usuários", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ x: 1 });
  const a = await reserveAiOperation({ userId: "u1", featureKey: "blog_titles", idempotencyKey: "shared-key-1", fingerprintHash: fp, store });
  const b = await reserveAiOperation({ userId: "u2", featureKey: "blog_titles", idempotencyKey: "shared-key-1", fingerprintHash: fp, store });
  assert.equal(a.kind, "authorized");
  assert.equal(b.kind, "authorized");
});

test("8) isolamento entre funcionalidades", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ x: 1 });
  const a = await reserveAiOperation({ userId: "u1", featureKey: "blog_titles", idempotencyKey: "shared-key-1", fingerprintHash: fp, store });
  const b = await reserveAiOperation({ userId: "u1", featureKey: "blog_draft", idempotencyKey: "shared-key-1", fingerprintHash: fp, store });
  assert.equal(a.kind, "authorized");
  assert.equal(b.kind, "authorized");
});

test("9) timeout antes da chamada ao provedor marca FAILED e permite reclaim", async () => {
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

test("10 e 11) timeout após possível envio marca UNKNOWN e bloqueia", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ t: "after" });
  const first = await runGuardedAiOperation({
    userId: "u1", featureKey: "blog_outline", idempotencyKey: "post-timeout", fingerprintHash: fp, store,
    execute: async ({ markDispatched }) => {
      await markDispatched();
      return { ok: false as const, uncertain: true };
    },
  });
  assert.equal(first.ok, false);
  assert.equal("executionFailed" in first && first.uncertain, true);
  const blocked = await reserveAiOperation({
    userId: "u1", featureKey: "blog_outline", idempotencyKey: "post-timeout", fingerprintHash: fp, store,
  });
  assert.equal(blocked.kind, "unknown_blocked");
});

test("12) recuperação de execução interrompida sem despacho", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ recover: 1 });
  const now = new Date("2026-11-03T12:00:00.000Z");
  const reserved = await reserveAiOperation({
    userId: "u1", featureKey: "blog_coverage", idempotencyKey: "stale-key-1", fingerprintHash: fp, store, now, ttlMs: 1,
  });
  assert.equal(reserved.kind, "authorized");
  const later = new Date(now.getTime() + 10_000);
  const recovered = await reserveAiOperation({
    userId: "u1", featureKey: "blog_coverage", idempotencyKey: "stale-key-1", fingerprintHash: fp, store, now: later, ttlMs: 60_000,
  });
  assert.equal(recovered.kind, "authorized");
});

test("13) falha na reserva (store) não autoriza execução", async () => {
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

test("14) falha na gravação do ledger não descarta resposta válida sob guarda", async () => {
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
    execute: async ({ requestId, markDispatched }) => {
      const generated = await generateLandingPageCopySuggestions(store, {
        userId: "user-a",
        landingPageProjectId: project.id,
        sectionId: "hero",
      }, provider, {
        requestId,
        onBeforeProvider: markDispatched,
        recordProviderCall: async () => {
          throw new Error("ledger down");
        },
        onLedgerFailure: () => undefined,
      });
      if (!generated.ok) return { ok: false as const };
      return { ok: true as const, value: generated.value };
    },
  });
  assert.equal(guarded.ok, true);
  assert.equal(counting.calls, 1);
});

test("15 e 16) repair e retry mantêm o mesmo requestId com attempts distintos", async () => {
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

test("17) tentativas diferentes registradas separadamente no ledger", async () => {
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
  assert.deepEqual(ledger.rows.map((row) => row.attempt).sort((a, b) => a - b), [1, 2]);
});

test("18) duplicata bloqueada não registra provider call", async () => {
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
    execute: async ({ requestId, markDispatched }) => {
      const generated = await generateLandingPageCopySuggestions(store, {
        userId: "user-dup",
        landingPageProjectId: project.id,
        sectionId: "hero",
      }, provider, { requestId, onBeforeProvider: markDispatched, recordProviderCall: ledger.write });
      if (!generated.ok) return { ok: false as const };
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

test("19) proteção aplicada às ações do blog (feature keys)", () => {
  for (const action of Object.keys(BLOG_AI_FEATURE_KEYS) as Array<keyof typeof BLOG_AI_FEATURE_KEYS>) {
    assert.match(BLOG_AI_FEATURE_KEYS[action], /^blog_/);
  }
  const actionsSource = readFileSync("src/lib/blog/actions.ts", "utf8");
  assert.match(actionsSource, /runGuardedAiOperation/);
  assert.match(actionsSource, /idempotencyKey/);
  assert.match(actionsSource, /BLOG_AI_FEATURE_KEYS/);
});

test("20) proteção aplicada à geração de copy de landing page", () => {
  const requestSource = readFileSync("src/lib/landing-page/copy/request.ts", "utf8");
  const lessonSource = readFileSync("src/lib/learning/landing-page-copy.ts", "utf8");
  assert.match(requestSource, /idempotencyKey/);
  assert.match(requestSource, /runGuardedAiOperation/);
  assert.match(lessonSource, /runGuardedAiOperation/);
  assert.match(lessonSource, /idempotencyKey/);
});

test("21) painel de custos por usuário permanece intacto", () => {
  const economics = readFileSync("src/lib/admin/ai-economics.ts", "utf8");
  const dashboard = readFileSync("src/components/admin/ai/AiEconomicsDashboard.tsx", "utf8");
  assert.match(economics, /pricedCostMicros/);
  assert.match(dashboard, /por usuário/i);
  assert.equal(economics.includes("idempotency"), false);
});

test("22) contratos de autenticação e copy assist preservados no escopo", () => {
  const requestSource = readFileSync("src/lib/landing-page/copy/request.ts", "utf8");
  assert.match(requestSource, /getSession/);
  assert.match(requestSource, /copyAssistAccessDecision/);
  assert.match(requestSource, /FORBIDDEN/);
});

test("operação concluída bloqueia reexecução da mesma chave", async () => {
  const store = createMemoryAiIdempotencyStore();
  const fp = fingerprintAiParams({ done: true });
  const first = await runGuardedAiOperation({
    userId: "u1", featureKey: "blog_seo", idempotencyKey: "done-key-1", fingerprintHash: fp, store,
    execute: async () => ({ ok: true as const, value: "x" }),
  });
  assert.equal(first.ok, true);
  const again = await reserveAiOperation({
    userId: "u1", featureKey: "blog_seo", idempotencyKey: "done-key-1", fingerprintHash: fp, store,
  });
  assert.equal(again.kind, "completed");
});

test("complete/fail/unknown helpers", async () => {
  const store = createMemoryAiIdempotencyStore();
  const reserved = await reserveAiOperation({
    userId: "u1", featureKey: "blog_next", idempotencyKey: "helpers-01", fingerprintHash: fingerprintAiParams({}), store,
  });
  assert.equal(reserved.kind, "authorized");
  if (reserved.kind !== "authorized") return;
  await completeAiOperation(store, reserved.reservation.id);
  await failAiOperation(store, "missing");
  await unknownAiOperation(store, "missing");
});
