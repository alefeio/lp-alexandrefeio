import type { LandingPageCode } from "@/lib/landing-page/errors";
import { readOpenAICopyApiKey, resolveCopyModel } from "@/lib/landing-page/copy/config";
import type { LandingPageCopyContextV1 } from "@/lib/landing-page/copy/context";
import { createOpenAILandingPageCopyProvider } from "@/lib/landing-page/copy/providers/openai";

export type CopyProviderFailure = Extract<
  LandingPageCode,
  "COPY_ASSIST_UNAVAILABLE" | "COPY_ASSIST_RATE_LIMITED" | "COPY_ASSIST_PROVIDER_ERROR"
>;

export type CopyProviderUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

export type CopyProviderResult =
  | { ok: true; raw: unknown; usage?: CopyProviderUsage }
  | { ok: false; code: CopyProviderFailure };

export type LandingPageCopyProvider = {
  id: string;
  modelId: string;
  generateCopySuggestion(input: {
    promptVersion: string;
    context: LandingPageCopyContextV1;
    repair: boolean;
    signal?: AbortSignal;
    variantCount?: number;
  }): Promise<CopyProviderResult>;
};

function unavailableProvider(): LandingPageCopyProvider {
  return {
    id: "unavailable",
    modelId: "none",
    async generateCopySuggestion() {
      return { ok: false, code: "COPY_ASSIST_UNAVAILABLE" };
    },
  };
}

export function resolveLandingPageCopyProvider(): LandingPageCopyProvider {
  const apiKey = readOpenAICopyApiKey();
  if (!apiKey) return unavailableProvider();
  return createOpenAILandingPageCopyProvider({ apiKey, model: resolveCopyModel() });
}
