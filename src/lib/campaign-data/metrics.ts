import type { BaseMetricId, DerivedMetricId, DimensionId } from "@/lib/campaign-data/types";

export type BaseTotals = Partial<Record<LowerMetric, number>>;

type LowerMetric =
  | "impressions"
  | "clicks"
  | "spend"
  | "conversions"
  | "conversionValue"
  | "leads"
  | "qualifiedLeads"
  | "sales"
  | "revenue";

const FIELD: Record<BaseMetricId, LowerMetric> = {
  IMPRESSIONS: "impressions",
  CLICKS: "clicks",
  SPEND: "spend",
  CONVERSIONS: "conversions",
  CONVERSION_VALUE: "conversionValue",
  LEADS: "leads",
  QUALIFIED_LEADS: "qualifiedLeads",
  SALES: "sales",
  REVENUE: "revenue",
};

export type MetricValue = { available: true; value: number } | { available: false; missingFields: string[] };

function missing(totals: BaseTotals, fields: LowerMetric[]): string[] {
  return fields.filter((field) => totals[field] == null).map((field) => field.replace(/[A-Z]/g, (char) => `_${char}`).toUpperCase());
}

function ratio(totals: BaseTotals, numerator: LowerMetric, denominator: LowerMetric): MetricValue {
  if (totals[numerator] == null || totals[denominator] == null) {
    return { available: false, missingFields: missing(totals, [numerator, denominator]) };
  }
  if (totals[denominator] === 0) {
    return { available: false, missingFields: [denominator.replace(/[A-Z]/g, (char) => `_${char}`).toUpperCase()] };
  }
  return { available: true, value: totals[numerator]! / totals[denominator]! };
}

export function ctr(totals: BaseTotals): MetricValue {
  return ratio(totals, "clicks", "impressions");
}

export function cpc(totals: BaseTotals): MetricValue {
  return ratio(totals, "spend", "clicks");
}

export function conversionRate(totals: BaseTotals): MetricValue {
  return ratio(totals, "conversions", "clicks");
}

export function cpa(totals: BaseTotals): MetricValue {
  return ratio(totals, "spend", "conversions");
}

export function roas(totals: BaseTotals): MetricValue {
  const valueField: LowerMetric | null = totals.conversionValue != null ? "conversionValue" : totals.revenue != null ? "revenue" : null;
  if (!valueField || totals.spend == null) {
    return { available: false, missingFields: missing(totals, valueField ? [valueField, "spend"] : ["conversionValue", "revenue", "spend"]) };
  }
  if (totals.spend === 0) return { available: false, missingFields: ["SPEND"] };
  return { available: true, value: totals[valueField]! / totals.spend };
}

export function cpl(totals: BaseTotals): MetricValue {
  return ratio(totals, "spend", "leads");
}

export function qualificationRate(totals: BaseTotals): MetricValue {
  return ratio(totals, "qualifiedLeads", "leads");
}

export function costPerQualifiedLead(totals: BaseTotals): MetricValue {
  return ratio(totals, "spend", "qualifiedLeads");
}

export function sumBases(rows: BaseTotals[]): BaseTotals {
  const totals: BaseTotals = {};
  for (const row of rows) {
    for (const key of Object.keys(row) as LowerMetric[]) {
      const value = row[key];
      if (value == null || !Number.isFinite(value)) continue;
      totals[key] = (totals[key] ?? 0) + value;
    }
  }
  return totals;
}

export function availableFromColumns(metrics: readonly BaseMetricId[]): Array<BaseMetricId | DerivedMetricId> {
  const present = new Set(metrics);
  const derived: DerivedMetricId[] = [];
  if (present.has("IMPRESSIONS") && present.has("CLICKS")) derived.push("CTR");
  if (present.has("SPEND") && present.has("CLICKS")) derived.push("CPC");
  if (present.has("CONVERSIONS") && present.has("CLICKS")) derived.push("CONVERSION_RATE");
  if (present.has("SPEND") && present.has("CONVERSIONS")) derived.push("CPA");
  if (present.has("SPEND") && (present.has("CONVERSION_VALUE") || present.has("REVENUE"))) derived.push("ROAS");
  if (present.has("SPEND") && present.has("LEADS")) derived.push("CPL");
  if (present.has("QUALIFIED_LEADS") && present.has("LEADS")) derived.push("QUALIFICATION_RATE");
  if (present.has("SPEND") && present.has("QUALIFIED_LEADS")) derived.push("COST_PER_QUALIFIED_LEAD");
  return [...metrics, ...derived];
}

export function metricField(metric: BaseMetricId): LowerMetric {
  return FIELD[metric];
}

export function isDimension(value: string): value is DimensionId {
  return [
    "DATE",
    "CAMPAIGN",
    "AD_GROUP",
    "AD_SET",
    "AD",
    "KEYWORD",
    "SEARCH_TERM",
    "PLACEMENT",
    "DEVICE",
    "NETWORK",
  ].includes(value);
}
