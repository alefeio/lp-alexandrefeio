import {
  firstValueLessonBySlug,
  firstValueOptionsFromPurchaseLessons,
  type FirstValueLessonDefinition,
} from "@/lib/learning/first-value/catalog";
import { attributeArtifactToPurchase, isVerifiedAchievementKind, pickOwnedArtifact } from "@/lib/learning/first-value/evidence";
import type {
  FirstValueArtifact,
  FirstValueEntitlement,
  FirstValueProgress,
  FirstValuePurchase,
  FirstValueRecommendation,
  FirstValueSelectInput,
} from "@/lib/learning/first-value/types";

function activeEntitlement(ents: FirstValueEntitlement[], lessonSlug: string): FirstValueEntitlement | undefined {
  return ents.find((row) => row.lessonSlug === lessonSlug && row.status === "ACTIVE");
}

function revokedOnly(ents: FirstValueEntitlement[], lessonSlug: string): boolean {
  const rows = ents.filter((row) => row.lessonSlug === lessonSlug);
  return rows.length > 0 && rows.every((row) => row.status === "REVOKED");
}

function progressFor(rows: FirstValueProgress[], lessonSlug: string): FirstValueProgress | undefined {
  return rows.find((row) => row.lessonSlug === lessonSlug);
}

function lessonAccessible(input: {
  definition: FirstValueLessonDefinition;
  entitlements: FirstValueEntitlement[];
  published: Set<string>;
}): boolean {
  if (!input.published.has(input.definition.lessonSlug)) return false;
  if (input.definition.accessType === "FREE") return true;
  return Boolean(activeEntitlement(input.entitlements, input.definition.lessonSlug));
}

function isPaidConfirmed(purchase: FirstValuePurchase): boolean {
  return purchase.status === "PAID" && purchase.confirmedAt != null;
}

function isPendingPayment(purchase: FirstValuePurchase): boolean {
  return purchase.status === "PENDING_PAYMENT";
}

function sortPurchases(purchases: FirstValuePurchase[]): FirstValuePurchase[] {
  return purchases.slice().sort((a, b) => {
    const aTime = (a.confirmedAt ?? a.createdAt).getTime();
    const bTime = (b.confirmedAt ?? b.createdAt).getTime();
    if (bTime !== aTime) return bTime - aTime;
    return a.orderId.localeCompare(b.orderId);
  });
}

function recommendationBase(
  purchase: FirstValuePurchase | null,
  patch: Omit<FirstValueRecommendation, "product"> & { product?: FirstValueRecommendation["product"] },
): FirstValueRecommendation {
  return {
    ...patch,
    product: patch.product ?? {
      orderId: purchase?.orderId ?? null,
      productType: purchase?.productType ?? null,
      courseSlug: purchase?.courseSlug ?? null,
      zeroValueUpgrade: purchase?.zeroValueUpgrade ?? false,
    },
  };
}

function activityFrom(definition: FirstValueLessonDefinition) {
  return {
    lessonSlug: definition.lessonSlug,
    courseSlug: definition.courseSlug,
    outcome: definition.pedagogicalOutcome,
    eligibility: definition.eligibility,
  };
}

function progressView(row: FirstValueProgress | undefined) {
  if (!row) return { percent: null, inProgress: false, completed: false };
  const completed = Boolean(row.completedAt);
  const inProgress = !completed && (Boolean(row.startedAt) || row.percent > 0);
  return { percent: row.percent, inProgress, completed };
}

function existingResultView(
  artifact: FirstValueArtifact | null,
  purchase: FirstValuePurchase | null,
  subjectUserId: string,
): FirstValueRecommendation["existingResult"] {
  if (!artifact) return null;
  return {
    kind: artifact.kind,
    createdAt: artifact.createdAt.toISOString(),
    updatedAt: artifact.updatedAt.toISOString(),
    attribution: attributeArtifactToPurchase(artifact, {
      subjectUserId,
      purchaseConfirmedAt: purchase?.confirmedAt ?? null,
    }),
  };
}

