import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AI_ECONOMICS_CURRENCY_NOTE,
  USD_MICROS_PER_DOLLAR,
  adminAiUserLabel,
  aiEconomicsWindow,
  belemDayKey,
  buildAiEconomicsView,
  economicsRevenueCents,
  formatCoverage,
  formatUsdMicros,
  inAiEconomicsWindow,
  parseAiEconomicsPeriod,
  recognizedPaymentCount,
  type AiEconomicsCall,
  type AiEconomicsPayment,
} from "../src/lib/admin/ai-economics";

const NOW = new Date("2026-11-01T15:00:00.000Z");

function call(overrides: Partial<AiEconomicsCall> = {}): AiEconomicsCall {
  return {
    requestId: "req-1",
    featureKey: "landing_page_copy",
    userId: "user-1",
    providerId: "openai",
    modelId: "gpt-5.4-mini",
    serviceTier: "default",
    promptVersion: "copy-v1",
    operationType: "generate",
    status: "responded",
    inputTokens: 100,
    cachedInputTokens: 20,
    cacheWriteTokens: 0,
    outputTokens: 40,
    totalTokens: 140,
    webSearchCalls: 0,
    estimatedModelCostUsdMicros: USD_MICROS_PER_DOLLAR,
    estimatedToolCostUsdMicros: 0,
    estimatedCostUsdMicros: USD_MICROS_PER_DOLLAR,
    pricingVersion: "openai-2026-11-01-v3",
    latencyMs: 120,
    createdAt: new Date("2026-10-20T15:00:00.000Z"),
    ...overrides,
  };
}

function view(input: Partial<Parameters<typeof buildAiEconomicsView>[0]> = {}) {
  return buildAiEconomicsView({ period: "30", now: NOW, calls: [], payments: [], paidOrders: 0, ...input });
}

function keysOf(value: unknown, found = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    found.add(key);
    keysOf(child, found);
  }
  return found;
}

test("formata USD a partir de micros inteiros", () => {
  assert.equal(formatUsdMicros(null), "—");
  assert.equal(formatUsdMicros(0), "US$ 0,00");
  assert.equal(formatUsdMicros(10_000), "US$ 0,01");
  assert.equal(formatUsdMicros(USD_MICROS_PER_DOLLAR), "US$ 1,00");
  const subcent = formatUsdMicros(350);
  assert.notEqual(subcent, "US$ 0,00");
  assert.match(subcent, /0,00035/);
  const oneMicro = formatUsdMicros(1);
  assert.notEqual(oneMicro, "US$ 0,00");
  assert.equal(oneMicro, "US$ 0,000001");
  assert.equal(formatUsdMicros(-350), "-US$ 0,00035");
  assert.equal(formatCoverage(null), "—");
  assert.equal(formatCoverage(0.934), "93,4% das provider calls registradas");
});

test("uma ação com uma call precificada", () => {
  const result = view({ calls: [call()] });
  assert.equal(result.summary.logicalActions, 1);
  assert.equal(result.summary.providerCalls, 1);
  assert.equal(result.summary.coverage, 1);
  assert.equal(result.summary.additionalCalls, 0);
  assert.equal(result.summary.pricedCostMicros, USD_MICROS_PER_DOLLAR);
});

test("duas calls do mesmo request são chamadas adicionais, não retry", () => {
  const result = view({
    calls: [call({ requestId: "req-2" }), call({ requestId: "req-2", estimatedCostUsdMicros: 200_000, estimatedModelCostUsdMicros: 200_000 })],
  });
  assert.equal(result.summary.logicalActions, 1);
  assert.equal(result.summary.providerCalls, 2);
  assert.equal(result.summary.additionalCalls, 1);
  assert.equal(result.operation.additionalCalls, 1);
  const dashboard = readFileSync(new URL("../src/components/admin/ai/AiEconomicsDashboard.tsx", import.meta.url), "utf8");
  assert.equal(/retry/i.test(dashboard), false);
});

test("repair é contado pelo operationType", () => {
  const result = view({ calls: [call({ operationType: "repair", status: "failed" })] });
  assert.equal(result.summary.repairCalls, 1);
  assert.equal(result.operation.repair, 1);
  assert.equal(result.operation.failed, 1);
  assert.equal(result.summary.additionalCalls, 0);
});

