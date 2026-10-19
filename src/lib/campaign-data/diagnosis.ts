import { dimensionAggregate, type CampaignAggregate, type SegmentAggregate } from "@/lib/campaign-data/aggregate";
import { fieldLabel } from "@/lib/campaign-data/labels";
import type { DimensionId } from "@/lib/campaign-data/types";

/**
 * Heurística operacional conservadora.
 * Não é benchmark de mercado e não declara que um número “parece baixo”.
 * Um segmento só gera alerta forte quando representa uma parcela material do gasto
 * e o padrão é estrutural, como gasto sem resultado enquanto outros segmentos converteram.
 */
export const DIAGNOSIS_HEURISTICS = {
  materialSpendShare: 0.2,
  minClicksForRate: 30,
  minSegmentImpressions: 100,
  minConversionsForCostCompare: 3,
  relativeRateFloor: 0.5,
  relativeCostCeiling: 1.8,
  concentrationShare: 0.6,
  maxEvidences: 8,
} as const;

export const BOTTLENECKS = ["DELIVERY", "TRAFFIC", "CONVERSION", "LEAD_QUALITY", "REVENUE", "MIXED", "INSUFFICIENT_EVIDENCE"] as const;
export type Bottleneck = (typeof BOTTLENECKS)[number];

export const EVIDENCE_STRENGTHS = ["STRONG", "MODERATE", "LIMITED"] as const;
export type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number];

export const EVIDENCE_CODES = [
  "NO_DATA",
  "INSUFFICIENT_METRICS",
  "NO_IMPRESSIONS",
  "NO_CLICKS",
  "CLICKS_WITHOUT_CONVERSIONS",
  "SPEND_WITHOUT_CONVERSIONS",
  "CONVERSIONS_WITHOUT_VALUE_DATA",
  "LEADS_WITHOUT_QUALIFICATION_DATA",
  "LOW_RELATIVE_TRAFFIC_EFFICIENCY",
  "LOW_RELATIVE_CONVERSION_EFFICIENCY",
  "HIGH_RELATIVE_COST",
  "LOW_RELATIVE_VALUE_EFFICIENCY",
  "SPEND_CONCENTRATION",
  "RESULT_CONCENTRATION",
  "SEGMENT_WITH_SPEND_NO_RESULT",
  "LOW_RELATIVE_LEAD_QUALITY",
] as const;
export type EvidenceCode = (typeof EVIDENCE_CODES)[number];

export type DiagnosisEvidence = {
  code: EvidenceCode;
  stage: Bottleneck;
  strength: EvidenceStrength;
  dimension: DimensionId | null;
  entity: string | null;
  metrics: string[];
  explanation: string;
};

export type CampaignDiagnosis = {
  primaryBottleneck: Bottleneck;
  evidenceStrength: EvidenceStrength;
  readiness: "DIAGNOSIS_READY" | "INSUFFICIENT_EVIDENCE";
  evidences: DiagnosisEvidence[];
  caveats: string[];
};

const STAGE_RANK: Record<EvidenceStrength, number> = { LIMITED: 1, MODERATE: 2, STRONG: 3 };
const DECISIVE = new Set<EvidenceCode>([
  "NO_IMPRESSIONS",
  "NO_CLICKS",
  "CLICKS_WITHOUT_CONVERSIONS",
  "SPEND_WITHOUT_CONVERSIONS",
  "LOW_RELATIVE_TRAFFIC_EFFICIENCY",
  "LOW_RELATIVE_CONVERSION_EFFICIENCY",
  "HIGH_RELATIVE_COST",
  "LOW_RELATIVE_VALUE_EFFICIENCY",
  "SEGMENT_WITH_SPEND_NO_RESULT",
  "LOW_RELATIVE_LEAD_QUALITY",
]);

