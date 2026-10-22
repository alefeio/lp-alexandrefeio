import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";

/**
 * Mudança só de mensuração não altera a página visível.
 * Se a revisão estava atual, ela acompanha a nova revisão do rascunho.
 * Ação, formulário e qualquer outra edição de conteúdo não passam por aqui e ficam STALE.
 */
export function keepExperienceReviewCurrent(document: LandingPageDocumentV1, previousRevision: number, nextRevision: number): void {
  if (document.experienceReview?.reviewedDraftRevision === previousRevision) {
    document.experienceReview.reviewedDraftRevision = nextRevision;
  }
  if (document.strategy?.experienceReview?.reviewedDraftRevision === previousRevision) {
    document.strategy.experienceReview.reviewedDraftRevision = nextRevision;
  }
}
