/** Métricas operacionais de idempotência. Não são chamadas cobradas nem economia financeira. */

export const AI_IDEMPOTENCY_METRIC_NAMES = [
  "authorized",
  "duplicate_blocked",
  "in_progress",
  "fingerprint_conflict",
  "unknown_blocked",
  "store_failure",
  "missing_key",
  "completed",
  "failed",
  "unknown_marked",
  "reclaimed",
] as const;

export type AiIdempotencyMetricName = (typeof AI_IDEMPOTENCY_METRIC_NAMES)[number];

const counters: Record<AiIdempotencyMetricName, number> = {
  authorized: 0,
  duplicate_blocked: 0,
  in_progress: 0,
  fingerprint_conflict: 0,
  unknown_blocked: 0,
  store_failure: 0,
  missing_key: 0,
  completed: 0,
  failed: 0,
  unknown_marked: 0,
  reclaimed: 0,
};

export function recordAiIdempotencyMetric(name: AiIdempotencyMetricName, detail?: Record<string, string>) {
  counters[name] += 1;
  console.info("[ai-idempotency]", { metric: name, ...(detail ?? {}) });
}

export function readAiIdempotencyMetrics(): Record<AiIdempotencyMetricName, number> {
  return { ...counters };
}

export function resetAiIdempotencyMetrics() {
  for (const name of AI_IDEMPOTENCY_METRIC_NAMES) counters[name] = 0;
}
