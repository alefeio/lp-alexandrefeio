import { z } from "zod";
import { PRESENTATION_METRICS, type CampaignAggregate, type DerivedSnapshot } from "@/lib/campaign-data/aggregate";
import { BOTTLENECKS, EVIDENCE_CODES, EVIDENCE_STRENGTHS, diagnoseCampaign, type CampaignDiagnosis } from "@/lib/campaign-data/diagnosis";
import { fieldLabel } from "@/lib/campaign-data/labels";
import type { BaseTotals } from "@/lib/campaign-data/metrics";
import { BASE_METRICS, DERIVED_METRICS, DIMENSIONS, type BaseMetricId, type DerivedMetricId, type DimensionId } from "@/lib/campaign-data/types";

export const DIAGNOSIS_RESULT_TITLE = "Diagnóstico dos resultados da campanha";

const metricValue = z.number().finite();

export const campaignDiagnosisSchema = z.object({
  version: z.literal(1),
  projectId: z.string().min(1),
  campaignDataImportId: z.string().min(1),
  sourcePlatform: z.enum(["GOOGLE_ADS", "META_ADS", "UNKNOWN"]),
  currency: z.enum(["BRL", "USD", "OTHER"]),
  period: z.object({ start: z.string().nullable(), end: z.string().nullable() }),
  availableDimensions: z.array(z.enum(DIMENSIONS)),
  availableMetrics: z.array(z.enum([...BASE_METRICS, ...DERIVED_METRICS])),
  totals: z.object({
    impressions: metricValue.optional(),
    clicks: metricValue.optional(),
    spend: metricValue.optional(),
    conversions: metricValue.optional(),
    conversionValue: metricValue.optional(),
    leads: metricValue.optional(),
    qualifiedLeads: metricValue.optional(),
    sales: metricValue.optional(),
    revenue: metricValue.optional(),
  }),
  selectedDimension: z.enum(DIMENSIONS).nullable(),
  primaryBottleneck: z.enum(BOTTLENECKS),
  evidenceStrength: z.enum(EVIDENCE_STRENGTHS),
  evidences: z.array(z.object({
    code: z.enum(EVIDENCE_CODES),
    stage: z.enum(BOTTLENECKS),
    strength: z.enum(EVIDENCE_STRENGTHS),
    dimension: z.enum(DIMENSIONS).nullable(),
    entity: z.string().nullable(),
    metrics: z.array(z.string()),
    explanation: z.string(),
  })).max(8),
  caveats: z.array(z.string()).max(20),
  readiness: z.enum(["DIAGNOSIS_READY", "INSUFFICIENT_EVIDENCE"]),
});

export type CampaignDiagnosisResult = z.infer<typeof campaignDiagnosisSchema>;

export function importVisibleTo(
  userId: string,
  projectId: string,
  row: { userId: string; projectId: string; status: string } | null,
): boolean {
  return Boolean(row && row.userId === userId && row.projectId === projectId && row.status === "READY");
}

export function preferredImportId(ids: readonly string[]): string | null {
  return ids.length === 1 ? ids[0] : null;
}

export function priorContextNote(hasPriorPlan: boolean): string | null {
  if (!hasPriorPlan) return null;
  return "Há contexto de aulas anteriores neste projeto. Ele não substitui um número ausente neste arquivo.";
}

export function diagnosisProjectIdsFrom(rows: { projectId: string | null; payload: unknown }[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.projectId && campaignDiagnosisSchema.safeParse(row.payload).success) ids.add(row.projectId);
  }
  return ids;
}

export function buildDiagnosisResult(input: {
  projectId: string;
  campaignDataImportId: string;
  sourcePlatform: "GOOGLE_ADS" | "META_ADS" | "UNKNOWN";
  currency: "BRL" | "USD" | "OTHER";
  availableDimensions: DimensionId[];
  availableMetrics: Array<BaseMetricId | DerivedMetricId>;
  aggregate: CampaignAggregate;
  selectedDimension: DimensionId | null;
}): CampaignDiagnosisResult {
  const diagnosis = diagnoseCampaign(input.aggregate);
  const selected = input.selectedDimension && input.availableDimensions.includes(input.selectedDimension)
    ? input.selectedDimension
    : input.aggregate.dimensions.find((item) => item.dimension !== "DATE")?.dimension ?? null;
  return {
    version: 1,
    projectId: input.projectId,
    campaignDataImportId: input.campaignDataImportId,
    sourcePlatform: input.sourcePlatform,
    currency: input.currency,
    period: { start: input.aggregate.period?.start ?? null, end: input.aggregate.period?.end ?? null },
    availableDimensions: input.availableDimensions,
    availableMetrics: input.availableMetrics,
    totals: compactTotals(input.aggregate.totals),
    selectedDimension: selected,
    primaryBottleneck: diagnosis.primaryBottleneck,
    evidenceStrength: diagnosis.evidenceStrength,
    evidences: diagnosis.evidences,
    caveats: diagnosis.caveats,
    readiness: diagnosis.readiness,
  };
}

