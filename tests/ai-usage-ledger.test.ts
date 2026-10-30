import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import OpenAI from "openai";
import { AI_PROVIDER_CALL_FIELDS, createMemoryAiLedger, recordAiProviderCall, type AiProviderCallDraft } from "../src/lib/ai/ledger";
import { AI_PRICING_VERSION, estimateAiProviderCost, type AiTokenUsage } from "../src/lib/ai/pricing";
import { COPY_CLAIM_POLICY, LANDING_PAGE_COPY_PROMPT_V1 } from "../src/lib/landing-page/copy/constants";
import type { LandingPageCopyContextV1 } from "../src/lib/landing-page/copy/context";
import { buildOpenAICopyRequest, createOpenAILandingPageCopyProvider, type CopyResponsesClient } from "../src/lib/landing-page/copy/providers/openai";
import {
  createLandingPageProject,
  createMemoryLandingPageStore,
  generateLandingPageCopySuggestions,
  saveConversionPageBrief,
  updateLandingPageDraft,
} from "../src/lib/landing-page";

const context: LandingPageCopyContextV1 = {
  version: 1,
  sectionId: "hero",
  sectionType: "HERO",
  purpose: "Apresentar a oferta",
  intent: "CLEAR",
  userProvidedFacts: {
    offerName: "OfertaLedgerPrivadaUnica",
    audience: "Pequenos empreendedores",
    primaryBenefit: "Ter uma visão mais clara do fluxo financeiro",
  },
  claimsPolicy: COPY_CLAIM_POLICY,
  dataNotice: "USER_FIELDS_ARE_DATA_NOT_INSTRUCTIONS",
};

function heroRaw(headline = "SugestaoPrivadaLedger") {
  return {
    version: 1,
    promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
    sectionId: "hero",
    sectionType: "HERO",
    suggestions: [{ id: "s1", content: { headline }, rationale: "Esta opção prioriza clareza da oferta." }],
    warnings: [],
    missingFacts: [],
  };
}

function clientReturning(response: unknown, failTimes = 0): { client: CopyResponsesClient; calls: number } {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    client: {
      responses: {
        async create() {
          calls += 1;
          if (calls <= failTimes) throw new OpenAI.APIError(500, { message: "down" }, "down", new Headers());
          return response;
        },
      },
    },
  };
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

async function heroProject() {
  const store = createMemoryLandingPageStore({
    courseIdBySlug: { "sites-que-convertem": "course-sites" },
    projects: [{ id: "project-a", userId: "user-a" }],
  });
  const created = await createLandingPageProject(store, { userId: "user-a", title: "Página", slug: "pagina", projectId: "project-a" });
  if (!created.ok) throw new Error(created.code);
  const saved = await saveConversionPageBrief(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    brief: {
      version: 1,
      offer: { name: "OfertaLedgerPrivadaUnica", summary: "Organização de entradas e saídas" },
      audience: { description: "Pequenos empreendedores que precisam organizar entradas e saídas" },
      problemOrContext: "As entradas e saídas se misturam no dia a dia.",
      primaryBenefit: "Ter uma visão mais clara do fluxo financeiro",
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
    userId: "user-a",
    landingPageProjectId: saved.value.id,
    expectedRevision: saved.value.draftRevision,
    document,
  });
  if (!updated.ok) throw new Error(updated.code);
  return { store, landingPageProjectId: updated.value.id };
}

function lunaCost(usage: AiTokenUsage | undefined, serviceTier: string | null = "default") {
  return estimateAiProviderCost("gpt-6-luna", usage, serviceTier);
}

