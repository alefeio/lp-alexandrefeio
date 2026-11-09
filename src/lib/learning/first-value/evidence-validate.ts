import { z } from "zod";
import { conversionBriefResponseSchema } from "@/lib/landing-page/brief";
import { campaignBriefSchema } from "@/lib/learning/campaign-brief";
import type { FirstValueEvidenceKind } from "@/lib/learning/first-value/types";

/** Personal upsert do brief de conversão (campos achatados; completedAt mutável — não usar como prova temporal). */
const conversionBriefPersonalSchema = z
  .object({
    kind: z.literal("conversion-brief-summary"),
    landingPageProjectId: z.string().trim().min(1),
  })
  .passthrough();

const nonEmptyObject = z.record(z.string(), z.unknown()).refine((row) => Object.keys(row).length > 0);

/**
 * Valida payload pedagógico sem confiar em `payload.completedAt` como primeira conquista.
 * Retorna true apenas quando a estrutura comprova o resultado da ferramenta.
 */
export function isValidPedagogicalPayload(input: {
  toolKey: string | null;
  evidenceKind: FirstValueEvidenceKind;
  payload: unknown;
}): boolean {
  const { toolKey, evidenceKind, payload } = input;

  if (evidenceKind === "landing_page_project_shell" || evidenceKind === "landing_page_draft" || evidenceKind === "none") {
    return false;
  }

  if (toolKey === "CAMPAIGN_BRIEF_V1") {
    return campaignBriefSchema.safeParse(payload).success;
  }

  if (toolKey === "CONVERSION_PAGE_BRIEF_V1") {
    return (
      conversionBriefResponseSchema.safeParse(payload).success || conversionBriefPersonalSchema.safeParse(payload).success
    );
  }

  if (evidenceKind === "diagnostic_completed" || evidenceKind === "landing_page_published") {
    return false;
  }

  if (evidenceKind === "lesson_result_personal" || evidenceKind === "lesson_result_project") {
    return nonEmptyObject.safeParse(payload).success;
  }

  return false;
}

/** Extrai completedAt do payload apenas para diagnóstico documental — nunca para atribuição. */
export function readMutablePayloadCompletedAt(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as { completedAt?: unknown }).completedAt;
  return typeof value === "string" && value.trim() ? value : null;
}
