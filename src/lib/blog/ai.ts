import OpenAI from "openai";
import { persistLedgerDraft, type AiLedgerWriter, type AiProviderCallDraft } from "@/lib/ai/ledger";
import { countOpenAIWebSearchCalls, readOpenAIModel, readOpenAIResponseId, readOpenAIServiceTier, readOpenAIUsage } from "@/lib/ai/openai-usage";
import { estimateAiProviderCost } from "@/lib/ai/pricing";
import { BLOG_AI_FEATURE_KEYS, buildEditorialRequest, parseEditorialOutput, type BlogAiAction } from "@/lib/blog/ai-request";
import { BLOG_AI_FAILURE } from "@/lib/blog/catalog";
import { acceptSuggestions, acceptTitles, acceptTrendItem, type EditorialSuggestion } from "@/lib/blog/editorial";
import { demoteMarkdownH1 } from "@/lib/blog/rules";
import type { EditorialInventory } from "@/lib/blog/inventory";
import { readOpenAICopyApiKey, resolveCopyModel } from "@/lib/landing-page/copy/config";

type ResponsesClient = {
  responses: { create: (body: unknown, options?: { signal?: AbortSignal }) => Promise<unknown> };
};

export type BlogAiSuccess =
  | { ok: true; action: "coverage"; value: Record<string, unknown> }
  | { ok: true; action: "next"; suggestions: EditorialSuggestion[] }
  | { ok: true; action: "trends"; searchedAt: string; items: ReturnType<typeof acceptTrendItem>[] }
  | { ok: true; action: "titles"; titles: string[] }
  | { ok: true; action: "outline"; sections: unknown[] }
  | { ok: true; action: "draft"; markdown: string }
  | { ok: true; action: "review" | "seo"; value: Record<string, unknown> };

export async function runEditorialAction(input: {
  action: BlogAiAction;
  inventory: EditorialInventory;
  userId: string;
  focus?: Record<string, string>;
  client?: ResponsesClient;
  now?: Date;
  requestId?: string;
  attempt?: number;
  recordProviderCall?: AiLedgerWriter;
  ledgerTimeoutMs?: number;
  onLedgerFailure?: (notice: { requestId: string; attempt: number }) => void;
}): Promise<BlogAiSuccess | { ok: false; message: string }> {
  const now = input.now ?? new Date();
  const requestId = input.requestId ?? crypto.randomUUID();
  const attempt = input.attempt ?? 1;
  const model = resolveCopyModel();
  const record = (draft: AiProviderCallDraft) => persistLedgerDraft(draft, {
    writer: input.recordProviderCall,
    timeoutMs: input.ledgerTimeoutMs,
    onFailure: input.onLedgerFailure,
  });
  try {
    const apiKey = readOpenAICopyApiKey();
    if (!input.client && !apiKey) return { ok: false, message: BLOG_AI_FAILURE };
    const client = input.client ?? defaultClient(apiKey as string);
    const body = buildEditorialRequest({ action: input.action, model, inventory: input.inventory, focus: input.focus });
    const timeout = input.action === "trends" ? 70_000 : 45_000;
    const started = Date.now();
    let response: unknown;
    try {
      response = await client.responses.create(body, { signal: AbortSignal.timeout(timeout) });
    } catch (error) {
      await record(blogDraft({
        requestId,
        attempt,
        action: input.action,
        userId: input.userId,
        modelId: model,
        status: "failed",
        errorCode: "PROVIDER_ERROR",
        latencyMs: Date.now() - started,
      }));
      console.error("blog editorial assist failed", { action: input.action, name: error instanceof Error ? error.name : "Error" });
      return { ok: false, message: BLOG_AI_FAILURE };
    }
    await record(blogDraft({
      requestId,
      attempt,
      action: input.action,
      userId: input.userId,
      modelId: readOpenAIModel(response, model),
      serviceTier: readOpenAIServiceTier(response) ?? null,
      providerResponseId: readOpenAIResponseId(response) ?? null,
      status: "responded",
      usage: readOpenAIUsage(response),
      webSearchCalls: countOpenAIWebSearchCalls(response),
      latencyMs: Date.now() - started,
    }));
    const parsed = parseEditorialOutput(response);
    if (!parsed.ok) return parsed;
    return shape(input.action, parsed.value, input.inventory, now);
  } catch (error) {
    console.error("blog editorial assist failed", { action: input.action, name: error instanceof Error ? error.name : "Error" });
    return { ok: false, message: BLOG_AI_FAILURE };
  }
}

