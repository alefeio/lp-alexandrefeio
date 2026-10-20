import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { wireframeActionTypeForMethod } from "@/lib/landing-page/decision-journey";
import type { WireframeContextV1 } from "@/lib/landing-page/wireframe/context";

const SIGNAL_FIELDS = [
  "explanationNeed",
  "trustNeed",
  "decisionComplexity",
  "processNeedsExplanation",
  "proofSituation",
  "contactImportance",
] as const;

/**
 * Monta o contexto do motor a partir do brief e da jornada.
 * Não chama o motor e não cria seções.
 */
export function wireframeContextCompleteness(document: LandingPageDocumentV1): WireframeContextV1["contextCompleteness"] {
  const brief = document.strategy?.brief;
  if (!brief?.offer.name || !brief.audience.description || !brief.pageGoal || !brief.primaryAction) return "INSUFFICIENT";
  const journey = document.strategy?.decisionJourney;
  if (!journey) return "PARTIAL";
  const unknownSignal = SIGNAL_FIELDS.some((field) => journey[field] === "UNKNOWN");
  if (unknownSignal || !journey.preferredConversionMethod || journey.decisionStages.length === 0) return "PARTIAL";
  return "SUFFICIENT";
}

export function buildWireframeContextFromLandingPageProject(document: LandingPageDocumentV1): WireframeContextV1 | null {
  const brief = document.strategy?.brief;
  if (!brief?.offer.name || !brief.audience.description || !brief.pageGoal || !brief.primaryAction) return null;
  const journey = document.strategy?.decisionJourney;
  const preferred = journey ? wireframeActionTypeForMethod(journey.preferredConversionMethod) : null;
  return {
    version: 1,
    offer: { name: brief.offer.name, ...(brief.offer.summary ? { summary: brief.offer.summary } : {}) },
    audience: { description: brief.audience.description },
    primaryGoal: brief.pageGoal,
    primaryAction: brief.primaryAction,
    ...(brief.secondaryAction ? { secondaryAction: brief.secondaryAction } : {}),
    explanationNeed: journey?.explanationNeed ?? "UNKNOWN",
    trustNeed: journey?.trustNeed ?? "UNKNOWN",
    decisionComplexity: journey?.decisionComplexity ?? "UNKNOWN",
    objections: brief.objections,
    processNeedsExplanation: journey?.processNeedsExplanation ?? "UNKNOWN",
    proofSituation: journey?.proofSituation ?? "UNKNOWN",
    contactImportance: journey?.contactImportance ?? "UNKNOWN",
    ...(preferred ? { preferredConversionMethod: preferred } : {}),
    contextCompleteness: wireframeContextCompleteness(document),
  };
}
