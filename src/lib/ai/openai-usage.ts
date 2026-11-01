import type { AiTokenUsage } from "@/lib/ai/pricing";

function readCount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return undefined;
  return value;
}

function writeDetails(inputRecord: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const details = inputRecord?.cache_write_tokens_details;
  if (!details || typeof details !== "object") return undefined;
  return details as Record<string, unknown>;
}

/** Lê o usage oficial da Responses API. Não guarda o corpo da resposta. */
export function readOpenAIUsage(response: unknown): AiTokenUsage | undefined {
  if (!response || typeof response !== "object" || !("usage" in response)) return undefined;
  const usage = (response as { usage?: Record<string, unknown> }).usage;
  if (!usage) return undefined;
  const inputDetails = usage.input_tokens_details;
  const outputDetails = usage.output_tokens_details;
  const inputRecord = inputDetails && typeof inputDetails === "object" ? (inputDetails as Record<string, unknown>) : undefined;
  const outputRecord = outputDetails && typeof outputDetails === "object" ? (outputDetails as Record<string, unknown>) : undefined;
  const parsed: AiTokenUsage = {
    inputTokens: readCount(usage.input_tokens),
    outputTokens: readCount(usage.output_tokens),
    cachedInputTokens: readCount(inputRecord?.cached_tokens),
    cacheWriteTokens: readCount(inputRecord?.cache_write_tokens),
    cacheWrite30mTokens: readCount(writeDetails(inputRecord)?.ttl_30m_tokens),
    cacheWrite12hTokens: readCount(writeDetails(inputRecord)?.ttl_12h_tokens),
    reasoningTokens: readCount(outputRecord?.reasoning_tokens),
    totalTokens: readCount(usage.total_tokens),
  };
  if (Object.values(parsed).every((value) => value === undefined)) return undefined;
  return Object.fromEntries(Object.entries(parsed).filter((entry) => entry[1] !== undefined)) as AiTokenUsage;
}

export function readOpenAIServiceTier(response: unknown): string | undefined {
  if (!response || typeof response !== "object" || !("service_tier" in response)) return undefined;
  const tier = (response as { service_tier?: unknown }).service_tier;
  if (typeof tier !== "string") return undefined;
  const trimmed = tier.trim();
  return /^[a-z0-9_-]{1,32}$/i.test(trimmed) ? trimmed : undefined;
}

export function readOpenAIResponseId(response: unknown): string | undefined {
  if (!response || typeof response !== "object" || !("id" in response)) return undefined;
  const id = (response as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id : undefined;
}

export function readOpenAIModel(response: unknown, fallback: string): string {
  if (!response || typeof response !== "object" || !("model" in response)) return fallback;
  const model = (response as { model?: unknown }).model;
  return typeof model === "string" && model.trim() ? model.trim() : fallback;
}

/** Conta chamadas de web search. Não lê query, URL nem conteúdo. */
export function countOpenAIWebSearchCalls(response: unknown): number {
  if (!response || typeof response !== "object") return 0;
  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) return 0;
  return output.filter((item) => item && typeof item === "object" && (item as { type?: unknown }).type === "web_search_call").length;
}