test("unpriced não entra como zero no custo conhecido e reduz a cobertura", () => {
  const result = view({
    calls: [
      call({ requestId: "priced", estimatedCostUsdMicros: 2_000_000, estimatedModelCostUsdMicros: 2_000_000 }),
      call({
        requestId: "open",
        estimatedCostUsdMicros: null,
        estimatedModelCostUsdMicros: null,
        estimatedToolCostUsdMicros: null,
        webSearchCalls: null,
      }),
    ],
  });
  assert.equal(result.summary.unpricedCalls, 1);
  assert.equal(result.summary.pricedCalls, 1);
  assert.equal(result.summary.pricedCostMicros, 2_000_000);
  assert.equal(result.summary.coverage, 0.5);
  assert.equal(result.summary.webSearchCalls, 0);
});

test("ação parcialmente precificada fica fora da média e o custo conhecido permanece", () => {
  const result = view({
    calls: [
      call({ requestId: "mixed", estimatedCostUsdMicros: 100_000, estimatedModelCostUsdMicros: 100_000 }),
      call({ requestId: "mixed", estimatedCostUsdMicros: null, estimatedModelCostUsdMicros: null, estimatedToolCostUsdMicros: null }),
    ],
  });
  assert.equal(result.summary.logicalActions, 1);
  assert.equal(result.summary.pricedCostMicros, 100_000);
  assert.equal(result.unit.fullyPricedActions, 0);
  assert.equal(result.unit.incompleteActions, 1);
  assert.equal(result.unit.averageMicros, null);
  assert.equal(result.unit.averageLabel, "—");
});

test("ação totalmente precificada soma todas as calls no custo médio", () => {
  const result = view({
    calls: [
      call({ requestId: "full", estimatedCostUsdMicros: 400_000, estimatedModelCostUsdMicros: 400_000 }),
      call({ requestId: "full", estimatedCostUsdMicros: 600_000, estimatedModelCostUsdMicros: 600_000 }),
    ],
  });
  assert.equal(result.summary.logicalActions, 1);
  assert.equal(result.summary.providerCalls, 2);
  assert.equal(result.unit.fullyPricedActions, 1);
  assert.equal(result.unit.averageMicros, 1_000_000);
  assert.equal(result.summary.pricedCostMicros, 1_000_000);
});

test("zero calls não divide por zero", () => {
  const result = view();
  assert.equal(result.empty, true);
  assert.equal(result.summary.providerCalls, 0);
  assert.equal(result.summary.coverage, null);
  assert.equal(result.summary.coverageLabel, "—");
  assert.equal(result.unit.averageMicros, null);
  assert.equal(result.unit.averageLabel, "—");
  assert.equal(result.summary.pricedCostLabel, "US$ 0,00");
  assert.equal(result.composition.modelCostLabel, "—");
  assert.equal(result.days.length, 0);
  assert.equal(JSON.stringify(result).includes("NaN"), false);
});

test("custos de modelo e ferramenta usam os micros congelados no ledger", () => {
  const result = view({
    calls: [
      call({
        requestId: "frozen",
        inputTokens: 9_999_999,
        outputTokens: 9_999_999,
        estimatedModelCostUsdMicros: 400_000,
        estimatedToolCostUsdMicros: 100_000,
        estimatedCostUsdMicros: 500_000,
      }),
      call({
        requestId: "tool-only",
        estimatedModelCostUsdMicros: null,
        estimatedToolCostUsdMicros: 20_000,
        estimatedCostUsdMicros: null,
      }),
    ],
  });
  assert.equal(result.composition.modelCostLabel, "US$ 0,40");
  assert.equal(result.composition.toolCostLabel, "US$ 0,12");
  assert.equal(result.summary.pricedCostMicros, 500_000);
  assert.equal(result.summary.pricedCostLabel, "US$ 0,50");
  const source = readFileSync(new URL("../src/lib/admin/ai-economics.ts", import.meta.url), "utf8");
  assert.equal(source.includes("@/lib/ai/pricing"), false);
  assert.equal(source.includes("PRODUCT_JOURNEY_REPORTING_START_AT"), false);
});