function blogDraft(input: {
  requestId: string;
  attempt: number;
  action: BlogAiAction;
  userId: string;
  modelId: string;
  status: "responded" | "failed";
  errorCode?: string;
  serviceTier?: string | null;
  providerResponseId?: string | null;
  usage?: ReturnType<typeof readOpenAIUsage>;
  webSearchCalls?: number | null;
  latencyMs: number;
}): AiProviderCallDraft {
  const webSearchCalls = input.status === "responded" ? input.webSearchCalls ?? 0 : null;
  const priced = estimateAiProviderCost(input.modelId, input.usage, input.serviceTier, webSearchCalls);
  return {
    requestId: input.requestId,
    attempt: input.attempt,
    featureKey: BLOG_AI_FEATURE_KEYS[input.action],
    providerId: "openai",
    modelId: input.modelId,
    serviceTier: input.serviceTier ?? null,
    providerResponseId: input.providerResponseId ?? null,
    promptVersion: null,
    operationType: input.action,
    sectionType: null,
    userId: input.userId,
    projectId: null,
    courseId: null,
    landingPageProjectId: null,
    status: input.status,
    errorCode: input.errorCode ?? null,
    inputTokens: input.usage?.inputTokens ?? null,
    cachedInputTokens: input.usage?.cachedInputTokens ?? null,
    cacheWriteTokens: input.usage?.cacheWriteTokens ?? null,
    cacheWrite30mTokens: input.usage?.cacheWrite30mTokens ?? null,
    cacheWrite12hTokens: input.usage?.cacheWrite12hTokens ?? null,
    outputTokens: input.usage?.outputTokens ?? null,
    reasoningTokens: input.usage?.reasoningTokens ?? null,
    totalTokens: input.usage?.totalTokens ?? null,
    webSearchCalls,
    estimatedModelCostUsdMicros: priced.estimatedModelCostUsdMicros,
    estimatedToolCostUsdMicros: priced.estimatedToolCostUsdMicros,
    estimatedCostUsdMicros: priced.estimatedCostUsdMicros,
    pricingVersion: priced.pricingVersion,
    latencyMs: input.latencyMs,
  };
}

function shape(action: BlogAiAction, value: unknown, inventory: EditorialInventory, now: Date): BlogAiSuccess | { ok: false; message: string } {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (!row) return { ok: false, message: BLOG_AI_FAILURE };
  if (action === "coverage" || action === "review" || action === "seo") return { ok: true, action, value: row };
  if (action === "next") return { ok: true, action, suggestions: acceptSuggestions(row.suggestions, inventory) };
  if (action === "titles") return { ok: true, action, titles: acceptTitles(row.titles) };
  if (action === "outline") return { ok: true, action, sections: Array.isArray(row.sections) ? row.sections.slice(0, 16) : [] };
  if (action === "draft") return { ok: true, action, markdown: demoteMarkdownH1(typeof row.markdown === "string" ? row.markdown : "") };
  const items = Array.isArray(row.items) ? row.items.map(trendFromUnknown).filter((item) => item.topic) : [];
  return { ok: true, action: "trends", searchedAt: now.toISOString(), items };
}

function trendFromUnknown(item: unknown) {
  const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  const strings = (value: unknown) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);
  return acceptTrendItem({
    topic: typeof row.topic === "string" ? row.topic : "",
    trendStatus: typeof row.trendStatus === "string" ? row.trendStatus : "INSUFFICIENT_EVIDENCE",
    summary: typeof row.summary === "string" ? row.summary : "",
    whyRelevant: typeof row.whyRelevant === "string" ? row.whyRelevant : "",
    categorySlug: typeof row.categorySlug === "string" ? row.categorySlug : "",
    existingCoverage: typeof row.existingCoverage === "string" ? row.existingCoverage : "",
    recommendedAction: typeof row.recommendedAction === "string" ? row.recommendedAction : "MONITOR",
    suggestedAngle: typeof row.suggestedAngle === "string" ? row.suggestedAngle : "",
    sourceUrls: strings(row.sourceUrls),
    sourceDates: strings(row.sourceDates),
  });
}

function defaultClient(apiKey: string): ResponsesClient {
  const sdk = new OpenAI({ apiKey, timeout: 70_000, maxRetries: 0 });
  return { responses: { create: (body, options) => sdk.responses.create(body as never, { signal: options?.signal }) } };
}
