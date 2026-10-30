/**
 * Catálogo versionado de preço de API.
 * Baseline de gpt-6-luna conferido em 2026-10-30 em
 * https://developers.openai.com/api/docs/models/gpt-6-luna
 * Não busque essa URL em runtime. Mudança de preço exige nova pricingVersion.
 * O valor calculado é custo estimado de API baseado no usage retornado pelo provedor, não a fatura do provedor.
 */
export const AI_PRICING_VERSION = "openai-2026-10-30";

/** Micros de dólar por 1 milhão de tokens. 1 USD = 1_000_000 micros. */
const PER_MILLION = BigInt(1_000_000);

type RateCard = {
  input: bigint;
  cachedInput: bigint;
  cacheWrite30m: bigint;
  cacheWrite12h: bigint;
  output: bigint;
};

const GPT_6_LUNA: RateCard = {
  input: BigInt(100_000),
  cachedInput: BigInt(10_000),
  cacheWrite30m: BigInt(125_000),
  cacheWrite12h: BigInt(250_000),
  output: BigInt(500_000),
};

const CATALOG: Record<string, RateCard> = {
  "gpt-6-luna": GPT_6_LUNA,
};

export type AiTokenUsage = {
  inputTokens?: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  cacheWrite30mTokens?: number;
  cacheWrite12hTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
};

export type AiCostEstimate = {
  estimatedCostUsdMicros: number | null;
  pricingVersion: string | null;
};

export function estimateAiProviderCost(modelId: string, usage: AiTokenUsage | undefined): AiCostEstimate {
  const unpriced = { estimatedCostUsdMicros: null, pricingVersion: null };
  if (!usage || usage.inputTokens === undefined || usage.outputTokens === undefined) return unpriced;
  const card = CATALOG[modelId];
  if (!card) return unpriced;
  const writes = resolveWrites(usage);
  if (!writes) return unpriced;
  const cached = usage.cachedInputTokens ?? 0;
  const ordinary = usage.inputTokens - cached - writes.subtract;
  if (ordinary < 0 || cached < 0 || writes.write30 < 0 || writes.write12 < 0 || usage.outputTokens < 0) return unpriced;
  const numerator =
    BigInt(ordinary) * card.input +
    BigInt(cached) * card.cachedInput +
    BigInt(writes.write30) * card.cacheWrite30m +
    BigInt(writes.write12) * card.cacheWrite12h +
    BigInt(usage.outputTokens) * card.output;
  const micros = (numerator + PER_MILLION / BigInt(2)) / PER_MILLION;
  if (micros > BigInt(2_147_483_647)) return unpriced;
  return { estimatedCostUsdMicros: Number(micros), pricingVersion: AI_PRICING_VERSION };
}

function resolveWrites(usage: AiTokenUsage): { subtract: number; write30: number; write12: number } | null {
  const hasAggregate = usage.cacheWriteTokens !== undefined;
  const hasSplit = usage.cacheWrite30mTokens !== undefined || usage.cacheWrite12hTokens !== undefined;
  const write30 = usage.cacheWrite30mTokens ?? 0;
  const write12 = usage.cacheWrite12hTokens ?? 0;
  const splitSum = write30 + write12;
  if (!hasAggregate && !hasSplit) return { subtract: 0, write30: 0, write12: 0 };
  if (!hasAggregate && hasSplit) return { subtract: splitSum, write30, write12 };
  if (hasAggregate && splitSum === usage.cacheWriteTokens) return { subtract: usage.cacheWriteTokens ?? 0, write30, write12 };
  return null;
}
