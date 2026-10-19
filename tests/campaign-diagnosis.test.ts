import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { readFileSync } from "node:fs";
import { aggregateCampaignBytes, aggregateRecords, derivedFrom, sharesOf } from "../src/lib/campaign-data/aggregate";
import { DIAGNOSIS_HEURISTICS, diagnoseCampaign } from "../src/lib/campaign-data/diagnosis";
import { buildDiagnosisResult, campaignDiagnosisSchema, importVisibleTo, preferredImportId, priorContextNote } from "../src/lib/learning/campaign-diagnosis";

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} ~ ${expected}`);
}

function moneyRow(input: Record<string, string | number>) {
  const row: Record<string, string | number> = { ...input };
  for (const key of ["spend", "conversionValue", "revenue"]) {
    if (typeof row[key] === "number") row[key] = Math.round((row[key] as number) * 100);
  }
  return row;
}

const synthetic = [
  moneyRow({ CAMPAIGN: "Pesquisa - Curso", AD_GROUP: "Curso tráfego pago", impressions: 1000, clicks: 80, spend: 120, conversions: 8, conversionValue: 560 }),
  moneyRow({ CAMPAIGN: "Pesquisa - Curso", AD_GROUP: "Google Ads", impressions: 700, clicks: 42, spend: 84, conversions: 3, conversionValue: 210 }),
  moneyRow({ CAMPAIGN: "Pesquisa - Curso", AD_GROUP: "Meta Ads", impressions: 500, clicks: 25, spend: 50, conversions: 1, conversionValue: 70 }),
];

test("agregação geral usa totais e não média de taxas", () => {
  const aggregate = aggregateRecords(synthetic);
  close(aggregate.totals.impressions ?? 0, 2200);
  close(aggregate.totals.clicks ?? 0, 147);
  close(aggregate.totals.spend ?? 0, 254);
  close(aggregate.totals.conversions ?? 0, 12);
  close(aggregate.totals.conversionValue ?? 0, 840);
  assert.equal(aggregate.derived.ctr.available, true);
  assert.equal(aggregate.derived.cpc.available, true);
  assert.equal(aggregate.derived.conversionRate.available, true);
  assert.equal(aggregate.derived.cpa.available, true);
  assert.equal(aggregate.derived.roas.available, true);
  if (aggregate.derived.ctr.available) close(aggregate.derived.ctr.value, 147 / 2200);
  if (aggregate.derived.cpc.available) close(aggregate.derived.cpc.value, 254 / 147);
  if (aggregate.derived.conversionRate.available) close(aggregate.derived.conversionRate.value, 12 / 147);
  if (aggregate.derived.cpa.available) close(aggregate.derived.cpa.value, 254 / 12);
  if (aggregate.derived.roas.available) close(aggregate.derived.roas.value, 840 / 254);
  const averageCtr = (80 / 1000 + 42 / 700 + 25 / 500) / 3;
  if (aggregate.derived.ctr.available) assert.notEqual(Number(aggregate.derived.ctr.value.toFixed(6)), Number(averageCtr.toFixed(6)));
  assert.equal(aggregate.totals.leads, undefined);
  assert.equal(aggregate.derived.cpl.available, false);
});

test("agrupa campanha, grupo, conjunto, anúncio, palavra, termo e posicionamento", () => {
  const rows = [
    moneyRow({ CAMPAIGN: "A", AD_GROUP: "G1", AD_SET: "S1", AD: "Anúncio 1", KEYWORD: "curso", SEARCH_TERM: "curso trafego", PLACEMENT: "Feed", impressions: 100, clicks: 10, spend: 20, conversions: 2 }),
    moneyRow({ CAMPAIGN: "B", AD_GROUP: "G2", AD_SET: "S2", AD: "Anúncio 2", KEYWORD: "aula", SEARCH_TERM: "aula gratis", PLACEMENT: "Stories", impressions: 50, clicks: 5, spend: 10, conversions: 0 }),
  ];
  const aggregate = aggregateRecords(rows);
  for (const dimension of ["CAMPAIGN", "AD_GROUP", "AD_SET", "AD", "KEYWORD", "SEARCH_TERM", "PLACEMENT"] as const) {
    const found = aggregate.dimensions.find((item) => item.dimension === dimension);
    assert.equal(found?.segments.length, 2, dimension);
  }
  const groups = aggregate.dimensions.find((item) => item.dimension === "AD_GROUP");
  const shares = groups?.segments.map((segment) => segment.shares.spendShare ?? 0) ?? [];
  close(shares.reduce((sum, value) => sum + value, 0), 1);
});

test("métrica ausente não vira zero e divisão por zero não existe", () => {
  const aggregate = aggregateRecords([moneyRow({ CAMPAIGN: "A", impressions: 100, clicks: 0, spend: 10 })]);
  assert.equal(aggregate.totals.conversions, undefined);
  assert.equal(aggregate.totals.leads, undefined);
  assert.equal(aggregate.derived.cpc.available, false);
  assert.equal(aggregate.derived.conversionRate.available, false);
  assert.equal(aggregate.derived.roas.available, false);
  assert.equal(aggregate.derived.cpl.available, false);
  const shares = sharesOf(aggregate.totals, aggregate.totals);
  assert.equal(shares.leadShare, null);
  assert.equal(shares.conversionShare, null);
});

test("gzip privado soma centavos de volta para reais", async () => {
  const body = gzipSync(Buffer.from(`${synthetic.map((row) => JSON.stringify(row)).join("\n")}\n`));
  const aggregate = await aggregateCampaignBytes(body);
  close(aggregate.totals.spend ?? 0, 254);
  close(aggregate.totals.conversionValue ?? 0, 840);
});

test("gasto material sem conversão é evidência forte e não manda pausar", () => {
  const rows = [
    moneyRow({ AD_GROUP: "A", impressions: 800, clicks: 80, spend: 80, conversions: 8 }),
    moneyRow({ AD_GROUP: "B", impressions: 400, clicks: 40, spend: 40, conversions: 0 }),
  ];
  const diagnosis = diagnoseCampaign(aggregateRecords(rows));
  const found = diagnosis.evidences.find((item) => item.code === "SEGMENT_WITH_SPEND_NO_RESULT");
  assert.ok(found);
  assert.equal(found?.strength, "STRONG");
  assert.equal(found?.stage, "CONVERSION");
  assert.equal(diagnosis.primaryBottleneck, "CONVERSION");
  assert.equal(diagnosis.readiness, "DIAGNOSIS_READY");
  assert.equal(found?.explanation.includes("paus"), false);
  assert.equal(DIAGNOSIS_HEURISTICS.materialSpendShare > 0, true);
});

test("linha pequena não gera alerta forte", () => {
  const rows = [
    moneyRow({ AD_GROUP: "A", impressions: 1000, clicks: 100, spend: 200, conversions: 10 }),
    moneyRow({ AD_GROUP: "B", impressions: 20, clicks: 2, spend: 1, conversions: 0 }),
  ];
  const diagnosis = diagnoseCampaign(aggregateRecords(rows));
  assert.equal(diagnosis.evidences.some((item) => item.code === "SEGMENT_WITH_SPEND_NO_RESULT"), false);
});

test("cliques sem conversão, leads sem qualificação e receita ausente", () => {
  const clicks = diagnoseCampaign(aggregateRecords([moneyRow({ CAMPAIGN: "A", impressions: 100, clicks: 10, spend: 20, conversions: 0 })]));
  assert.equal(clicks.evidences.some((item) => item.code === "CLICKS_WITHOUT_CONVERSIONS"), true);
  assert.equal(clicks.evidences.some((item) => item.code === "SPEND_WITHOUT_CONVERSIONS"), true);
  const leads = diagnoseCampaign(aggregateRecords([moneyRow({ CAMPAIGN: "A", impressions: 10, clicks: 2, spend: 5, leads: 2 })]));
  assert.equal(leads.evidences.some((item) => item.code === "LEADS_WITHOUT_QUALIFICATION_DATA"), true);
  assert.equal(leads.primaryBottleneck === "LEAD_QUALITY", false);
  const value = diagnoseCampaign(aggregateRecords(synthetic));
  assert.equal(value.caveats.some((item) => item.includes("receita")), true);
  assert.equal(value.evidences.some((item) => item.code === "CONVERSIONS_WITHOUT_VALUE_DATA"), false);
});

test("qualidade de lead só entra com as duas métricas", () => {
  const rows = [
    moneyRow({ AD_SET: "A", impressions: 100, clicks: 20, spend: 40, leads: 20, qualifiedLeads: 10 }),
    moneyRow({ AD_SET: "B", impressions: 100, clicks: 20, spend: 40, leads: 20, qualifiedLeads: 1 }),
  ];
  const diagnosis = diagnoseCampaign(aggregateRecords(rows));
  assert.equal(diagnosis.evidences.some((item) => item.code === "LOW_RELATIVE_LEAD_QUALITY"), true);
  assert.equal(diagnosis.primaryBottleneck, "LEAD_QUALITY");
});

test("dois sinais fortes no mesmo nível ficam mistos", () => {
  const diagnosis = diagnoseCampaign(aggregateRecords([moneyRow({ CAMPAIGN: "A", impressions: 100, clicks: 0, spend: 30, conversions: 0 })]));
  assert.equal(diagnosis.primaryBottleneck, "MIXED");
  assert.equal(diagnosis.evidenceStrength, "MODERATE");
});

test("arquivo sintético sem padrão forte não inventa gargalo", () => {
  const aggregate = aggregateRecords(synthetic);
  const diagnosis = diagnoseCampaign(aggregate);
  assert.equal(diagnosis.primaryBottleneck, "INSUFFICIENT_EVIDENCE");
  assert.equal(diagnosis.readiness, "INSUFFICIENT_EVIDENCE");
  assert.equal(diagnosis.evidenceStrength, "LIMITED");
  assert.equal(diagnosis.caveats.some((item) => item.includes("período")), true);
  const derived = derivedFrom(aggregate.totals);
  assert.equal(derived.ctr.available && derived.cpc.available && derived.roas.available, true);
});

test("ownership, prefill e resultado não usam contexto para inventar métrica", () => {
  assert.equal(importVisibleTo("user-a", "project-a", { userId: "user-a", projectId: "project-a", status: "READY" }), true);
  assert.equal(importVisibleTo("user-b", "project-a", { userId: "user-a", projectId: "project-a", status: "READY" }), false);
  assert.equal(importVisibleTo("user-a", "project-a", { userId: "user-a", projectId: "project-a", status: "FAILED" }), false);
  assert.equal(preferredImportId(["only"]), "only");
  assert.equal(preferredImportId(["a", "b"]), null);
  assert.match(priorContextNote(true) ?? "", /não substitui/);
  const result = buildDiagnosisResult({
    projectId: "project-a",
    campaignDataImportId: "import-a",
    sourcePlatform: "GOOGLE_ADS",
    currency: "BRL",
    availableDimensions: ["CAMPAIGN", "AD_GROUP"],
    availableMetrics: ["IMPRESSIONS", "CLICKS", "SPEND", "CONVERSIONS", "CONVERSION_VALUE", "CTR", "CPC", "CONVERSION_RATE", "CPA", "ROAS"],
    aggregate: aggregateRecords(synthetic),
    selectedDimension: "AD_GROUP",
  });
  assert.equal(campaignDiagnosisSchema.safeParse(result).success, true);
  assert.equal(result.totals.leads, undefined);
  assert.equal(result.availableMetrics.includes("LEADS"), false);
  assert.equal(result.readiness, "INSUFFICIENT_EVIDENCE");
});

test("tool e logs não carregam dataset para analytics", () => {
  const tool = readFileSync(new URL("../src/components/learning/CampaignDiagnosisTool.tsx", import.meta.url), "utf8");
  const plan = readFileSync(new URL("../src/lib/learning/campaign-diagnosis-plan.ts", import.meta.url), "utf8");
  assert.equal(tool.includes("gtag"), false);
  assert.equal(tool.includes("track("), false);
  assert.equal(plan.includes("console.info"), true);
  assert.equal(plan.includes("explanation"), false);
  assert.match(plan, /scope: "campaign-diagnosis"/);
});
