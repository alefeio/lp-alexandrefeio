import type { FirstValueArtifact, FirstValueAttribution, FirstValueEvidenceKind } from "@/lib/learning/first-value/types";

/**
 * Atribuição temporal de um artefato a uma compra.
 *
 * Limitação documentada: LessonResult / LandingPageProject só expõem createdAt/updatedAt.
 * Não há “firstAchievedAt” imutável. Um edit posterior com createdAt anterior à compra
 * é classificado como preexisting_edited — conquista existente, não atribuída à nova compra.
 */
export function attributeArtifactToPurchase(
  artifact: Pick<FirstValueArtifact, "userId" | "createdAt" | "updatedAt">,
  input: { subjectUserId: string; purchaseConfirmedAt: Date | null },
): FirstValueAttribution {
  if (artifact.userId !== input.subjectUserId) return "other_user";
  if (!input.purchaseConfirmedAt) return "unknown";
  const confirmed = input.purchaseConfirmedAt.getTime();
  const created = artifact.createdAt.getTime();
  const updated = artifact.updatedAt.getTime();
  if (created >= confirmed) return "after_purchase";
  if (created < confirmed && updated > confirmed) return "preexisting_edited";
  if (created < confirmed) return "before_purchase";
  return "unknown";
}

export function isVerifiedAchievementKind(kind: FirstValueEvidenceKind): boolean {
  return kind !== "none" && kind !== "lesson_progress_complete";
}

export function pickOwnedArtifact(
  artifacts: FirstValueArtifact[],
  input: { subjectUserId: string; lessonSlug: string; evidenceKind: FirstValueEvidenceKind },
): FirstValueArtifact | null {
  const matches = artifacts.filter(
    (row) =>
      row.userId === input.subjectUserId &&
      row.lessonSlug === input.lessonSlug &&
      (input.evidenceKind === "none" || row.kind === input.evidenceKind || compatibleEvidence(row.kind, input.evidenceKind)),
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
}

function compatibleEvidence(actual: FirstValueEvidenceKind, expected: FirstValueEvidenceKind): boolean {
  if (expected === "landing_page_draft" && actual === "landing_page_published") return true;
  if (expected === "lesson_result_personal" && actual === "lesson_result_project") return true;
  return false;
}
