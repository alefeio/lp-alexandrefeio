import type {
  FirstValueArtifact,
  FirstValueAttribution,
  FirstValueEvidenceKind,
  FirstValueResultSource,
} from "@/lib/learning/first-value/types";

const VERIFIED_KINDS: ReadonlySet<FirstValueEvidenceKind> = new Set([
  "lesson_result_personal",
  "lesson_result_project",
  "diagnostic_completed",
  "landing_page_published",
]);

/**
 * Kinds que comprovam conquista pedagógica quando `resultAchievedAt` está presente.
 * `landing_page_draft` / `landing_page_project_shell` / progresso sozinho NÃO contam.
 */
export function isVerifiedAchievementKind(kind: FirstValueEvidenceKind): boolean {
  return VERIFIED_KINDS.has(kind);
}

export function isVerifiedAchievement(artifact: Pick<FirstValueArtifact, "kind" | "resultAchievedAt">): boolean {
  return isVerifiedAchievementKind(artifact.kind) && artifact.resultAchievedAt != null;
}

/**
 * Atribuição temporal de um artefato a uma compra.
 *
 * Usa exclusivamente `resultAchievedAt` (prova do resultado pedagógico).
 * Sem prova temporal → `unknown` — nunca declara `after_purchase`.
 * `updatedAt` só diferencia `preexisting_edited` quando o resultado foi criado antes da compra.
 */
export function attributeArtifactToPurchase(
  artifact: Pick<FirstValueArtifact, "userId" | "resultAchievedAt" | "updatedAt">,
  input: { subjectUserId: string; purchaseConfirmedAt: Date | null },
): FirstValueAttribution {
  if (artifact.userId !== input.subjectUserId) return "other_user";
  if (!input.purchaseConfirmedAt) return "unknown";
  if (!artifact.resultAchievedAt) return "unknown";

  const confirmed = input.purchaseConfirmedAt.getTime();
  const achieved = artifact.resultAchievedAt.getTime();
  const updated = artifact.updatedAt.getTime();

  if (achieved >= confirmed) return "after_purchase";
  if (achieved < confirmed && updated > confirmed) return "preexisting_edited";
  if (achieved < confirmed) return "before_purchase";
  return "unknown";
}

function compatibleEvidence(actual: FirstValueEvidenceKind, expected: FirstValueEvidenceKind): boolean {
  if (expected === "lesson_result_personal" && actual === "lesson_result_project") return true;
  if (expected === "lesson_result_project" && actual === "lesson_result_personal") return true;
  if (expected === "landing_page_draft" && actual === "landing_page_published") return true;
  return false;
}

function matchesEvidence(
  actual: FirstValueEvidenceKind,
  expected: FirstValueEvidenceKind,
): boolean {
  if (expected === "none") return true;
  return actual === expected || compatibleEvidence(actual, expected);
}

function artifactTieBreak(a: FirstValueArtifact, b: FirstValueArtifact): number {
  const aAchieved = a.resultAchievedAt?.getTime() ?? -1;
  const bAchieved = b.resultAchievedAt?.getTime() ?? -1;
  if (bAchieved !== aAchieved) return bAchieved - aAchieved;
  if (b.createdAt.getTime() !== a.createdAt.getTime()) return b.createdAt.getTime() - a.createdAt.getTime();
  const aId = a.id ?? `${a.kind}:${a.createdAt.toISOString()}`;
  const bId = b.id ?? `${b.kind}:${b.createdAt.toISOString()}`;
  return aId.localeCompare(bId);
}

/**
 * Seleção determinística de evidência por aula.
 *
 * Quando `purchaseConfirmedAt` é informado, prioriza artefato com atribuição `after_purchase`
 * (mesmo que outro registro antigo tenha `updatedAt` mais recente). Em empate temporal,
 * usa `resultAchievedAt` desc → `createdAt` desc → `id`.
 */
export function pickOwnedArtifact(
  artifacts: FirstValueArtifact[],
  input: {
    subjectUserId: string;
    lessonSlug: string;
    evidenceKind: FirstValueEvidenceKind;
    purchaseConfirmedAt?: Date | null;
  },
): FirstValueArtifact | null {
  const matches = artifacts.filter(
    (row) =>
      row.userId === input.subjectUserId &&
      row.lessonSlug === input.lessonSlug &&
      matchesEvidence(row.kind, input.evidenceKind),
  );
  if (matches.length === 0) return null;

  if (input.purchaseConfirmedAt) {
    const afterPurchase = matches.filter(
      (row) =>
        isVerifiedAchievement(row) &&
        attributeArtifactToPurchase(row, {
          subjectUserId: input.subjectUserId,
          purchaseConfirmedAt: input.purchaseConfirmedAt ?? null,
        }) === "after_purchase",
    );
    if (afterPurchase.length > 0) {
      return afterPurchase.slice().sort(artifactTieBreak)[0] ?? null;
    }
  }

  const verified = matches.filter(isVerifiedAchievement);
  if (verified.length > 0) {
    return verified.slice().sort(artifactTieBreak)[0] ?? null;
  }

  return matches.slice().sort(artifactTieBreak)[0] ?? null;
}

/**
 * Contrato do loader ACT-1B: monta artefato só com prova pedagógica.
 * Shell de LP / timestamps ambíguos → resultAchievedAt null (unknown).
 */
export function buildFirstValueArtifact(input: {
  id?: string;
  lessonSlug: string;
  kind: FirstValueEvidenceKind;
  userId: string;
  resultSource: FirstValueResultSource;
  resultAchievedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): FirstValueArtifact {
  const shell = input.kind === "landing_page_project_shell" || input.kind === "landing_page_draft";
  const unproven = input.resultSource === "unproven" || input.resultSource === "unknown";
  return {
    id: input.id,
    lessonSlug: input.lessonSlug,
    kind: input.kind,
    userId: input.userId,
    resultSource: shell || unproven ? (input.resultSource === "unknown" ? "unknown" : "unproven") : input.resultSource,
    resultAchievedAt: shell || unproven ? null : input.resultAchievedAt,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}
