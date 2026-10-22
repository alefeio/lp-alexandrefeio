import { FindingCard } from "@/components/landing-page/FindingCard";
import { experienceReviewEffectiveStatus } from "@/lib/landing-page/experience/review";
import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";

const STATUS_LABEL = {
  NOT_REVIEWED: "Ainda não revisado",
  NEEDS_ADJUSTMENTS: "Precisa de ajustes",
  READY_FOR_NEXT_STEP: "Revisado",
  STALE: "A página mudou desde a revisão",
} as const;

export function ExperienceReviewPanel({
  document,
  draftRevision,
}: {
  document: LandingPageDocumentV1;
  draftRevision: number;
}) {
  const status = experienceReviewEffectiveStatus(document, draftRevision);
  const review = document.experienceReview;
  return (
    <aside className="mt-6 space-y-3" data-experience-review={status}>
      <p className="text-sm font-medium">{review && status !== "STALE" ? review.summary.headline : STATUS_LABEL[status]}</p>
      {status === "STALE" ? <p className="text-sm text-muted">A revisão anterior não acompanha a versão atual da página.</p> : null}
      {review?.findings.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
    </aside>
  );
}
