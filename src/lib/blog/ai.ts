import OpenAI from "openai";
import { BLOG_AI_FAILURE } from "@/lib/blog/catalog";
import { acceptSuggestions, acceptTitles, acceptTrendItem, type EditorialSuggestion } from "@/lib/blog/editorial";
import { demoteMarkdownH1 } from "@/lib/blog/rules";
import { buildEditorialRequest, parseEditorialOutput, type BlogAiAction } from "@/lib/blog/ai-request";
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
  focus?: Record<string, string>;
  client?: ResponsesClient;
  now?: Date;
}): Promise<BlogAiSuccess | { ok: false; message: string }> {
  const now = input.now ?? new Date();
  try {
    const apiKey = readOpenAICopyApiKey();
    if (!input.client && !apiKey) return { ok: false, message: BLOG_AI_FAILURE };
    const client = input.client ?? defaultClient(apiKey as string);
    const body = buildEditorialRequest({ action: input.action, model: resolveCopyModel(), inventory: input.inventory, focus: input.focus });
    const timeout = input.action === "trends" ? 70_000 : 45_000;
    const response = await client.responses.create(body, { signal: AbortSignal.timeout(timeout) });
    const parsed = parseEditorialOutput(response);
    if (!parsed.ok) return parsed;
    return shape(input.action, parsed.value, input.inventory, now);
  } catch (error) {
    console.error("blog editorial assist failed", { action: input.action, name: error instanceof Error ? error.name : "Error" });
    return { ok: false, message: BLOG_AI_FAILURE };
  }
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
