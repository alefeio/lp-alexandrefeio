import type { LandingPageCode } from "@/lib/landing-page/errors";
import type { LandingPageCopyContextV1 } from "@/lib/landing-page/copy/context";

export type CopyProviderFailure = Extract<
  LandingPageCode,
  "COPY_ASSIST_UNAVAILABLE" | "COPY_ASSIST_RATE_LIMITED" | "COPY_ASSIST_PROVIDER_ERROR"
>;

export type LandingPageCopyProvider = {
  id: string;
  modelId: string;
  generateCopySuggestion(input: {
    promptVersion: string;
    context: LandingPageCopyContextV1;
    repair: boolean;
    signal?: AbortSignal;
  }): Promise<{ ok: true; raw: unknown } | { ok: false; code: CopyProviderFailure }>;
};

/**
 * Não há adapter ao vivo. Nenhum SDK de IA está instalado e nenhuma chave é lida daqui.
 * A Aula 7 só deve usar um provider real quando esta função deixar de devolver indisponível.
 */
export function resolveLandingPageCopyProvider(): LandingPageCopyProvider {
  return {
    id: "unavailable",
    modelId: "none",
    async generateCopySuggestion() {
      return { ok: false, code: "COPY_ASSIST_UNAVAILABLE" };
    },
  };
}
