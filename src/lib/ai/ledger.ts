import { getPrisma } from "@/lib/db/prisma";

export const AI_PROVIDER_CALL_FIELDS = [
  "requestId",
  "attempt",
  "featureKey",
  "providerId",
  "modelId",
  "providerResponseId",
  "promptVersion",
  "operationType",
  "sectionType",
  "userId",
  "projectId",
  "courseId",
  "landingPageProjectId",
  "status",
  "errorCode",
  "inputTokens",
  "cachedInputTokens",
  "cacheWriteTokens",
  "cacheWrite30mTokens",
  "cacheWrite12hTokens",
  "outputTokens",
  "reasoningTokens",
  "totalTokens",
  "estimatedCostUsdMicros",
  "pricingVersion",
  "latencyMs",
] as const;

export type AiProviderCallDraft = {
  requestId: string;
  attempt: number;
  featureKey: string;
  providerId: string;
  modelId: string;
  providerResponseId: string | null;
  promptVersion: string | null;
  operationType: string | null;
  sectionType: string | null;
  userId: string;
  projectId: string | null;
  courseId: string | null;
  landingPageProjectId: string | null;
  status: "responded" | "failed";
  errorCode: string | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteTokens: number | null;
  cacheWrite30mTokens: number | null;
  cacheWrite12hTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsdMicros: number | null;
  pricingVersion: string | null;
  latencyMs: number | null;
};

export type LedgerWriteResult = "recorded" | "duplicate" | "failed";

export type AiLedgerWriter = (record: AiProviderCallDraft) => Promise<LedgerWriteResult>;

export function createMemoryAiLedger(): { rows: AiProviderCallDraft[]; write: AiLedgerWriter } {
  const rows: AiProviderCallDraft[] = [];
  return {
    rows,
    async write(record) {
      if (rows.some((row) => row.requestId === record.requestId && row.attempt === record.attempt)) return "duplicate";
      rows.push(record);
      return "recorded";
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}

/** Persiste uma provider call. Não relança erro de banco para o fluxo do usuário. */
export async function recordAiProviderCall(record: AiProviderCallDraft, writer?: AiLedgerWriter): Promise<LedgerWriteResult> {
  try {
    if (writer) return await writer(record);
    if (process.env.UNIT_TEST_ISOLATION === "1") return "failed";
    await getPrisma().aiProviderCall.create({ data: record });
    return "recorded";
  } catch (error) {
    if (isUniqueViolation(error)) return "duplicate";
    console.error("[ai-ledger] persist_failed", { requestId: record.requestId, attempt: record.attempt, featureKey: record.featureKey });
    return "failed";
  }
}
