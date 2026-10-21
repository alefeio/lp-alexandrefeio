import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import type { TrustProofV1 } from "@/lib/landing-page/trust/schema";

export type LandingPageTrustEvaluation = {
  availableProofs: Array<{ id: string; type: TrustProofV1["type"] }>;
  missingProofs: Array<{ id: string; type: TrustProofV1["type"] }>;
  pendingConsent: string[];
  unreferencedProofs: string[];
  warnings: string[];
};

function referenced(document: LandingPageDocumentV1, proofId: string): boolean {
  return document.sections.some((section) => {
    if (section.type !== "TRUST" && section.type !== "TESTIMONIALS") return false;
    return section.content.proofRefs?.includes(proofId) ?? false;
  });
}

export function evaluateLandingPageTrust(document: LandingPageDocumentV1): LandingPageTrustEvaluation {
  const proofs = document.strategy?.copyFacts?.trustProofs ?? [];
  const availableProofs = proofs
    .filter((proof) => proof.id && proof.status === "READY_FOR_DISPLAY")
    .map((proof) => ({ id: proof.id as string, type: proof.type }));
  const missingProofs = proofs
    .filter((proof) => proof.id && proof.status !== "READY_FOR_DISPLAY")
    .map((proof) => ({ id: proof.id as string, type: proof.type }));
  const pendingConsent = proofs
    .filter((proof) => proof.id && proof.type === "TESTIMONIAL" && proof.consentConfirmed !== true)
    .map((proof) => proof.id as string);
  const unreferencedProofs = availableProofs.filter((proof) => !referenced(document, proof.id)).map((proof) => proof.id);
  const warnings: string[] = [];
  if (pendingConsent.length > 0) warnings.push("Há depoimento sem autorização confirmada para uso público.");
  if (unreferencedProofs.length > 0) warnings.push("Há prova pronta que ainda não aparece em nenhuma seção.");
  return { availableProofs, missingProofs, pendingConsent, unreferencedProofs, warnings };
}
