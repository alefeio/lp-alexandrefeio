import { receivedRevenueCents, type PaymentRevenueStatus } from "@/lib/admin/operations";

export const AI_ECONOMICS_PERIODS = ["7", "30", "90", "all"] as const;
export type AiEconomicsPeriod = (typeof AI_ECONOMICS_PERIODS)[number];

export const AI_ECONOMICS_PERIOD_LABEL: Record<AiEconomicsPeriod, string> = {
  "7": "7 dias",
  "30": "30 dias",
  "90": "90 dias",
  all: "Todo o período",
};

export const AI_ECONOMICS_EMPTY = "Ainda não há chamadas de IA registradas neste período.";
export const AI_ECONOMICS_COST_NOTE = "Estimativa baseada no usage retornado pelo provedor. Não representa a fatura da OpenAI.";
export const AI_ECONOMICS_CURRENCY_NOTE =
  "Custos de IA estão em USD e receita operacional em BRL. Esta versão não aplica câmbio e não calcula margem entre essas grandezas.";
export const AI_ECONOMICS_MISSING = "Não informado";

const FEATURE_LABELS: Record<string, string> = {
  landing_page_copy: "Copy da landing page",
  blog_coverage: "Blog · cobertura",
  blog_next: "Blog · próxima pauta",
  blog_trends: "Blog · tendências",
  blog_titles: "Blog · títulos",
  blog_outline: "Blog · estrutura",
  blog_draft: "Blog · rascunho",
  blog_review: "Blog · revisão",
  blog_seo: "Blog · SEO",
};

const BELEM_OFFSET_MS = 3 * 60 * 60 * 1000;
const USD_MICROS = 1_000_000;

export type AiEconomicsCall = {
  requestId: string;
  featureKey: string;
  providerId: string;
  modelId: string;
  serviceTier: string | null;
  promptVersion: string | null;
  operationType: string | null;
  status: string;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  webSearchCalls: number | null;
  estimatedModelCostUsdMicros: number | null;
  estimatedToolCostUsdMicros: number | null;
  estimatedCostUsdMicros: number | null;
  pricingVersion: string | null;
  latencyMs: number | null;
  createdAt: Date;
};

export type AiEconomicsPayment = {
  status: PaymentRevenueStatus;
  amountCents: number;
  refundedAmountCents: number;
  approvedAt: Date | null;
  createdAt: Date;
};

export type AiEconomicsWindow = { start: Date | null; end: Date };

export function parseAiEconomicsPeriod(raw: string | undefined): AiEconomicsPeriod {
  return raw === "7" || raw === "30" || raw === "90" || raw === "all" ? raw : "30";
}

export function aiEconomicsWindow(period: AiEconomicsPeriod, now: Date): AiEconomicsWindow {
  if (period === "all") return { start: null, end: now };
  return { start: new Date(now.getTime() - Number(period) * 24 * 60 * 60 * 1000), end: now };
}

export function inAiEconomicsWindow(value: Date, window: AiEconomicsWindow): boolean {
  const time = value.getTime();
  if (time >= window.end.getTime()) return false;
  if (window.start && time < window.start.getTime()) return false;
  return true;
}

export function aiEconomicsHref(period: AiEconomicsPeriod): string {
  return period === "30" ? "/admin/ia" : `/admin/ia?periodo=${period}`;
}

export function featureLabel(featureKey: string): string {
  return FEATURE_LABELS[featureKey] ?? featureKey;
}

export function formatUsdMicros(micros: number | null): string {
  if (micros == null) return "—";
  if (micros === 0) return "US$ 0,00";
  const negative = micros < 0;
  const absolute = Math.abs(micros);
  const body = absolute >= 10_000 ? formatUsdFromCents(absolute) : formatUsdSubcent(absolute);
  return `${negative ? "-" : ""}US$ ${body}`;
}