test("período valida 7, 30, 90, all e a fronteira meio aberta", () => {
  assert.equal(parseAiEconomicsPeriod("7"), "7");
  assert.equal(parseAiEconomicsPeriod("30"), "30");
  assert.equal(parseAiEconomicsPeriod("90"), "90");
  assert.equal(parseAiEconomicsPeriod("all"), "all");
  assert.equal(parseAiEconomicsPeriod("15"), "30");
  assert.equal(parseAiEconomicsPeriod(undefined), "30");

  const week = aiEconomicsWindow("7", NOW);
  assert.equal(week.start?.toISOString(), new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
  assert.equal(inAiEconomicsWindow(week.start!, week), true);
  assert.equal(inAiEconomicsWindow(new Date(week.start!.getTime() - 1), week), false);
  assert.equal(inAiEconomicsWindow(new Date(week.end.getTime() - 1), week), true);
  assert.equal(inAiEconomicsWindow(week.end, week), false);

  const month = aiEconomicsWindow("30", NOW);
  const quarter = aiEconomicsWindow("90", NOW);
  assert.equal(month.start?.toISOString(), new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
  assert.equal(quarter.start?.toISOString(), new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString());

  const everything = aiEconomicsWindow("all", NOW);
  assert.equal(everything.start, null);
  const historic = call({ createdAt: new Date("2024-01-01T00:00:00.000Z"), requestId: "old" });
  const atEnd = call({ createdAt: NOW, requestId: "edge" });
  const result = view({ period: "all", calls: [historic, atEnd] });
  assert.equal(result.summary.providerCalls, 1);
  assert.equal(result.summary.logicalActions, 1);
});

test("receita reconhece só aprovado e parcialmente reembolsado, líquido do estorno", () => {
  const payments: AiEconomicsPayment[] = [
    { status: "APPROVED", amountCents: 24990, refundedAmountCents: 0, approvedAt: new Date("2026-10-20T12:00:00.000Z"), createdAt: new Date("2026-10-19T12:00:00.000Z") },
    { status: "PARTIALLY_REFUNDED", amountCents: 10000, refundedAmountCents: 2500, approvedAt: null, createdAt: new Date("2026-10-21T12:00:00.000Z") },
    { status: "REFUNDED", amountCents: 5000, refundedAmountCents: 5000, approvedAt: new Date("2026-10-22T12:00:00.000Z"), createdAt: new Date("2026-10-22T12:00:00.000Z") },
    { status: "PENDING", amountCents: 8000, refundedAmountCents: 0, approvedAt: null, createdAt: new Date("2026-10-22T12:00:00.000Z") },
    { status: "APPROVED", amountCents: 9999, refundedAmountCents: 0, approvedAt: NOW, createdAt: new Date("2026-10-01T00:00:00.000Z") },
  ];
  const window = aiEconomicsWindow("30", NOW);
  assert.equal(economicsRevenueCents(payments, window), 24990 + 7500);
  assert.equal(recognizedPaymentCount(payments, window), 2);
  const result = view({ payments, paidOrders: 3 });
  assert.equal(result.revenue.cents, 24990 + 7500);
  assert.equal(result.revenue.label, "R$ 324,90");
  assert.equal(result.revenue.paidOrders, 3);
});

test("o view model não calcula margem entre USD e BRL", () => {
  const result = view({ calls: [call()], payments: [{ status: "APPROVED", amountCents: 1000, refundedAmountCents: 0, approvedAt: new Date("2026-10-20T12:00:00.000Z"), createdAt: new Date("2026-10-20T12:00:00.000Z") }] });
  const forbidden = ["margin", "roi", "profit", "costToRevenuePercent", "exchangeRate", "fxRate", "usdBrl", "brlUsd"];
  const present = keysOf(result);
  for (const key of forbidden) assert.equal(present.has(key), false);
  assert.match(AI_ECONOMICS_CURRENCY_NOTE, /não aplica câmbio/);
  assert.match(AI_ECONOMICS_CURRENCY_NOTE, /não calcula margem/);
});

test("feature desconhecida permanece no breakdown", () => {
  const result = view({
    calls: [
      call({ requestId: "future", featureKey: "future_ai_feature", estimatedCostUsdMicros: 2_000_000, estimatedModelCostUsdMicros: 2_000_000 }),
      call({ requestId: "known", featureKey: "blog_draft", estimatedCostUsdMicros: 1_000_000, estimatedModelCostUsdMicros: 1_000_000 }),
    ],
  });
  assert.deepEqual(result.features.map((feature) => feature.label), ["future_ai_feature", "Blog · rascunho"]);
  assert.equal(result.features[0].pricedCostMicros, 2_000_000);
});

test("modelo sem tier ou versão de preço aparece como não informado e o dia usa America/Belem", () => {
  assert.equal(belemDayKey(new Date("2026-11-02T02:30:00.000Z")), "2026-11-01");
  assert.equal(belemDayKey(new Date("2026-11-02T03:00:00.000Z")), "2026-11-02");
  const stamp = new Date("2026-11-01T02:30:00.000Z");
  const result = view({
    period: "all",
    calls: [
      call({
        createdAt: stamp,
        providerId: "other",
        modelId: "local-model",
        serviceTier: null,
        promptVersion: null,
        pricingVersion: null,
        latencyMs: 10,
      }),
      call({ createdAt: stamp, requestId: "req-2", latencyMs: 30, providerId: "other", modelId: "local-model", serviceTier: null, promptVersion: null, pricingVersion: null }),
    ],
  });
  assert.equal(result.models[0].serviceTierLabel, "Não informado");
  assert.equal(result.models[0].promptVersionLabel, "Não informado");
  assert.equal(result.models[0].pricingVersionLabel, "Não informado");
  assert.equal(result.operation.latencyLabel, "20 ms");
  assert.equal(result.days.find((day) => day.day === "2026-10-31")?.providerCalls, 2);
  assert.equal(result.operation.responded, 2);
  assert.equal(result.operation.generate, 2);
});

test("painel lê o ledger, exige admin e não usa jornada como verdade de custo", () => {
  const page = readFileSync(new URL("../src/app/(admin)/admin/ia/page.tsx", import.meta.url), "utf8");
  const loader = readFileSync(new URL("../src/lib/admin/load-ai-economics.ts", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../src/app/(admin)/admin/layout.tsx", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../src/components/admin/ai/AiEconomicsDashboard.tsx", import.meta.url), "utf8");
  assert.match(page, /requireAdmin/);
  assert.match(page, /if \(!session\) return null/);
  assert.match(page, /loadAiEconomics/);
  assert.match(layout, /Jornada[\s\S]*href="\/admin\/ia"[\s\S]*Usuários/);
  assert.match(dashboard, /Custo médio por ação totalmente precificada/);
  assert.match(dashboard, /Pedidos pagos criados no período/);
  assert.match(dashboard, /AI_ECONOMICS_EMPTY/);
  assert.match(dashboard, /Por usuário/);
  assert.equal(
    readFileSync(new URL("../src/lib/admin/ai-economics.ts", import.meta.url), "utf8").includes("Ainda não há chamadas de IA registradas neste período."),
    true,
  );
  assert.match(loader, /userId: true/);
  assert.match(loader, /user\.findMany/);
  assert.equal(loader.includes("providerResponseId"), false);
  assert.equal(loader.includes("JourneyEvent"), false);
  assert.equal(loader.includes("Prisma.raw"), false);
  assert.equal(loader.includes("$queryRawUnsafe"), false);
  assert.match(dashboard, /Não inclui prompt, resposta nem fatos privados/);
  assert.equal(dashboard.includes("providerResponseId"), false);
  assert.equal(dashboard.includes("systemPrompt"), false);
  assert.equal(dashboard.includes("@/lib/ai/pricing"), false);
});

test("sem dados de usuário o breakdown por usuário fica vazio", () => {
  const result = view();
  assert.deepEqual(result.users, []);
});

test("um usuário agrega ações, features e média completa", () => {
  const result = view({
    calls: [
      call({ requestId: "a1", featureKey: "landing_page_copy", estimatedCostUsdMicros: 400_000, estimatedModelCostUsdMicros: 400_000 }),
      call({ requestId: "a1", featureKey: "landing_page_copy", estimatedCostUsdMicros: 100_000, estimatedModelCostUsdMicros: 100_000 }),
      call({ requestId: "a2", featureKey: "blog_draft", estimatedCostUsdMicros: 200_000, estimatedModelCostUsdMicros: 200_000 }),
    ],
    userDirectory: { "user-1": { name: "Ana", email: "ana@example.com" } },
  });
  assert.equal(result.users.length, 1);
  assert.equal(result.users[0].userId, "user-1");
  assert.equal(result.users[0].adminLabel, "user-1 · ana@example.com");
  assert.equal(result.users[0].actions, 2);
  assert.equal(result.users[0].providerCalls, 3);
  assert.equal(result.users[0].additionalCalls, 1);
  assert.equal(result.users[0].pricedCostMicros, 700_000);
  assert.equal(result.users[0].averageLabel, "US$ 0,35");
  assert.deepEqual(
    result.users[0].features.map((feature) => feature.featureKey),
    ["landing_page_copy", "blog_draft"],
  );
  assert.equal(result.users[0].features[0].additionalCalls, 1);
  assert.equal(result.users[0].features[0].averageLabel, "US$ 0,50");
});

test("vários usuários isolam custo e features sem misturar requestIds", () => {
  const result = view({
    calls: [
      call({ userId: "user-a", requestId: "shared-looking", featureKey: "blog_seo", estimatedCostUsdMicros: 1_000_000, estimatedModelCostUsdMicros: 1_000_000 }),
      call({ userId: "user-b", requestId: "other", featureKey: "blog_seo", estimatedCostUsdMicros: 250_000, estimatedModelCostUsdMicros: 250_000 }),
      call({ userId: "user-b", requestId: "other-2", featureKey: "landing_page_copy", estimatedCostUsdMicros: null, estimatedModelCostUsdMicros: null, estimatedToolCostUsdMicros: null }),
    ],
  });
  assert.equal(result.users.length, 2);
  assert.equal(result.users[0].userId, "user-a");
  assert.equal(result.users[0].pricedCostMicros, 1_000_000);
  assert.equal(result.users[0].features.length, 1);
  assert.equal(result.users[1].userId, "user-b");
  assert.equal(result.users[1].actions, 2);
  assert.equal(result.users[1].unpricedCalls, 1);
  assert.equal(result.users[1].incompleteActions, 1);
  assert.equal(result.users[1].averageLabel, "US$ 0,25");
  assert.equal(result.summary.logicalActions, 3);
  assert.equal(result.summary.pricedCostMicros, 1_250_000);
});

test("ação parcialmente precificada no usuário não entra na média", () => {
  const result = view({
    calls: [
      call({ requestId: "mixed-user", estimatedCostUsdMicros: 80_000, estimatedModelCostUsdMicros: 80_000 }),
      call({ requestId: "mixed-user", estimatedCostUsdMicros: null, estimatedModelCostUsdMicros: null, estimatedToolCostUsdMicros: null }),
      call({ requestId: "ok-user", estimatedCostUsdMicros: 120_000, estimatedModelCostUsdMicros: 120_000 }),
    ],
  });
  assert.equal(result.users[0].pricedCostMicros, 200_000);
  assert.equal(result.users[0].fullyPricedActions, 1);
  assert.equal(result.users[0].incompleteActions, 1);
  assert.equal(result.users[0].averageLabel, "US$ 0,12");
  assert.equal(result.unit.fullyPricedActions, 1);
  assert.equal(result.unit.averageMicros, 120_000);
});

test("falha do provedor e custo nulo permanecem no usuário", () => {
  const result = view({
    calls: [
      call({
        requestId: "fail-1",
        status: "failed",
        operationType: "generate",
        estimatedCostUsdMicros: null,
        estimatedModelCostUsdMicros: null,
        estimatedToolCostUsdMicros: null,
      }),
    ],
  });
  assert.equal(result.users[0].providerCalls, 1);
  assert.equal(result.users[0].unpricedCalls, 1);
  assert.equal(result.users[0].pricedCostMicros, 0);
  assert.equal(result.users[0].averageLabel, "—");
  assert.equal(result.summary.failedCalls, 1);
});

test("filtros de período aplicam-se também ao breakdown por usuário", () => {
  const recent = call({ requestId: "in-window", userId: "user-recent", createdAt: new Date("2026-10-28T12:00:00.000Z") });
  const old = call({
    requestId: "out-window",
    userId: "user-old",
    createdAt: new Date("2026-09-01T12:00:00.000Z"),
    estimatedCostUsdMicros: 9_000_000,
    estimatedModelCostUsdMicros: 9_000_000,
  });
  const week = view({ period: "7", calls: [recent, old] });
  assert.deepEqual(week.users.map((user) => user.userId), ["user-recent"]);
  const month = view({ period: "30", calls: [recent, old] });
  assert.equal(month.users.length, 1);
  const quarter = view({ period: "90", calls: [recent, old] });
  assert.equal(quarter.users.length, 2);
  const all = view({ period: "all", calls: [recent, old] });
  assert.equal(all.users.length, 2);
});

test("rótulo administrativo prioriza userId e não inventa dados", () => {
  assert.equal(adminAiUserLabel("abc"), "abc");
  assert.equal(adminAiUserLabel("abc", { abc: { name: "Ana", email: "ana@example.com" } }), "abc · ana@example.com");
  assert.equal(adminAiUserLabel("abc", { abc: { name: "Ana", email: "  " } }), "abc · Ana");
});

test("indicadores globais existentes permanecem invariantes com users", () => {
  const calls = [
    call({ requestId: "g1", userId: "u1", estimatedCostUsdMicros: 500_000, estimatedModelCostUsdMicros: 500_000 }),
    call({ requestId: "g1", userId: "u1", estimatedCostUsdMicros: 100_000, estimatedModelCostUsdMicros: 100_000 }),
    call({ requestId: "g2", userId: "u2", featureKey: "blog_titles", estimatedCostUsdMicros: null, estimatedModelCostUsdMicros: null, estimatedToolCostUsdMicros: null }),
  ];
  const result = view({ calls });
  assert.equal(result.summary.logicalActions, 2);
  assert.equal(result.summary.providerCalls, 3);
  assert.equal(result.summary.additionalCalls, 1);
  assert.equal(result.summary.pricedCostMicros, 600_000);
  assert.equal(result.summary.unpricedCalls, 1);
  assert.equal(result.unit.fullyPricedActions, 1);
  assert.equal(result.unit.incompleteActions, 1);
  assert.equal(result.unit.averageMicros, 600_000);
  assert.equal(result.features.length, 2);
  assert.equal(result.users.reduce((sum, user) => sum + user.pricedCostMicros, 0), result.summary.pricedCostMicros);
  assert.equal(result.users.reduce((sum, user) => sum + user.providerCalls, 0), result.summary.providerCalls);
});

test("Gate 1 não altera arquivos de UX-C nem telemetria de aquisição", () => {
  const uxC = [
    "src/components/home/CourseHome.tsx",
    "src/components/home/HomeHero.tsx",
    "src/components/course/CourseSales.tsx",
    "src/components/course/CourseHero.tsx",
    "src/lib/learning/course-sales-copy.ts",
    "src/lib/home/public-home.ts",
  ];
  for (const path of uxC) {
    assert.equal(readFileSync(new URL(`../${path}`, import.meta.url), "utf8").includes("buildAiEconomicsView"), false);
  }
  const economics = readFileSync(new URL("../src/lib/admin/ai-economics.ts", import.meta.url), "utf8");
  const loader = readFileSync(new URL("../src/lib/admin/load-ai-economics.ts", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../src/components/admin/ai/AiEconomicsDashboard.tsx", import.meta.url), "utf8");
  for (const source of [economics, loader, dashboard]) {
    assert.equal(source.includes("JourneyEvent"), false);
    assert.equal(source.includes("gtag"), false);
    assert.equal(source.includes("GTM"), false);
    assert.equal(source.includes("course_free_start"), false);
    assert.equal(source.includes("MercadoPago"), false);
  }
});
