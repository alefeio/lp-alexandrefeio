import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import {
  cpa,
  conversionRate,
  costPerQualifiedLead,
  cpc,
  cpl,
  ctr,
  metricField,
  qualificationRate,
  roas,
  sumBases,
  type BaseTotals,
  type MetricValue,
} from "@/lib/campaign-data/metrics";
import { BASE_METRICS, DIMENSIONS, type BaseMetricId, type DerivedMetricId, type DimensionId } from "@/lib/campaign-data/types";

const MONEY = new Set<BaseMetricId>(["SPEND", "CONVERSION_VALUE", "REVENUE"]);
const MAX_SEGMENTS = 40;

export type DerivedSnapshot = {
  ctr: MetricValue;
  cpc: MetricValue;
  conversionRate: MetricValue;
  cpa: MetricValue;
  roas: MetricValue;
  cpl: MetricValue;
  qualificationRate: MetricValue;
  costPerQualifiedLead: MetricValue;
};

export type Shares = {
  spendShare: number | null;
  clickShare: number | null;
  conversionShare: number | null;
  valueShare: number | null;
  leadShare: number | null;
  qualifiedLeadShare: number | null;
  revenueShare: number | null;
};

export type SegmentAggregate = {
  key: string;
  totals: BaseTotals;
  derived: DerivedSnapshot;
  shares: Shares;
};

export type DimensionAggregate = {
  dimension: DimensionId;
  segments: SegmentAggregate[];
  truncated: boolean;
};

export type CampaignAggregate = {
  rowCount: number;
  period: { start: string; end: string } | null;
  totals: BaseTotals;
  derived: DerivedSnapshot;
  presentBases: BaseMetricId[];
  dimensions: DimensionAggregate[];
};

export function derivedFrom(totals: BaseTotals): DerivedSnapshot {
  return {
    ctr: ctr(totals),
    cpc: cpc(totals),
    conversionRate: conversionRate(totals),
    cpa: cpa(totals),
    roas: roas(totals),
    cpl: cpl(totals),
    qualificationRate: qualificationRate(totals),
    costPerQualifiedLead: costPerQualifiedLead(totals),
  };
}

function share(part: number | undefined, whole: number | undefined): number | null {
  if (part == null || whole == null || whole === 0) return null;
  return part / whole;
}

export function sharesOf(part: BaseTotals, whole: BaseTotals): Shares {
  return {
    spendShare: share(part.spend, whole.spend),
    clickShare: share(part.clicks, whole.clicks),
    conversionShare: share(part.conversions, whole.conversions),
    valueShare: share(part.conversionValue, whole.conversionValue),
    leadShare: share(part.leads, whole.leads),
    qualifiedLeadShare: share(part.qualifiedLeads, whole.qualifiedLeads),
    revenueShare: share(part.revenue, whole.revenue),
  };
}

function emptyBuckets(): Record<DimensionId, Map<string, BaseTotals>> {
  return Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, new Map<string, BaseTotals>()])) as Record<DimensionId, Map<string, BaseTotals>>;
}

function addTotals(target: BaseTotals, row: BaseTotals) {
  const summed = sumBases([target, row]);
  for (const key of Object.keys(target) as (keyof BaseTotals)[]) delete target[key];
  Object.assign(target, summed);
}

function moneyToCurrency(metric: BaseMetricId, value: number): number {
  return MONEY.has(metric) ? value / 100 : value;
}

export function totalsFromNormalized(record: Record<string, unknown>): { totals: BaseTotals; dimensions: Partial<Record<DimensionId, string>>; date: string | null } {
  const totals: BaseTotals = {};
  const dimensions: Partial<Record<DimensionId, string>> = {};
  for (const metric of BASE_METRICS) {
    const raw = record[metricField(metric)];
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    totals[metricField(metric)] = moneyToCurrency(metric, raw);
  }
  for (const dimension of DIMENSIONS) {
    const raw = record[dimension];
    if (typeof raw !== "string") continue;
    const text = raw.trim();
    if (!text) continue;
    dimensions[dimension] = text.slice(0, 200);
  }
  return { totals, dimensions, date: dimensions.DATE ?? null };
}

