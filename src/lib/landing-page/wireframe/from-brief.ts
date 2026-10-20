import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import type { WireframeContextV1 } from "@/lib/landing-page/wireframe/context";

/**
 * Adapta o brief da Aula 4 para o contrato do motor.
 * Não chama o motor e não cria seções: a Aula 5 ainda precisa completar os sinais.
 */
export function buildWireframeContextFromLandingPageProject(document: LandingPageDocumentV1): WireframeContextV1 | null {
  const brief = document.strategy?.brief;
  if (!brief) return null;
  return {
    version: 1,
    offer: { name: brief.offer.name, ...(brief.offer.summary ? { summary: brief.offer.summary } : {}) },
    audience: { description: brief.audience.description },
    primaryGoal: brief.pageGoal,
    primaryAction: brief.primaryAction,
    ...(brief.secondaryAction ? { secondaryAction: brief.secondaryAction } : {}),
    explanationNeed: "UNKNOWN",
    trustNeed: "UNKNOWN",
    decisionComplexity: "UNKNOWN",
    objections: brief.objections,
    processNeedsExplanation: "UNKNOWN",
    proofSituation: "UNKNOWN",
    contactImportance: "UNKNOWN",
    contextCompleteness: "PARTIAL",
  };
}