function compactTotals(totals: BaseTotals): CampaignDiagnosisResult["totals"] {
  return {
    impressions: totals.impressions,
    clicks: totals.clicks,
    spend: totals.spend,
    conversions: totals.conversions,
    conversionValue: totals.conversionValue,
    leads: totals.leads,
    qualifiedLeads: totals.qualifiedLeads,
    sales: totals.sales,
    revenue: totals.revenue,
  };
}

export type MetricLine = { metric: string; label: string; available: boolean; text: string };

export function metricLines(result: Pick<CampaignDiagnosisResult, "availableMetrics" | "totals" | "currency">, derived: DerivedSnapshot): MetricLine[] {
  const available = new Set(result.availableMetrics);
  return PRESENTATION_METRICS.map((metric) => {
    const present = available.has(metric);
    return { metric, label: displayLabel(metric), available: present, text: present ? formatMetric(metric, result, derived) : "Não disponível neste arquivo." };
  });
}

function displayLabel(metric: string): string {
  if (metric === "SPEND") return "Custo";
  if (metric === "CONVERSION_VALUE") return "Valor de conversão";
  return fieldLabel(metric);
}

function formatMetric(metric: string, result: Pick<CampaignDiagnosisResult, "totals" | "currency">, derived: DerivedSnapshot): string {
  const totals = result.totals;
  if (metric === "IMPRESSIONS") return count(totals.impressions);
  if (metric === "CLICKS") return count(totals.clicks);
  if (metric === "CONVERSIONS") return count(totals.conversions);
  if (metric === "LEADS") return count(totals.leads);
  if (metric === "QUALIFIED_LEADS") return count(totals.qualifiedLeads);
  if (metric === "SALES") return count(totals.sales);
  if (metric === "SPEND") return money(totals.spend, result.currency);
  if (metric === "CONVERSION_VALUE") return money(totals.conversionValue, result.currency);
  if (metric === "REVENUE") return money(totals.revenue, result.currency);
  if (metric === "CTR") return percent(derived.ctr);
  if (metric === "CONVERSION_RATE") return percent(derived.conversionRate);
  if (metric === "QUALIFICATION_RATE") return percent(derived.qualificationRate);
  if (metric === "CPC") return moneyValue(derived.cpc, result.currency);
  if (metric === "CPA") return moneyValue(derived.cpa, result.currency);
  if (metric === "CPL") return moneyValue(derived.cpl, result.currency);
  if (metric === "COST_PER_QUALIFIED_LEAD") return moneyValue(derived.costPerQualifiedLead, result.currency);
  if (metric === "ROAS") return ratio(derived.roas);
  return "Não disponível neste arquivo.";
}

function count(value: number | undefined): string {
  if (value == null) return "Não disponível neste arquivo.";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

function money(value: number | undefined, currency: CampaignDiagnosisResult["currency"]): string {
  if (value == null) return "Não disponível neste arquivo.";
  if (currency === "BRL") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

function percent(value: { available: boolean; value?: number }): string {
  if (!value.available || value.value == null) return "Não disponível neste arquivo.";
  return new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 }).format(value.value);
}

function moneyValue(value: { available: boolean; value?: number }, currency: CampaignDiagnosisResult["currency"]): string {
  if (!value.available || value.value == null) return "Não disponível neste arquivo.";
  return money(value.value, currency);
}

function ratio(value: { available: boolean; value?: number }): string {
  if (!value.available || value.value == null) return "Não disponível neste arquivo.";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value.value);
}

export function diagnosisSummary(diagnosis: CampaignDiagnosis): string {
  return diagnosis.readiness;
}