export function diagnoseCampaign(aggregate: CampaignAggregate): CampaignDiagnosis {
  const evidences: DiagnosisEvidence[] = [];
  const caveats = caveatsFor(aggregate);
  const totals = aggregate.totals;
  if (aggregate.rowCount === 0) {
    evidences.push(evidence("NO_DATA", "INSUFFICIENT_EVIDENCE", "LIMITED", null, null, [], "Este arquivo não tem linhas utilizáveis."));
  }
  const hasImpressions = totals.impressions != null;
  const hasClicks = totals.clicks != null;
  const hasConversions = totals.conversions != null;
  const hasSpend = totals.spend != null;
  const hasLeads = totals.leads != null;
  const hasQualified = totals.qualifiedLeads != null;
  const hasValue = totals.conversionValue != null || totals.revenue != null;

  if (aggregate.presentBases.length <= 1 && aggregate.rowCount > 0) {
    evidences.push(evidence("INSUFFICIENT_METRICS", "INSUFFICIENT_EVIDENCE", "LIMITED", null, null, aggregate.presentBases, "O arquivo traz poucas métricas para localizar um estágio do funil."));
  }
  if (hasImpressions && totals.impressions === 0) {
    evidences.push(evidence("NO_IMPRESSIONS", "DELIVERY", "STRONG", null, null, ["IMPRESSIONS"], "Há um sinal de entrega: as impressões deste arquivo somam zero. Isso não diz a causa."));
  }
  if (hasImpressions && (totals.impressions ?? 0) > 0 && hasClicks && totals.clicks === 0) {
    evidences.push(evidence("NO_CLICKS", "TRAFFIC", "STRONG", null, null, ["IMPRESSIONS", "CLICKS"], "Há impressões e nenhum clique. O sinal está na passagem para o tráfego, não em uma taxa isolada."));
  }
  if (hasClicks && (totals.clicks ?? 0) > 0 && hasConversions && totals.conversions === 0) {
    evidences.push(evidence("CLICKS_WITHOUT_CONVERSIONS", "CONVERSION", "STRONG", null, null, ["CLICKS", "CONVERSIONS"], "Há cliques e nenhuma conversão registrada neste arquivo. O sinal está na conversão."));
  }
  if (hasSpend && (totals.spend ?? 0) > 0 && hasConversions && totals.conversions === 0) {
    evidences.push(evidence("SPEND_WITHOUT_CONVERSIONS", "CONVERSION", "STRONG", null, null, ["SPEND", "CONVERSIONS"], "Há custo e nenhuma conversão registrada. Isso pede investigação. Não indica, sozinho, o que alterar."));
  }
  if (hasConversions && (totals.conversions ?? 0) > 0 && !hasValue) {
    evidences.push(evidence("CONVERSIONS_WITHOUT_VALUE_DATA", "REVENUE", "LIMITED", null, null, ["CONVERSIONS"], "Há conversões, mas este arquivo não traz valor de conversão nem receita."));
  }
  if (hasLeads && (totals.leads ?? 0) > 0 && !hasQualified) {
    evidences.push(evidence("LEADS_WITHOUT_QUALIFICATION_DATA", "LEAD_QUALITY", "LIMITED", null, null, ["LEADS"], "Há leads, mas não há leads qualificados neste arquivo. A qualidade não pode ser inferida pelo CPA."));
  }

  for (const dimension of aggregate.dimensions) {
    if (dimension.dimension === "DATE") continue;
    const all = uncappedSegments(aggregate, dimension.dimension);
    if (all.length < 2) continue;
    const overallCtr = aggregate.derived.ctr.available ? aggregate.derived.ctr.value : null;
    const overallCvr = aggregate.derived.conversionRate.available ? aggregate.derived.conversionRate.value : null;
    const overallCpa = aggregate.derived.cpa.available ? aggregate.derived.cpa.value : null;
    const overallRoas = aggregate.derived.roas.available ? aggregate.derived.roas.value : null;
    const overallQualification = aggregate.derived.qualificationRate.available ? aggregate.derived.qualificationRate.value : null;
    for (const segment of all) {
      const spendShare = segment.shares.spendShare ?? 0;
      const material = spendShare >= DIAGNOSIS_HEURISTICS.materialSpendShare;
      if (material && hasConversions && (totals.conversions ?? 0) > 0 && segment.totals.conversions === 0) {
        evidences.push(evidence(
          "SEGMENT_WITH_SPEND_NO_RESULT",
          "CONVERSION",
          "STRONG",
          dimension.dimension,
          segment.key,
          ["SPEND", "CONVERSIONS"],
          `Há um sinal de que “${segment.key}” concentrou ${percent(spendShare)} do custo e não registrou conversão, enquanto outros segmentos deste arquivo registraram. Este segmento merece investigação.`,
        ));
      }
      if (
        material &&
        overallCtr != null &&
        segment.derived.ctr.available &&
        (segment.totals.impressions ?? 0) >= DIAGNOSIS_HEURISTICS.minSegmentImpressions &&
        segment.derived.ctr.value < overallCtr * DIAGNOSIS_HEURISTICS.relativeRateFloor
      ) {
        evidences.push(evidence(
          "LOW_RELATIVE_TRAFFIC_EFFICIENCY",
          "TRAFFIC",
          "MODERATE",
          dimension.dimension,
          segment.key,
          ["IMPRESSIONS", "CLICKS"],
          `“${segment.key}” teve uma taxa de cliques claramente menor que a do arquivo inteiro, com volume material. Os dados sugerem olhar a passagem de impressão para clique nesse segmento.`,
        ));
      }
      if (
        material &&
        overallCvr != null &&
        segment.derived.conversionRate.available &&
        (segment.totals.clicks ?? 0) >= DIAGNOSIS_HEURISTICS.minClicksForRate &&
        segment.derived.conversionRate.value < overallCvr * DIAGNOSIS_HEURISTICS.relativeRateFloor
      ) {
        evidences.push(evidence(
          "LOW_RELATIVE_CONVERSION_EFFICIENCY",
          "CONVERSION",
          "MODERATE",
          dimension.dimension,
          segment.key,
          ["CLICKS", "CONVERSIONS"],
          `“${segment.key}” converteu numa taxa bem menor que a do arquivo inteiro, com cliques e custo materiais. Isso é um sinal de conversão, não uma ordem para pausar.`,
        ));
      }
      if (
        material &&
        overallCpa != null &&
        segment.derived.cpa.available &&
        (segment.totals.conversions ?? 0) >= DIAGNOSIS_HEURISTICS.minConversionsForCostCompare &&
        (totals.conversions ?? 0) >= DIAGNOSIS_HEURISTICS.minConversionsForCostCompare &&
        segment.derived.cpa.value > overallCpa * DIAGNOSIS_HEURISTICS.relativeCostCeiling
      ) {
        evidences.push(evidence(
          "HIGH_RELATIVE_COST",
          "CONVERSION",
          "MODERATE",
          dimension.dimension,
          segment.key,
          ["SPEND", "CONVERSIONS"],
          `“${segment.key}” teve um custo por conversão bem maior que o do arquivo inteiro. O número só se compara com os outros segmentos deste arquivo.`,
        ));
      }
      if (
        material &&
        overallRoas != null &&
        segment.derived.roas.available &&
        segment.derived.roas.value < overallRoas * DIAGNOSIS_HEURISTICS.relativeRateFloor
      ) {
        evidences.push(evidence(
          "LOW_RELATIVE_VALUE_EFFICIENCY",
          "REVENUE",
          "MODERATE",
          dimension.dimension,
          segment.key,
          ["SPEND", "CONVERSION_VALUE"],
          `“${segment.key}” devolveu menos valor por real investido do que o arquivo inteiro. Isso não significa prejuízo: o ROAS não conhece margem, imposto nem custo operacional.`,
        ));
      }
      if (
        material &&
        overallQualification != null &&
        segment.derived.qualificationRate.available &&
        (segment.totals.leads ?? 0) >= 5 &&
        segment.derived.qualificationRate.value < overallQualification * DIAGNOSIS_HEURISTICS.relativeRateFloor
      ) {
        evidences.push(evidence(
          "LOW_RELATIVE_LEAD_QUALITY",
          "LEAD_QUALITY",
          "MODERATE",
          dimension.dimension,
          segment.key,
          ["LEADS", "QUALIFIED_LEADS"],
          `“${segment.key}” qualificou uma parcela menor dos leads do que o arquivo inteiro. A comparação usa lead e lead qualificado, não o CPA.`,
        ));
      }
    }
    const topSpend = [...all].sort((left, right) => (right.shares.spendShare ?? 0) - (left.shares.spendShare ?? 0))[0];
    if (topSpend && (topSpend.shares.spendShare ?? 0) >= DIAGNOSIS_HEURISTICS.concentrationShare) {
      evidences.push(evidence(
        "SPEND_CONCENTRATION",
        "INSUFFICIENT_EVIDENCE",
        "LIMITED",
        dimension.dimension,
        topSpend.key,
        ["SPEND"],
        `“${topSpend.key}” concentrou ${percent(topSpend.shares.spendShare ?? 0)} do custo deste arquivo. Concentração, sozinha, não é um gargalo.`,
      ));
    }
    const topResult = [...all].sort((left, right) => (right.shares.conversionShare ?? 0) - (left.shares.conversionShare ?? 0))[0];
    if (topResult && (topResult.shares.conversionShare ?? 0) >= DIAGNOSIS_HEURISTICS.concentrationShare && hasConversions) {
      evidences.push(evidence(
        "RESULT_CONCENTRATION",
        "INSUFFICIENT_EVIDENCE",
        "LIMITED",
        dimension.dimension,
        topResult.key,
        ["CONVERSIONS"],
        `“${topResult.key}” concentrou ${percent(topResult.shares.conversionShare ?? 0)} das conversões. Isso mostra onde o resultado apareceu, não o que mudar.`,
      ));
    }
  }

  const ranked = evidences
    .filter((item) => DECISIVE.has(item.code))
    .sort((left, right) => STAGE_RANK[right.strength] - STAGE_RANK[left.strength]);
  const chosen = chooseBottleneck(ranked);
  return {
    primaryBottleneck: chosen.bottleneck,
    evidenceStrength: chosen.strength,
    readiness: chosen.bottleneck === "INSUFFICIENT_EVIDENCE" ? "INSUFFICIENT_EVIDENCE" : "DIAGNOSIS_READY",
    evidences: evidences.slice(0, DIAGNOSIS_HEURISTICS.maxEvidences),
    caveats,
  };
}