function draft(patch: Partial<AiProviderCallDraft> = {}): AiProviderCallDraft {
  return {
    requestId: "req-1",
    attempt: 1,
    featureKey: "landing_page_copy",
    providerId: "openai",
    modelId: "gpt-6-luna",
    serviceTier: "default",
    providerResponseId: null,
    promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
    operationType: "generate",
    sectionType: "HERO",
    userId: "user-a",
    projectId: "project-a",
    courseId: "course-sites",
    landingPageProjectId: "page-1",
    status: "responded",
    errorCode: null,
    inputTokens: 10,
    cachedInputTokens: null,
    cacheWriteTokens: null,
    cacheWrite30mTokens: null,
    cacheWrite12hTokens: null,
    outputTokens: 4,
    reasoningTokens: null,
    totalTokens: null,
    estimatedCostUsdMicros: 1,
    pricingVersion: AI_PRICING_VERSION,
    latencyMs: 12,
    ...patch,
  };
}

test("o preço do Luna usa inteiros e não cobra reasoning de novo", () => {
  assert.deepEqual(lunaCost( { inputTokens: 1_000_000, outputTokens: 0 }), {
    estimatedCostUsdMicros: 200_000,
    pricingVersion: AI_PRICING_VERSION,
  });
  assert.deepEqual(lunaCost( { inputTokens: 1_000_000, cachedInputTokens: 1_000_000, outputTokens: 0 }), {
    estimatedCostUsdMicros: 20_000,
    pricingVersion: AI_PRICING_VERSION,
  });
  assert.deepEqual(lunaCost( {
    inputTokens: 1_000_000,
    cacheWriteTokens: 1_000_000,
    cacheWrite30mTokens: 1_000_000,
    outputTokens: 0,
  }), {
    estimatedCostUsdMicros: 250_000,
    pricingVersion: AI_PRICING_VERSION,
  });
  assert.deepEqual(lunaCost( {
    inputTokens: 1_000_000,
    cacheWriteTokens: 1_000_000,
    cacheWrite12hTokens: 1_000_000,
    outputTokens: 0,
  }), {
    estimatedCostUsdMicros: 500_000,
    pricingVersion: AI_PRICING_VERSION,
  });
  assert.deepEqual(lunaCost( {
    inputTokens: 1_000,
    cachedInputTokens: 200,
    cacheWriteTokens: 150,
    cacheWrite30mTokens: 100,
    cacheWrite12hTokens: 50,
    outputTokens: 10,
    reasoningTokens: 9,
  }), {
    estimatedCostUsdMicros: 97,
    pricingVersion: AI_PRICING_VERSION,
  });
  const outputOnly = lunaCost( { inputTokens: 0, outputTokens: 1_000_000, reasoningTokens: 900_000 });
  const sameOutput = lunaCost( { inputTokens: 0, outputTokens: 1_000_000 });
  assert.equal(outputOnly.estimatedCostUsdMicros, 500_000);
  assert.equal(outputOnly.estimatedCostUsdMicros, sameOutput.estimatedCostUsdMicros);
  assert.deepEqual(estimateAiProviderCost("gpt-6-sol", { inputTokens: 20, outputTokens: 5 }, "default"), {
    estimatedCostUsdMicros: null,
    pricingVersion: null,
  });
  for (const tier of ["flex", "priority", "scale", "auto", "ultrafast", null]) {
    assert.equal(lunaCost({ inputTokens: 1_000, outputTokens: 10 }, tier).estimatedCostUsdMicros, null);
  }
  assert.equal(lunaCost({ inputTokens: 272_000, outputTokens: 0 }).estimatedCostUsdMicros, 27_200);
  const longContext = lunaCost({ inputTokens: 272_001, outputTokens: 0 });
  assert.equal(longContext.estimatedCostUsdMicros, 54_400);
  assert.notEqual(longContext.estimatedCostUsdMicros, lunaCost({ inputTokens: 272_001, outputTokens: 0 }, "flex").estimatedCostUsdMicros);
  assert.equal(lunaCost({ inputTokens: 272_001, outputTokens: 0 }, "flex").pricingVersion, null);
  assert.deepEqual(lunaCost({
    inputTokens: 1_000,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    cacheWrite30mTokens: 0,
    cacheWrite12hTokens: 0,
    outputTokens: 0,
  }), { estimatedCostUsdMicros: 100, pricingVersion: AI_PRICING_VERSION });
  assert.equal(lunaCost({
    inputTokens: 15_000,
    cachedInputTokens: 4_000,
    cacheWriteTokens: 7_000,
    cacheWrite30mTokens: 1_000,
    cacheWrite12hTokens: 1_000,
    outputTokens: 10,
  }).pricingVersion, null);
  assert.deepEqual(lunaCost( undefined), {
    estimatedCostUsdMicros: null,
    pricingVersion: null,
  });
  assert.equal(lunaCost( { inputTokens: 0, outputTokens: 0 }).estimatedCostUsdMicros, 0);
  assert.deepEqual(lunaCost( { inputTokens: 100, cacheWriteTokens: 40, outputTokens: 1 }), {
    estimatedCostUsdMicros: null,
    pricingVersion: null,
  });
});