function pickCandidate(
  definitions: FirstValueLessonDefinition[],
  input: FirstValueSelectInput,
  purchase: FirstValuePurchase,
): {
  definition: FirstValueLessonDefinition;
  progress: FirstValueProgress | undefined;
  artifact: FirstValueArtifact | null;
  accessible: boolean;
} | null {
  const published = new Set(input.publishedLessonSlugs);
  const scored = definitions
    .map((definition) => {
      const accessible = lessonAccessible({ definition, entitlements: input.entitlements, published });
      const progress = progressFor(input.progress, definition.lessonSlug);
      const artifact = pickOwnedArtifact(input.artifacts, {
        subjectUserId: input.subjectUserId,
        lessonSlug: definition.lessonSlug,
        evidenceKind: definition.evidenceKind,
      });
      return { definition, progress, artifact, accessible };
    })
    .filter((row) => row.accessible);

  if (scored.length === 0) return null;

  const inProgress = scored
    .filter((row) => progressView(row.progress).inProgress)
    .sort(
      (a, b) =>
        (b.progress?.lastActiveAt?.getTime() ?? 0) - (a.progress?.lastActiveAt?.getTime() ?? 0) ||
        a.definition.firstValueRank - b.definition.firstValueRank ||
        a.definition.lessonSlug.localeCompare(b.definition.lessonSlug),
    );
  if (inProgress[0]) return inProgress[0];

  const withoutAchievement = scored
    .filter((row) => {
      if (!row.artifact || !isVerifiedAchievementKind(row.artifact.kind)) return true;
      const attribution = attributeArtifactToPurchase(row.artifact, {
        subjectUserId: input.subjectUserId,
        purchaseConfirmedAt: purchase.confirmedAt,
      });
      return attribution === "before_purchase" || attribution === "preexisting_edited";
    })
    .filter((row) => !progressView(row.progress).completed || !row.artifact)
    .sort(
      (a, b) =>
        a.definition.firstValueRank - b.definition.firstValueRank ||
        a.definition.position - b.definition.position ||
        a.definition.lessonSlug.localeCompare(b.definition.lessonSlug),
    );
  if (withoutAchievement[0]) return withoutAchievement[0];

  const withAchievement = scored
    .filter((row) => row.artifact && isVerifiedAchievementKind(row.artifact.kind))
    .sort(
      (a, b) =>
        a.definition.firstValueRank - b.definition.firstValueRank ||
        a.definition.lessonSlug.localeCompare(b.definition.lessonSlug),
    );
  return withAchievement[0] ?? scored.sort((a, b) => a.definition.firstValueRank - b.definition.firstValueRank)[0] ?? null;
}