function uncappedSegments(aggregate: CampaignAggregate, dimension: DimensionId): SegmentAggregate[] {
  return dimensionAggregate(aggregate, dimension)?.segments ?? [];
}

function chooseBottleneck(evidences: DiagnosisEvidence[]): { bottleneck: Bottleneck; strength: EvidenceStrength } {
  const stages = new Map<Bottleneck, number>();
  for (const item of evidences) {
    if (item.stage === "INSUFFICIENT_EVIDENCE" || item.stage === "MIXED") continue;
    if (item.strength === "LIMITED") continue;
    stages.set(item.stage, Math.max(stages.get(item.stage) ?? 0, STAGE_RANK[item.strength]));
  }
  const ranked = [...stages.entries()].sort((left, right) => right[1] - left[1]);
  if (ranked.length === 0) return { bottleneck: "INSUFFICIENT_EVIDENCE", strength: "LIMITED" };
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return { bottleneck: "MIXED", strength: "MODERATE" };
  const strength = ranked[0][1] >= 3 ? "STRONG" : "MODERATE";
  return { bottleneck: ranked[0][0], strength };
}

function caveatsFor(aggregate: CampaignAggregate): string[] {
  const caveats: string[] = [];
  const present = new Set(aggregate.presentBases);
  if (!aggregate.period) caveats.push("Este arquivo não informa o período.");
  if (!present.has("LEADS")) caveats.push("Este arquivo não possui leads.");
  if (!present.has("QUALIFIED_LEADS")) caveats.push("Não há dados de leads qualificados.");
  if (!present.has("REVENUE") && !present.has("CONVERSION_VALUE")) caveats.push("Este arquivo não possui receita nem valor de conversão.");
  else if (!present.has("REVENUE")) caveats.push("Este arquivo não possui receita. O valor de conversão não é lucro.");
  if (present.has("CONVERSION_VALUE") || present.has("REVENUE")) caveats.push("ROAS não representa lucro. Ele não conhece margem, imposto nem custo operacional.");
  const campaigns = dimensionAggregate(aggregate, "CAMPAIGN");
  if (campaigns && campaigns.segments.length === 1) caveats.push("Só existe uma campanha no arquivo.");
  if (!aggregate.dimensions.some((item) => item.dimension === "AD")) caveats.push("Não há comparação por anúncio.");
  const dates = dimensionAggregate(aggregate, "DATE");
  if (dates && dates.segments.length > 0 && dates.segments.length < 7) caveats.push("Há poucas datas para tratar uma variação como tendência.");
  return [...new Set(caveats)];
}

function evidence(
  code: EvidenceCode,
  stage: Bottleneck,
  strength: EvidenceStrength,
  dimension: DimensionId | null,
  entity: string | null,
  metrics: string[],
  explanation: string,
): DiagnosisEvidence {
  return { code, stage, strength, dimension, entity, metrics, explanation };
}

function percent(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value * 100)}%`;
}

export function bottleneckLabel(bottleneck: Bottleneck): string {
  switch (bottleneck) {
    case "DELIVERY":
      return "Entrega";
    case "TRAFFIC":
      return "Tráfego";
    case "CONVERSION":
      return "Conversão";
    case "LEAD_QUALITY":
      return "Qualidade do lead";
    case "REVENUE":
      return "Receita";
    case "MIXED":
      return "Mais de um estágio";
    default:
      return "Evidência insuficiente";
  }
}

export function metricAvailableLabel(metric: string, available: boolean): string {
  return available ? fieldLabel(metric) : "Não disponível neste arquivo.";
}