function formatUsdFromCents(absoluteMicros: number): string {
  const cents = Math.round(absoluteMicros / 10_000);
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole.toLocaleString("pt-BR")},${fraction}`;
}

function formatUsdSubcent(absoluteMicros: number): string {
  const digits = String(Math.trunc(absoluteMicros)).padStart(6, "0").replace(/0+$/, "");
  return `0,${digits}`;
}

export function formatCoverage(ratio: number | null): string {
  if (ratio == null) return "—";
  const text = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(ratio * 100);
  return `${text}% das provider calls registradas`;
}

export function formatKnownCount(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR");
}

export function economicsRevenueCents(payments: AiEconomicsPayment[], window: AiEconomicsWindow): number {
  return receivedRevenueCents(payments.filter((payment) => inAiEconomicsWindow(payment.approvedAt ?? payment.createdAt, window)));
}

export function recognizedPaymentCount(payments: AiEconomicsPayment[], window: AiEconomicsWindow): number {
  return payments.filter((payment) => {
    if (payment.status !== "APPROVED" && payment.status !== "PARTIALLY_REFUNDED") return false;
    return inAiEconomicsWindow(payment.approvedAt ?? payment.createdAt, window);
  }).length;
}

export function buildAiEconomicsView(input: {
  period: AiEconomicsPeriod;
  now: Date;
  calls: AiEconomicsCall[];
  payments: AiEconomicsPayment[];
  paidOrders: number;
}) {
  const window = aiEconomicsWindow(input.period, input.now);
  const calls = input.calls.filter((call) => inAiEconomicsWindow(call.createdAt, window));
  const byRequest = new Map<string, AiEconomicsCall[]>();
  for (const call of calls) {
    const group = byRequest.get(call.requestId) ?? [];
    group.push(call);
    byRequest.set(call.requestId, group);
  }

  const logicalActions = byRequest.size;
  const providerCalls = calls.length;
  const pricedCalls = calls.filter((call) => call.estimatedCostUsdMicros != null).length;
  const unpricedCalls = providerCalls - pricedCalls;
  const pricedCostMicros = calls.reduce((sum, call) => sum + (call.estimatedCostUsdMicros ?? 0), 0);
  const coverage = providerCalls > 0 ? pricedCalls / providerCalls : null;

  let fullyPricedActions = 0;
  let fullyPricedCostMicros = 0;
  let incompleteActions = 0;
  for (const group of byRequest.values()) {
    if (group.every((call) => call.estimatedCostUsdMicros != null)) {
      fullyPricedActions += 1;
      fullyPricedCostMicros += group.reduce((sum, call) => sum + (call.estimatedCostUsdMicros ?? 0), 0);
    } else {
      incompleteActions += 1;
    }
  }

  const modelCostMicros = sumKnown(calls.map((call) => call.estimatedModelCostUsdMicros));
  const toolCostMicros = sumKnown(calls.map((call) => call.estimatedToolCostUsdMicros));
  const webSearchCalls = sumKnown(calls.map((call) => call.webSearchCalls));
  const latencies = calls.flatMap((call) => (call.latencyMs == null ? [] : [call.latencyMs]));

  return {
    period: input.period,
    empty: providerCalls === 0,
    summary: {
      logicalActions,
      providerCalls,
      pricedCostMicros,
      pricedCostLabel: formatUsdMicros(pricedCostMicros),
      coverage,
      coverageLabel: formatCoverage(coverage),
      pricedCalls,
      unpricedCalls,
      failedCalls: calls.filter((call) => call.status === "failed").length,
      repairCalls: calls.filter((call) => call.operationType === "repair").length,
      additionalCalls: Math.max(0, providerCalls - logicalActions),
      webSearchCalls,
      webSearchCallsLabel: formatKnownCount(webSearchCalls),
    },
    composition: {
      modelCostLabel: formatUsdMicros(modelCostMicros),
      toolCostLabel: formatUsdMicros(toolCostMicros),
      pricedCostLabel: formatUsdMicros(pricedCostMicros),
      inputTokensLabel: formatKnownCount(sumKnown(calls.map((call) => call.inputTokens))),
      cachedInputTokensLabel: formatKnownCount(sumKnown(calls.map((call) => call.cachedInputTokens))),
      cacheWriteTokensLabel: formatKnownCount(sumKnown(calls.map((call) => call.cacheWriteTokens))),
      outputTokensLabel: formatKnownCount(sumKnown(calls.map((call) => call.outputTokens))),
      totalTokensLabel: formatKnownCount(sumKnown(calls.map((call) => call.totalTokens))),
      webSearchCallsLabel: formatKnownCount(webSearchCalls),
    },
    unit: {
      fullyPricedActions,
      incompleteActions,
      averageMicros: fullyPricedActions > 0 ? Math.round(fullyPricedCostMicros / fullyPricedActions) : null,
      averageLabel: fullyPricedActions > 0 ? formatUsdMicros(Math.round(fullyPricedCostMicros / fullyPricedActions)) : "—",
    },
    features: featureRows(byRequest),
    models: modelRows(calls),
    operation: {
      responded: calls.filter((call) => call.status === "responded").length,
      failed: calls.filter((call) => call.status === "failed").length,
      generate: calls.filter((call) => call.operationType === "generate").length,
      repair: calls.filter((call) => call.operationType === "repair").length,
      additionalCalls: Math.max(0, providerCalls - logicalActions),
      latencyLabel: latencies.length > 0 ? `${formatKnownCount(median(latencies))} ms` : "—",
    },
    days: dayRows(calls, window),
    revenue: {
      cents: economicsRevenueCents(input.payments, window),
      label: formatBrlCents(economicsRevenueCents(input.payments, window)),
      recognizedPayments: recognizedPaymentCount(input.payments, window),
      paidOrders: input.paidOrders,
    },
  };
}

export type AiEconomicsView = ReturnType<typeof buildAiEconomicsView>;

function featureRows(byRequest: Map<string, AiEconomicsCall[]>) {
  const groups = new Map<string, AiEconomicsCall[]>();
  for (const group of byRequest.values()) {
    for (const call of group) {
      const list = groups.get(call.featureKey) ?? [];
      list.push(call);
      groups.set(call.featureKey, list);
    }
  }
  return [...groups.entries()]
    .map(([featureKey, rows]) => {
      const requests = new Set(rows.map((call) => call.requestId));
      const priced = rows.filter((call) => call.estimatedCostUsdMicros != null);
      const pricedCostMicros = priced.reduce((sum, call) => sum + (call.estimatedCostUsdMicros ?? 0), 0);
      const unpriced = rows.length - priced.length;
      return {
        featureKey,
        label: featureLabel(featureKey),
        actions: requests.size,
        providerCalls: rows.length,
        pricedCostMicros,
        pricedCostLabel: formatUsdMicros(pricedCostMicros),
        unpricedCalls: unpriced,
        coverageLabel: formatCoverage(rows.length > 0 ? priced.length / rows.length : null),
        repairs: rows.filter((call) => call.operationType === "repair").length,
        webSearchCallsLabel: formatKnownCount(sumKnown(rows.map((call) => call.webSearchCalls))),
      };
    })
    .sort((left, right) => right.pricedCostMicros - left.pricedCostMicros || left.featureKey.localeCompare(right.featureKey));
}

function modelRows(calls: AiEconomicsCall[]) {
  const groups = new Map<string, AiEconomicsCall[]>();
  for (const call of calls) {
    const key = [call.providerId, call.modelId, call.serviceTier ?? "", call.promptVersion ?? "", call.pricingVersion ?? ""].join("\u0000");
    const list = groups.get(key) ?? [];
    list.push(call);
    groups.set(key, list);
  }
  return [...groups.values()]
    .map((rows) => {
      const sample = rows[0];
      const priced = rows.filter((call) => call.estimatedCostUsdMicros != null);
      const pricedCostMicros = priced.reduce((sum, call) => sum + (call.estimatedCostUsdMicros ?? 0), 0);
      return {
        providerId: sample.providerId,
        modelId: sample.modelId,
        serviceTierLabel: sample.serviceTier ?? AI_ECONOMICS_MISSING,
        promptVersionLabel: sample.promptVersion ?? AI_ECONOMICS_MISSING,
        pricingVersionLabel: sample.pricingVersion ?? AI_ECONOMICS_MISSING,
        providerCalls: rows.length,
        pricedCalls: priced.length,
        unpricedCalls: rows.length - priced.length,
        pricedCostMicros,
        pricedCostLabel: formatUsdMicros(pricedCostMicros),
      };
    })
    .sort((left, right) => right.pricedCostMicros - left.pricedCostMicros || left.providerId.localeCompare(right.providerId) || left.modelId.localeCompare(right.modelId));
}

function dayRows(calls: AiEconomicsCall[], window: AiEconomicsWindow) {
  const buckets = new Map<string, AiEconomicsCall[]>();
  for (const call of calls) {
    const key = belemDayKey(call.createdAt);
    const list = buckets.get(key) ?? [];
    list.push(call);
    buckets.set(key, list);
  }
  return dayKeys(window, calls).map((day) => {
    const rows = buckets.get(day) ?? [];
    const requests = new Set(rows.map((call) => call.requestId));
    const pricedCostMicros = rows.reduce((sum, call) => sum + (call.estimatedCostUsdMicros ?? 0), 0);
    return {
      day,
      dayLabel: dayLabel(day),
      actions: requests.size,
      providerCalls: rows.length,
      pricedCostMicros,
      pricedCostLabel: formatUsdMicros(pricedCostMicros),
      unpricedCalls: rows.filter((call) => call.estimatedCostUsdMicros == null).length,
    };
  });
}

function dayKeys(window: AiEconomicsWindow, calls: AiEconomicsCall[]): string[] {
  if (calls.length === 0) return [];
  const first = window.start ? belemDayKey(window.start) : belemDayKey(calls.reduce((min, call) => (call.createdAt < min ? call.createdAt : min), calls[0].createdAt));
  const lastInstant = new Date(window.end.getTime() - 1);
  const last = belemDayKey(lastInstant);
  if (first > last) return [];
  const keys: string[] = [];
  let cursor = first;
  while (cursor <= last) {
    keys.push(cursor);
    cursor = shiftDay(cursor, 1);
    if (keys.length > 4000) break;
  }
  return keys;
}

export function belemDayKey(value: Date): string {
  const shifted = new Date(value.getTime() - BELEM_OFFSET_MS);
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${month}-${day}`;
}

function shiftDay(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const nextMonth = String(next.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(next.getUTCDate()).padStart(2, "0");
  return `${next.getUTCFullYear()}-${nextMonth}-${nextDay}`;
}

function dayLabel(key: string): string {
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
}

function sumKnown(values: Array<number | null>): number | null {
  let total = 0;
  let seen = false;
  for (const value of values) {
    if (value == null) continue;
    seen = true;
    total += value;
  }
  return seen ? total : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function formatBrlCents(cents: number): string {
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${negative ? "-" : ""}R$ ${whole.toLocaleString("pt-BR")},${fraction}`;
}

export const USD_MICROS_PER_DOLLAR = USD_MICROS;
