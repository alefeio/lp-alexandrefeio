/**
 * Catálogo versionado de preço de API.
 * Baseline de gpt-6-luna conferido em 2026-10-30 em
 * https://developers.openai.com/api/docs/models/gpt-6-luna
 * Não busque essa URL em runtime. Mudança de preço exige nova pricingVersion.
 * O valor calculado é custo estimado de API baseado no usage retornado pelo provedor, não a fatura do provedor.
 */
export const AI_PRICING_VERSION = "openai-2026-11-01-v3";

/** Web search da Responses API: US$ 10 / 1.000 calls, conferido em 2026-11-01. */
export const WEB_SEARCH_USD_MICROS_PER_CALL = 10_000;

/** Acima deste input, a request inteira usa o cartão long-context. O limite em si permanece short-context. */
export const LUNA_LONG_CONTEXT_INPUT_TOKENS = 272_000;

const STANDARD_SERVICE_TIER = "default";

/** Micros de dólar por 1 milhão de tokens. 1 USD = 1_000_000 micros. */
const PER_MILLION = BigInt(1_000_000);

type RateCard = {
  input: bigint;
  cachedInput: bigint;
  cacheWrite30m: bigint;
  cacheWrite12h: bigint;
  output: bigint;
};

const GPT_6_LUNA_SHORT: RateCard = {
  input: BigInt(100_000),
  cachedInput: BigInt(10_000),
  cacheWrite30m: BigInt(125_000),
  cacheWrite12h: BigInt(250_000),
  output: BigInt(500_000),
};

/** 2x input e cache, 1,5x output, para a request inteira. Tabela Standard de 2026-10-30. */
const GPT_6_LUNA_LONG: RateCard = {
  input: BigInt(200_000),
  cachedInput: BigInt(20_000),
  cacheWrite30m: BigInt(250_000),
  cacheWrite12h: BigInt(500_000),
  output: BigInt(750_000),
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
  estimatedModelCostUsdMicros: number | null;
  estimatedToolCostUsdMicros: number | null;
  estimatedCostUsdMicros: number | null;
  pricingVersion: string | null;
};

const INT32_MAX = BigInt(2_147_483_647);

export function estimateAiProviderCost(
  modelId: string,
  usage: AiTokenUsage | undefined,
  serviceTier: string | null | undefined,
  webSearchCalls: number | null = 0,
): AiCostEstimate {
  const model = estimateModelCost(modelId, usage, serviceTier);
  const tool = estimateWebSearchCost(webSearchCalls);
  if (model === null || tool === null) {
    return {
      estimatedModelCostUsdMicros: model,
      estimatedToolCostUsdMicros: tool,
      estimatedCostUsdMicros: null,
      pricingVersion: null,
    };
  }
  const total = BigInt(model) + BigInt(tool);
  if (total > INT32_MAX) {
    return {
      estimatedModelCostUsdMicros: model,
      estimatedToolCostUsdMicros: tool,
      estimatedCostUsdMicros: null,
      pricingVersion: null,
    };
  }
  return {
    estimatedModelCostUsdMicros: model,
    estimatedToolCostUsdMicros: tool,
    estimatedCostUsdMicros: Number(total),
    pricingVersion: AI_PRICING_VERSION,
  };
}

function estimateModelCost(modelId: string, usage: AiTokenUsage | undefined, serviceTier: string | null | undefined): number | null {
  if (serviceTier !== STANDARD_SERVICE_TIER) return null;
  if (!usage || usage.inputTokens === undefined || usage.outputTokens === undefined) return null;
  const card = modelId === "gpt-6-luna"
    ? usage.inputTokens > LUNA_LONG_CONTEXT_INPUT_TOKENS
      ? GPT_6_LUNA_LONG
      : GPT_6_LUNA_SHORT
    : undefined;
  if (!card) return null;
  const writes = resolveWrites(usage);
  if (!writes) return null;
  const cached = usage.cachedInputTokens ?? 0;
  const ordinary = usage.inputTokens - cached - writes.subtract;
  if (ordinary < 0 || cached < 0 || writes.write30 < 0 || writes.write12 < 0 || usage.outputTokens < 0) return null;
  const numerator =
    BigInt(ordinary) * card.input +
    BigInt(cached) * card.cachedInput +
    BigInt(writes.write30) * card.cacheWrite30m +
    BigInt(writes.write12) * card.cacheWrite12h +
    BigInt(usage.outputTokens) * card.output;
  const micros = (numerator + PER_MILLION / BigInt(2)) / PER_MILLION;
  if (micros > INT32_MAX) return null;
  return Number(micros);
}

function estimateWebSearchCost(webSearchCalls: number | null): number | null {
  if (webSearchCalls === null || !Number.isInteger(webSearchCalls) || webSearchCalls < 0) return null;
  const micros = BigInt(webSearchCalls) * BigInt(WEB_SEARCH_USD_MICROS_PER_CALL);
  if (micros > INT32_MAX) return null;
  return Number(micros);
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