export function aggregateRecords(records: Record<string, unknown>[]): CampaignAggregate {
  const state = createAggregateState();
  for (const record of records) absorbRecord(state, record);
  return finish(state);
}

export async function aggregateCampaignBytes(bytes: Uint8Array): Promise<CampaignAggregate> {
  const state = createAggregateState();
  await forEachNormalizedLine(bytes, (line) => {
    const parsed = JSON.parse(line) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) absorbRecord(state, parsed as Record<string, unknown>);
  });
  return finish(state);
}

type AggregateState = {
  overall: BaseTotals;
  buckets: Record<DimensionId, Map<string, BaseTotals>>;
  present: Set<BaseMetricId>;
  start: string | null;
  end: string | null;
  rowCount: number;
};

function createAggregateState(): AggregateState {
  return { overall: {}, buckets: emptyBuckets(), present: new Set(), start: null, end: null, rowCount: 0 };
}

function absorbRecord(state: AggregateState, record: Record<string, unknown>) {
  const parsed = totalsFromNormalized(record);
  if (Object.keys(parsed.totals).length === 0 && Object.keys(parsed.dimensions).length === 0) return;
  state.rowCount += 1;
  addTotals(state.overall, parsed.totals);
  for (const metric of BASE_METRICS) {
    if (parsed.totals[metricField(metric)] != null) state.present.add(metric);
  }
  if (parsed.date) {
    state.start = state.start == null || parsed.date < state.start ? parsed.date : state.start;
    state.end = state.end == null || parsed.date > state.end ? parsed.date : state.end;
  }
  for (const dimension of DIMENSIONS) {
    const key = parsed.dimensions[dimension];
    if (!key) continue;
    const bucket = state.buckets[dimension];
    const current = bucket.get(key) ?? {};
    addTotals(current, parsed.totals);
    bucket.set(key, current);
  }
}

async function forEachNormalizedLine(bytes: Uint8Array, onLine: (line: string) => void) {
  const gunzip = createGunzip();
  const source = Readable.from(Buffer.from(bytes));
  let pending = "";
  for await (const chunk of source.pipe(gunzip)) {
    pending += Buffer.from(chunk).toString("utf8");
    let newline = pending.indexOf("\n");
    while (newline >= 0) {
      const line = pending.slice(0, newline).trim();
      pending = pending.slice(newline + 1);
      if (line) onLine(line);
      newline = pending.indexOf("\n");
    }
  }
  if (pending.trim()) onLine(pending.trim());
}

function finish(state: AggregateState): CampaignAggregate {
  const { rowCount, overall, present, buckets, start, end } = state;
  const dimensions: DimensionAggregate[] = [];
  for (const dimension of DIMENSIONS) {
    const entries = [...buckets[dimension].entries()];
    if (entries.length === 0) continue;
    entries.sort((left, right) => (right[1].spend ?? 0) - (left[1].spend ?? 0) || left[0].localeCompare(right[0]));
    dimensions.push({
      dimension,
      truncated: entries.length > MAX_SEGMENTS,
      segments: entries.slice(0, MAX_SEGMENTS).map(([key, totals]) => ({
        key,
        totals,
        derived: derivedFrom(totals),
        shares: sharesOf(totals, overall),
      })),
    });
  }
  return {
    rowCount,
    period: start && end ? { start, end } : null,
    totals: overall,
    derived: derivedFrom(overall),
    presentBases: BASE_METRICS.filter((metric) => present.has(metric)),
    dimensions,
  };
}

export function dimensionAggregate(aggregate: CampaignAggregate, dimension: DimensionId): DimensionAggregate | null {
  return aggregate.dimensions.find((item) => item.dimension === dimension) ?? null;
}

export const PRESENTATION_METRICS: Array<BaseMetricId | DerivedMetricId> = [
  "IMPRESSIONS",
  "CLICKS",
  "SPEND",
  "CONVERSIONS",
  "CONVERSION_VALUE",
  "LEADS",
  "QUALIFIED_LEADS",
  "SALES",
  "REVENUE",
  "CTR",
  "CPC",
  "CONVERSION_RATE",
  "CPA",
  "ROAS",
  "CPL",
  "QUALIFICATION_RATE",
  "COST_PER_QUALIFIED_LEAD",
];