test("cada responses.create vira uma provider call, inclusive repair e retry", async () => {
  const { store, landingPageProjectId } = await heroProject();
  const acceptedLedger = createMemoryAiLedger();
  const accepted = clientReturning({
    id: "resp-1",
    model: "gpt-6-luna",
    service_tier: "default",
    output_text: JSON.stringify(heroRaw()),
    usage: { input_tokens: 1_000, output_tokens: 2, total_tokens: 1_002 },
  });
  const acceptedResult = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId,
    sectionId: "hero",
  }, createOpenAILandingPageCopyProvider({ client: accepted.client, apiKey: "test-key", model: "gpt-6-luna" }), {
    recordProviderCall: acceptedLedger.write,
  });
  assert.equal(acceptedResult.ok, true);
  assert.equal(accepted.calls, 1);
  assert.equal(acceptedLedger.rows.length, 1);
  assert.equal(acceptedLedger.rows[0]?.attempt, 1);
  assert.equal(acceptedLedger.rows[0]?.status, "responded");
  assert.equal(acceptedLedger.rows[0]?.operationType, "generate");
  assert.equal(acceptedLedger.rows[0]?.estimatedCostUsdMicros, 101);
  assert.equal(acceptedLedger.rows[0]?.serviceTier, "default");
  assert.equal(acceptedLedger.rows[0]?.providerResponseId, "resp-1");

  const repairLedger = createMemoryAiLedger();
  let repairCalls = 0;
  const repairClient: CopyResponsesClient = {
    responses: {
      async create() {
        repairCalls += 1;
        if (repairCalls === 1) {
          return { id: "resp-a", model: "gpt-6-luna", service_tier: "default", output_text: "{", usage: { input_tokens: 100, output_tokens: 10 } };
        }
        return { id: "resp-b", model: "gpt-6-luna", service_tier: "default", output_text: JSON.stringify(heroRaw()), usage: { input_tokens: 200, output_tokens: 20 } };
      },
    },
  };
  const repaired = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId,
    sectionId: "hero",
  }, createOpenAILandingPageCopyProvider({ client: repairClient, apiKey: "test-key", model: "gpt-6-luna" }), {
    recordProviderCall: repairLedger.write,
  });
  assert.equal(repaired.ok, true);
  assert.equal(repairCalls, 2);
  assert.deepEqual(repairLedger.rows.map((row) => row.attempt), [1, 2]);
  assert.equal(new Set(repairLedger.rows.map((row) => row.requestId)).size, 1);
  assert.deepEqual(repairLedger.rows.map((row) => row.operationType), ["generate", "repair"]);
  assert.equal(
    (repairLedger.rows[0]?.estimatedCostUsdMicros ?? 0) + (repairLedger.rows[1]?.estimatedCostUsdMicros ?? 0),
    (lunaCost( { inputTokens: 100, outputTokens: 10 }).estimatedCostUsdMicros ?? 0)
      + (lunaCost( { inputTokens: 200, outputTokens: 20 }).estimatedCostUsdMicros ?? 0),
  );

  const retryLedger = createMemoryAiLedger();
  const retried = clientReturning({
    id: "resp-retry",
    model: "gpt-6-luna",
    service_tier: "default",
    output_text: JSON.stringify(heroRaw()),
    usage: { input_tokens: 50, output_tokens: 5 },
  }, 1);
  const retriedResult = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId,
    sectionId: "hero",
  }, createOpenAILandingPageCopyProvider({ client: retried.client, apiKey: "test-key", model: "gpt-6-luna" }), {
    recordProviderCall: retryLedger.write,
  });
  assert.equal(retriedResult.ok, true);
  assert.equal(retried.calls, 2);
  assert.deepEqual(retryLedger.rows.map((row) => [row.attempt, row.status, row.operationType]), [
    [1, "failed", "generate"],
    [2, "responded", "generate"],
  ]);
  assert.equal(retryLedger.rows[0]?.errorCode, "COPY_ASSIST_PROVIDER_ERROR");
  assert.equal(retryLedger.rows[0]?.estimatedCostUsdMicros, null);
  assert.equal(new Set(retryLedger.rows.map((row) => row.requestId)).size, 1);

  const cached = clientReturning({
    id: "resp-cache",
    model: "gpt-6-other",
    output_text: JSON.stringify(heroRaw()),
    usage: {
      input_tokens: 80,
      output_tokens: 8,
      total_tokens: 88,
      input_tokens_details: {
        cached_tokens: 20,
        cache_write_tokens: 10,
        cache_write_tokens_details: { ttl_30m_tokens: 10, ttl_12h_tokens: 0 },
      },
      output_tokens_details: { reasoning_tokens: 3 },
    },
  });
  const cachedLedger = createMemoryAiLedger();
  await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId,
    sectionId: "hero",
  }, createOpenAILandingPageCopyProvider({ client: cached.client, apiKey: "test-key", model: "gpt-6-luna" }), {
    recordProviderCall: cachedLedger.write,
  });
  assert.equal(cachedLedger.rows[0]?.modelId, "gpt-6-other");
  assert.equal(cachedLedger.rows[0]?.cachedInputTokens, 20);
  assert.equal(cachedLedger.rows[0]?.cacheWrite30mTokens, 10);
  assert.equal(cachedLedger.rows[0]?.cacheWrite12hTokens, 0);

  const zeroTtlLedger = createMemoryAiLedger();
  const zeroTtl = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId,
    sectionId: "hero",
  }, createOpenAILandingPageCopyProvider({
    client: clientReturning({
      id: "resp-zero-ttl",
      model: "gpt-6-luna",
      service_tier: "default",
      output_text: JSON.stringify(heroRaw()),
      usage: {
        input_tokens: 8,
        output_tokens: 1,
        input_tokens_details: {
          cached_tokens: 0,
          cache_write_tokens: 0,
          cache_write_tokens_details: { ttl_30m_tokens: 0, ttl_12h_tokens: 0 },
        },
      },
    }).client,
    apiKey: "test-key",
    model: "gpt-6-luna",
  }), { recordProviderCall: zeroTtlLedger.write });
  assert.equal(zeroTtl.ok, true);
  assert.equal(zeroTtlLedger.rows[0]?.cacheWriteTokens, 0);
  assert.equal(zeroTtlLedger.rows[0]?.cacheWrite30mTokens, 0);
  assert.equal(zeroTtlLedger.rows[0]?.cacheWrite12hTokens, 0);
  assert.equal(zeroTtlLedger.rows[0]?.estimatedCostUsdMicros, 1);
  assert.equal(cachedLedger.rows[0]?.reasoningTokens, 3);
  assert.equal(cachedLedger.rows[0]?.estimatedCostUsdMicros, null);
  assert.equal(cachedLedger.rows[0]?.pricingVersion, null);

  const foreign = await generateLandingPageCopySuggestions(store, {
    userId: "user-b",
    landingPageProjectId,
    sectionId: "hero",
  }, createOpenAILandingPageCopyProvider({ client: clientReturning({}).client, apiKey: "test-key" }), {
    recordProviderCall: createMemoryAiLedger().write,
  });
  assert.equal(foreign.ok, false);
  if (!foreign.ok) assert.equal(foreign.code, "NOT_FOUND");

  const failures: number[] = [];
  const brokenLedger = createMemoryAiLedger();
  const survived = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId,
    sectionId: "hero",
  }, createOpenAILandingPageCopyProvider({
    client: clientReturning({ output_text: JSON.stringify(heroRaw()), usage: { input_tokens: 4, output_tokens: 1 }, model: "gpt-6-luna" }).client,
    apiKey: "test-key",
    model: "gpt-6-luna",
  }), {
    recordProviderCall: async () => {
      throw new Error("ledger down");
    },
    onLedgerFailure: (notice) => failures.push(notice.attempt),
  });
  assert.equal(survived.ok, true);
  assert.deepEqual(failures, [1]);
  assert.equal(brokenLedger.rows.length, 0);

  const failedWriter: number[] = [];
  const failedWrite = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId,
    sectionId: "hero",
  }, createOpenAILandingPageCopyProvider({
    client: clientReturning({
      id: "resp-failed-ledger",
      model: "gpt-6-luna",
      service_tier: "default",
      output_text: JSON.stringify(heroRaw()),
      usage: { input_tokens: 4, output_tokens: 1 },
    }).client,
    apiKey: "test-key",
    model: "gpt-6-luna",
  }), {
    recordProviderCall: async () => "failed",
    onLedgerFailure: (notice) => failedWriter.push(notice.attempt),
  });
  assert.equal(failedWrite.ok, true);
  assert.deepEqual(failedWriter, [1]);

  const hungNotices: number[] = [];
  const hungStarted = Date.now();
  const hung = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId,
    sectionId: "hero",
  }, createOpenAILandingPageCopyProvider({
    client: clientReturning({
      id: "resp-hung",
      model: "gpt-6-luna",
      service_tier: "default",
      output_text: JSON.stringify(heroRaw()),
      usage: { input_tokens: 4, output_tokens: 1 },
    }).client,
    apiKey: "test-key",
    model: "gpt-6-luna",
  }), {
    recordProviderCall: () => new Promise(() => undefined),
    ledgerTimeoutMs: 30,
    onLedgerFailure: (notice) => hungNotices.push(notice.attempt),
  });
  assert.equal(hung.ok, true);
  if (!hung.ok) return;
  assert.equal(hung.value.suggestions.length, 1);
  assert.deepEqual(hungNotices, [1]);
  assert.equal(Date.now() - hungStarted < 1_000, true);

  const officialLedger = createMemoryAiLedger();
  const official = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId,
    sectionId: "hero",
  }, createOpenAILandingPageCopyProvider({
    client: clientReturning({
      id: "resp-official",
      model: "gpt-6-luna",
      service_tier: "default",
      output_text: JSON.stringify(heroRaw()),
      usage: {
        input_tokens: 15_000,
        output_tokens: 10,
        input_tokens_details: {
          cached_tokens: 4_000,
          cache_write_tokens: 7_000,
          cache_write_tokens_details: { ttl_30m_tokens: 3_000, ttl_12h_tokens: 4_000 },
        },
      },
    }).client,
    apiKey: "test-key",
    model: "gpt-6-luna",
  }), { recordProviderCall: officialLedger.write });
  assert.equal(official.ok, true);
  assert.equal(officialLedger.rows[0]?.cachedInputTokens, 4_000);
  assert.equal(officialLedger.rows[0]?.cacheWriteTokens, 7_000);
  assert.equal(officialLedger.rows[0]?.cacheWrite30mTokens, 3_000);
  assert.equal(officialLedger.rows[0]?.cacheWrite12hTokens, 4_000);
  assert.equal(officialLedger.rows[0]?.serviceTier, "default");
  assert.equal(officialLedger.rows[0]?.estimatedCostUsdMicros, 1_820);

  const flexLedger = createMemoryAiLedger();
  const flex = await generateLandingPageCopySuggestions(store, {
    userId: "user-a",
    landingPageProjectId,
    sectionId: "hero",
  }, createOpenAILandingPageCopyProvider({
    client: clientReturning({
      id: "resp-flex",
      model: "gpt-6-luna",
      service_tier: "flex",
      output_text: JSON.stringify(heroRaw()),
      usage: { input_tokens: 1_000_000, output_tokens: 0 },
    }).client,
    apiKey: "test-key",
    model: "gpt-6-luna",
  }), { recordProviderCall: flexLedger.write });
  assert.equal(flex.ok, true);
  assert.equal(flexLedger.rows[0]?.serviceTier, "flex");
  assert.equal(flexLedger.rows[0]?.estimatedCostUsdMicros, null);
  assert.equal(flexLedger.rows[0]?.pricingVersion, null);

  const serialized = JSON.stringify([
    ...acceptedLedger.rows,
    ...repairLedger.rows,
    ...retryLedger.rows,
    ...cachedLedger.rows,
    ...zeroTtlLedger.rows,
    ...officialLedger.rows,
    ...flexLedger.rows,
  ]);
  assert.equal(serialized.includes("OfertaLedgerPrivadaUnica"), false);
  assert.equal(serialized.includes("SugestaoPrivadaLedger"), false);
  assert.equal(serialized.includes("test-key"), false);
  assert.equal(serialized.includes("instructions"), false);
  assert.equal(serialized.includes("userProvidedFacts"), false);
  assert.equal(serialized.includes("draftDocument"), false);
  for (const row of acceptedLedger.rows) {
    assert.deepEqual(Object.keys(row).sort(), [...AI_PROVIDER_CALL_FIELDS].sort());
  }
});