function recommendForPurchase(purchase: FirstValuePurchase, input: FirstValueSelectInput): FirstValueRecommendation {
  if (isPendingPayment(purchase)) {
    return recommendationBase(purchase, {
      state: "payment_pending",
      activity: null,
      expectedOutcome: null,
      cta: { label: "Concluir pagamento", href: `/app/compras/${purchase.orderId}` },
      progress: null,
      existingResult: null,
      reason: "Pedido ainda não confirmado; conteúdo pago permanece bloqueado.",
      fallback: false,
    });
  }

  if (!isPaidConfirmed(purchase)) {
    return recommendationBase(purchase, {
      state: "access_unavailable",
      activity: null,
      expectedOutcome: null,
      cta: { label: "Ver meus cursos", href: "/app" },
      progress: null,
      existingResult: null,
      reason: `Pedido em status ${purchase.status} não libera primeira conquista.`,
      fallback: true,
    });
  }

  const definitions = firstValueOptionsFromPurchaseLessons(purchase.lessonSlugs);
  if (definitions.length === 0) {
    return recommendationBase(purchase, {
      state: "continuation",
      activity: null,
      expectedOutcome: null,
      cta: { label: "Ver meus cursos", href: "/app" },
      progress: null,
      existingResult: null,
      reason: "Compra confirmada sem aulas mapeadas no catálogo de primeira conquista.",
      fallback: true,
    });
  }

  const published = new Set(input.publishedLessonSlugs);
  const paidDefs = definitions.filter((row) => row.accessType === "PAID");
  const anyPaidRevoked = paidDefs.some((row) => revokedOnly(input.entitlements, row.lessonSlug));
  const anyPaidActive = paidDefs.some((row) => activeEntitlement(input.entitlements, row.lessonSlug));
  const needsEntitlement = paidDefs.length > 0;

  if (needsEntitlement && !anyPaidActive) {
    if (anyPaidRevoked) {
      return recommendationBase(purchase, {
        state: "access_unavailable",
        activity: null,
        expectedOutcome: null,
        cta: { label: "Ver meus cursos", href: "/app" },
        progress: null,
        existingResult: null,
        reason: "Entitlement revogado para as aulas pagas desta compra.",
        fallback: false,
      });
    }
    return recommendationBase(purchase, {
      state: "access_pending",
      activity: null,
      expectedOutcome: null,
      cta: { label: "Ver meu pedido", href: `/app/compras/${purchase.orderId}` },
      progress: null,
      existingResult: null,
      reason: "Pagamento confirmado, mas entitlement ACTIVE ainda não validado.",
      fallback: false,
    });
  }

  // Aula individual paga: nunca sugerir outra aula paga não incluída.
  if (purchase.productType === "LESSON" && purchase.lessonSlugs.length === 1) {
    const only = firstValueLessonBySlug(purchase.lessonSlugs[0]!);
    if (!only) {
      return recommendationBase(purchase, {
        state: "continuation",
        activity: null,
        expectedOutcome: null,
        cta: { label: "Abrir aula", href: `/aulas/${purchase.lessonSlugs[0]}` },
        progress: null,
        existingResult: null,
        reason: "Aula comprada fora do catálogo ACT-1A; fallback pedagógico honesto.",
        fallback: true,
      });
    }
    if (only.accessType === "PAID" && !activeEntitlement(input.entitlements, only.lessonSlug)) {
      return recommendationBase(purchase, {
        state: revokedOnly(input.entitlements, only.lessonSlug) ? "access_unavailable" : "access_pending",
        activity: activityFrom(only),
        expectedOutcome: only.pedagogicalOutcome,
        cta: { label: "Ver meu pedido", href: `/app/compras/${purchase.orderId}` },
        progress: null,
        existingResult: null,
        reason: "Aula paga adquirida sem acesso ACTIVE.",
        fallback: false,
      });
    }
    if (!published.has(only.lessonSlug)) {
      return recommendationBase(purchase, {
        state: "access_unavailable",
        activity: activityFrom(only),
        expectedOutcome: only.pedagogicalOutcome,
        cta: { label: "Ver meus cursos", href: "/app" },
        progress: null,
        existingResult: null,
        reason: "Aula indisponível/publicação ausente.",
        fallback: true,
      });
    }
  }

  const achieved = definitions
    .map((definition) => {
      const artifact = pickOwnedArtifact(input.artifacts, {
        subjectUserId: input.subjectUserId,
        lessonSlug: definition.lessonSlug,
        evidenceKind: definition.evidenceKind,
      });
      if (!artifact || !isVerifiedAchievementKind(artifact.kind)) return null;
      const attribution = attributeArtifactToPurchase(artifact, {
        subjectUserId: input.subjectUserId,
        purchaseConfirmedAt: purchase.confirmedAt,
      });
      if (attribution !== "after_purchase") return null;
      return { definition, artifact, progress: progressFor(input.progress, definition.lessonSlug) };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort(
      (a, b) =>
        a.definition.firstValueRank - b.definition.firstValueRank ||
        a.definition.lessonSlug.localeCompare(b.definition.lessonSlug),
    );

  if (achieved[0]) {
    const remaining = definitions.filter((row) => !achieved.some((item) => item.definition.lessonSlug === row.lessonSlug));
    const next = pickCandidate(remaining, input, purchase);
    const primary = achieved[0];
    if (next) {
      return recommendationBase(purchase, {
        state: "next_evolution",
        activity: activityFrom(next.definition),
        expectedOutcome: next.definition.pedagogicalOutcome,
        cta: {
          label: progressView(next.progress).inProgress ? "Continuar evolução" : "Próximo resultado",
          href: next.definition.startPath,
        },
        progress: progressView(next.progress),
        existingResult: existingResultView(primary.artifact, purchase, input.subjectUserId),
        reason: `Primeira conquista verificável em ${primary.definition.lessonSlug}; evoluir para ${next.definition.lessonSlug}.`,
        fallback: false,
      });
    }
    return recommendationBase(purchase, {
      state: "first_value_achieved",
      activity: activityFrom(primary.definition),
      expectedOutcome: primary.definition.pedagogicalOutcome,
      cta: { label: "Revisar resultado", href: primary.definition.startPath },
      progress: progressView(primary.progress),
      existingResult: existingResultView(primary.artifact, purchase, input.subjectUserId),
      reason: `Artefato verificável em ${primary.definition.authority} após a compra.`,
      fallback: false,
    });
  }

  const candidate = pickCandidate(definitions, input, purchase);
  if (!candidate) {
    return recommendationBase(purchase, {
      state: "continuation",
      activity: null,
      expectedOutcome: null,
      cta: { label: "Ver meus cursos", href: "/app" },
      progress: null,
      existingResult: null,
      reason: "Nenhuma atividade acessível elegível nesta compra.",
      fallback: true,
    });
  }

  const { definition, progress, artifact } = candidate;
  const view = progressView(progress);
  const existing = existingResultView(artifact, purchase, input.subjectUserId);

  if (view.inProgress) {
    return recommendationBase(purchase, {
      state: "in_progress",
      activity: activityFrom(definition),
      expectedOutcome: definition.pedagogicalOutcome,
      cta: { label: "Continuar aula", href: definition.startPath },
      progress: view,
      existingResult: existing,
      reason: "Atividade acessível relacionada à compra já iniciada.",
      fallback: false,
    });
  }

  if (existing && (existing.attribution === "before_purchase" || existing.attribution === "preexisting_edited")) {
    return recommendationBase(purchase, {
      state: "continuation",
      activity: activityFrom(definition),
      expectedOutcome: definition.pedagogicalOutcome,
      cta: { label: "Revisar ou atualizar", href: definition.startPath },
      progress: view,
      existingResult: existing,
      reason: "Resultado preexistente não atribuído à nova compra; oferecer revisão honesta.",
      fallback: false,
    });
  }

  if (definition.eligibility === "learning_progress_only" || definition.eligibility === "unsupported") {
    return recommendationBase(purchase, {
      state: "ready_to_start",
      activity: activityFrom(definition),
      expectedOutcome: definition.pedagogicalOutcome,
      cta: { label: "Começar aula", href: definition.startPath },
      progress: view,
      existingResult: null,
      reason: "Sem artefato verificável; continuação pedagógica honesta (não inventa conquista).",
      fallback: true,
    });
  }

  return recommendationBase(purchase, {
    state: "ready_to_start",
    activity: activityFrom(definition),
    expectedOutcome: definition.pedagogicalOutcome,
    cta: { label: "Começar meu resultado", href: definition.startPath },
    progress: view,
    existingResult: existing,
    reason:
      definition.eligibility === "requires_dependency"
        ? `Atividade elegível com dependência (${definition.dependency}); pronta para iniciar sem fingir conquista.`
        : "Atividade elegível do produto adquirido ainda não realizada.",
    fallback: false,
  });
}

/**
 * Seletor puro e determinístico da próxima ação de primeira conquista.
 * Não consulta banco, não grava, não duplica CourseJourney — recebe fatos já carregados.
 */
export function selectFirstValueAction(input: FirstValueSelectInput): FirstValueRecommendation {
  const purchases = sortPurchases(input.purchases);
  if (purchases.length === 0) {
    return recommendationBase(null, {
      state: "continuation",
      activity: null,
      expectedOutcome: null,
      cta: { label: "Ver formações", href: "/cursos" },
      progress: null,
      existingResult: null,
      reason: "Sem compras observadas; sem recomendação pós-compra.",
      fallback: true,
    });
  }

  const pending = purchases.find(isPendingPayment);
  const confirmed = purchases.filter(isPaidConfirmed);

  // Progresso em andamento em compra confirmada vence pedido pendente mais antigo para continuidade.
  for (const purchase of confirmed) {
    const defs = firstValueOptionsFromPurchaseLessons(purchase.lessonSlugs);
    const candidate = pickCandidate(defs, input, purchase);
    if (candidate && progressView(candidate.progress).inProgress) {
      return recommendForPurchase(purchase, input);
    }
  }

  if (pending && confirmed.length === 0) {
    return recommendForPurchase(pending, input);
  }

  if (confirmed[0]) {
    return recommendForPurchase(confirmed[0], input);
  }

  if (pending) return recommendForPurchase(pending, input);
  return recommendForPurchase(purchases[0]!, input);
}
