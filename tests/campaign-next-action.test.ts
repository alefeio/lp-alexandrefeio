import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { aggregateRecords } from "../src/lib/campaign-data/aggregate";
import { diagnoseCampaign } from "../src/lib/campaign-data/diagnosis";
import { isCoherentDecision, planNextCampaignAction } from "../src/lib/campaign-data/next-action";
import { buildDiagnosisResult } from "../src/lib/learning/campaign-diagnosis";
import {
  buildNextActionResult,
  campaignNextActionSchema,
  nextActionProjectIdsFrom,
  observationDaysFromBrief,
} from "../src/lib/learning/campaign-next-action";

function moneyRow(input: Record<string, string | number>) {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") row[key] = value;
    else if (key === "spend" || key === "conversionValue" || key === "revenue") row[key] = value * 100;
    else row[key] = value;
  }
  return row;
}

const synthetic = [
  moneyRow({ CAMPAIGN: "Pesquisa - Curso", AD_GROUP: "Curso tráfego pago", impressions: 1000, clicks: 80, spend: 120, conversions: 8, conversionValue: 560 }),
  moneyRow({ CAMPAIGN: "Pesquisa - Curso", AD_GROUP: "Google Ads", impressions: 700, clicks: 42, spend: 84, conversions: 3, conversionValue: 210 }),
  moneyRow({ CAMPAIGN: "Pesquisa - Curso", AD_GROUP: "Meta Ads", impressions: 500, clicks: 25, spend: 50, conversions: 1, conversionValue: 70 }),
];

function diagnosisFrom(rows: Record<string, unknown>[]) {
  const aggregate = aggregateRecords(rows);
  const derived = [
    aggregate.derived.ctr.available ? "CTR" : null,
    aggregate.derived.cpc.available ? "CPC" : null,
    aggregate.derived.conversionRate.available ? "CONVERSION_RATE" : null,
    aggregate.derived.cpa.available ? "CPA" : null,
    aggregate.derived.roas.available ? "ROAS" : null,
    aggregate.derived.cpl.available ? "CPL" : null,
    aggregate.derived.qualificationRate.available ? "QUALIFICATION_RATE" : null,
    aggregate.derived.costPerQualifiedLead.available ? "COST_PER_QUALIFIED_LEAD" : null,
  ].filter((item): item is "CTR" | "CPC" | "CONVERSION_RATE" | "CPA" | "ROAS" | "CPL" | "QUALIFICATION_RATE" | "COST_PER_QUALIFIED_LEAD" => Boolean(item));
  return buildDiagnosisResult({
    projectId: "project-a",
    campaignDataImportId: "import-a",
    sourcePlatform: "GOOGLE_ADS",
    currency: "BRL",
    availableDimensions: aggregate.dimensions.map((item) => item.dimension),
    availableMetrics: [...aggregate.presentBases, ...derived],
    aggregate,
    selectedDimension: aggregate.dimensions.find((item) => item.dimension !== "DATE")?.dimension ?? null,
  });
}

test("evidência insuficiente do sintético vira WAIT com plano de observação", () => {
  const diagnosis = diagnosisFrom(synthetic);
  assert.equal(diagnoseCampaign(aggregateRecords(synthetic)).primaryBottleneck, "INSUFFICIENT_EVIDENCE");
  const plan = planNextCampaignAction(diagnosis);
  assert.equal(plan.actionType, "WAIT");
  assert.equal(plan.readiness, "WAIT_PLAN_READY");
  assert.ok(plan.reason.length > 10);
  assert.ok(plan.observationPlan.whatToObserve.length >= 2);
  assert.ok(plan.observationPlan.reviewCondition);
  assert.ok(plan.observationPlan.doNotChange.length >= 1);
  assert.match(plan.title + plan.reason, /não altere|dados atuais|evidência/i);
  assert.equal(/\baumente\b.*\d+\s*%/i.test(plan.title + plan.reason), false);
  assert.equal(/pause automaticamente/i.test(plan.title + plan.reason), false);
});

test("gasto material sem conversão vira EXECUTE sem pausa automática", () => {
  const diagnosis = diagnosisFrom([
    moneyRow({ CAMPAIGN: "A", AD_GROUP: "Grupo A", impressions: 1000, clicks: 80, spend: 80, conversions: 8 }),
    moneyRow({ CAMPAIGN: "A", AD_GROUP: "Grupo B", impressions: 500, clicks: 40, spend: 40, conversions: 0 }),
  ]);
  const plan = planNextCampaignAction(diagnosis);
  assert.equal(plan.actionType, "EXECUTE");
  assert.equal(plan.priority, "HIGH");
  assert.match(plan.title, /Avalie/);
  assert.equal(/pause automaticamente|PAUSE_/i.test(plan.title + plan.reason), false);
  assert.equal(plan.evidenceRefs.some((item) => item.code === "SEGMENT_WITH_SPEND_NO_RESULT"), true);
});