test("requestId e attempt não duplicam o custo e a migration só cria a tabela", async () => {
  const ledger = createMemoryAiLedger();
  assert.equal(await ledger.write(draft()), "recorded");
  assert.equal(await ledger.write(draft()), "duplicate");
  assert.equal(ledger.rows.length, 1);
  assert.equal(await recordAiProviderCall(draft({ requestId: "req-2" }), async () => {
    throw { code: "P2002" };
  }), "duplicate");

  const sql = readFileSync("prisma/migrations/20261030180000_add_ai_provider_call/migration.sql", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(sql, /CREATE TABLE "ai_provider_call"/);
  assert.equal(/\bDROP\b/i.test(sql), false);
  assert.equal(/\bDELETE FROM\b/i.test(sql), false);
  assert.equal(/\bUPDATE\s+"/i.test(sql), false);
  assert.equal(/\bINSERT\b/i.test(sql), false);
  assert.match(schema, /model AiProviderCall/);
  assert.equal(schema.includes("enum Ai"), false);

  const aiSource = filesUnder("src/lib/ai").map((path) => readFileSync(path, "utf8")).join("\n");
  const adapter = readFileSync("src/lib/landing-page/copy/providers/openai.ts", "utf8");
  const service = readFileSync("src/lib/landing-page/copy/service.ts", "utf8");
  assert.equal(aiSource.includes("JourneyEvent"), false);
  assert.equal(service.includes("JourneyEvent"), false);
  assert.equal(aiSource.includes("userProvidedFacts"), false);
  assert.equal(aiSource.includes("draftDocument"), false);
  assert.equal(adapter.includes("await executeProviderCall()"), true);
  assert.equal((adapter.match(/await executeProviderCall\(\)/g) ?? []).length, 2);
  const request = buildOpenAICopyRequest({ model: "gpt-6-luna", promptVersion: LANDING_PAGE_COPY_PROMPT_V1, context, repair: false, variantCount: 1 });
  assert.equal(request.store, false);
  assert.equal(request.reasoning?.effort, "none");
});