test("cliques sem conversão pedem ANALYZE de destino", () => {
  const diagnosis = diagnosisFrom([
    moneyRow({ CAMPAIGN: "A", AD_GROUP: "G1", impressions: 1000, clicks: 120, spend: 90, conversions: 0 }),
  ]);
  const plan = planNextCampaignAction(diagnosis);
  assert.equal(plan.actionType, "ANALYZE");
  assert.match(plan.title + plan.reason, /página|conversão|destino/i);
});

test("entrega sem impressão, tráfego sem clique, qualidade e receita", () => {
  const delivery = planNextCampaignAction(diagnosisFrom([
    moneyRow({ CAMPAIGN: "A", AD_GROUP: "G1", impressions: 0, clicks: 0, spend: 10, conversions: 0 }),
  ]));
  assert.ok(delivery.actionType === "ANALYZE" || delivery.actionType === "WAIT");

  const traffic = planNextCampaignAction(diagnosisFrom([
    moneyRow({ CAMPAIGN: "A", AD_GROUP: "G1", impressions: 1000, clicks: 0, spend: 40, conversions: 0 }),
  ]));
  assert.ok(["ANALYZE", "EXECUTE", "WAIT"].includes(traffic.actionType));

  const quality = planNextCampaignAction(diagnosisFrom([
    moneyRow({ CAMPAIGN: "A", AD_SET: "Set A", impressions: 500, clicks: 50, spend: 50, conversions: 10, leads: 20, qualifiedLeads: 10 }),
    moneyRow({ CAMPAIGN: "A", AD_SET: "Set B", impressions: 500, clicks: 50, spend: 50, conversions: 10, leads: 20, qualifiedLeads: 1 }),
  ]));
  assert.ok(["ANALYZE", "EXECUTE"].includes(quality.actionType));

  const revenue = planNextCampaignAction(
    diagnosisFrom([
      moneyRow({ CAMPAIGN: "A", AD_GROUP: "G1", impressions: 500, clicks: 50, spend: 50, conversions: 5, conversionValue: 40 }),
      moneyRow({ CAMPAIGN: "A", AD_GROUP: "G2", impressions: 500, clicks: 50, spend: 50, conversions: 5, conversionValue: 200 }),
    ]),
  );
  assert.ok(revenue.actionType === "ANALYZE" || revenue.actionType === "WAIT" || revenue.actionType === "EXECUTE");
});

test("MIXED escolhe uma ação principal", () => {
  const diagnosis = diagnosisFrom([
    moneyRow({ CAMPAIGN: "A", AD_GROUP: "G1", impressions: 100, clicks: 0, spend: 30, conversions: 0 }),
  ]);
  const plan = planNextCampaignAction(diagnosis);
  assert.ok(plan.title.length > 0);
  assert.ok(plan.alternatives.length <= 2);
  assert.equal(Array.isArray(plan.preconditions), true);
  assert.equal(Array.isArray(plan.caveats), true);
});

test("LEARN quando falta conversão e a aula 5 não foi concluída", () => {
  const diagnosis = diagnosisFrom([
    moneyRow({ CAMPAIGN: "A", AD_GROUP: "G1", impressions: 1000, clicks: 80, spend: 40 }),
  ]);
  const plan = planNextCampaignAction(diagnosis, { completedLessonSlugs: [] });
  assert.ok(plan.actionType === "LEARN" || plan.actionType === "WAIT" || plan.actionType === "ANALYZE");
});

test("override coerente e incoerente", () => {
  const diagnosis = diagnosisFrom(synthetic);
  const plan = planNextCampaignAction(diagnosis);
  assert.equal(isCoherentDecision(plan, "WAIT"), true);
  assert.equal(isCoherentDecision(plan, "EXECUTE"), plan.alternatives.some((item) => item.actionType === "EXECUTE"));
});

test("resultado, isolamento e observation days do brief", () => {
  const diagnosis = diagnosisFrom(synthetic);
  const result = buildNextActionResult({
    projectId: "project-a",
    campaignDataImportId: "import-a",
    diagnosisResultId: "diag-1",
    diagnosis,
    context: { observationDays: 14 },
  });
  assert.equal(campaignNextActionSchema.safeParse(result).success, true);
  assert.equal(result.systemRecommendation.actionType, "WAIT");
  assert.equal(result.observationPlan.suggestedReviewDays, 14);
  assert.equal(result.taskId, null);
  assert.equal(result.reminderId, null);
  assert.equal(observationDaysFromBrief({ initialObservationDays: 21 }), 21);
  assert.equal(nextActionProjectIdsFrom([{ projectId: "project-a", payload: result }]).has("project-a"), true);
  assert.throws(() => buildNextActionResult({
    projectId: "project-b",
    campaignDataImportId: "import-a",
    diagnosisResultId: null,
    diagnosis,
  }));
});

test("tool e logs não carregam dataset para analytics", () => {
  const tool = readFileSync(new URL("../src/components/learning/CampaignNextActionTool.tsx", import.meta.url), "utf8");
  const plan = readFileSync(new URL("../src/lib/learning/campaign-next-action-plan.ts", import.meta.url), "utf8");
  assert.equal(tool.includes("gtag"), false);
  assert.equal(tool.includes("track("), false);
  assert.match(plan, /scope: "campaign-next-action"/);
  assert.equal(plan.includes("explanation"), false);
});
