import {
  firstValueLessonBySlug,
  firstValueOptionsFromPurchaseLessons,
  type FirstValueLessonDefinition,
} from "@/lib/learning/first-value/catalog";
import {
  attributeArtifactToPurchase,
  isVerifiedAchievement,
  pickOwnedArtifact,
} from "@/lib/learning/first-value/evidence";
import type {
  FirstValueArtifact,
  FirstValueDependencyAvailability,
  FirstValueEntitlement,
  FirstValuePreparation,
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
  patch: Omit<FirstValueRecommendation, "product" | "preparation"> & {
    product?: FirstValueRecommendation["product"];
    preparation?: FirstValuePreparation | null;
  },
): FirstValueRecommendation {
  return {
    ...patch,
    preparation: patch.preparation ?? null,
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
    resultAchievedAt: artifact.resultAchievedAt?.toISOString() ?? null,
    resultSource: artifact.resultSource,
    attribution: attributeArtifactToPurchase(artifact, {
      subjectUserId,
      purchaseConfirmedAt: purchase?.confirmedAt ?? null,
    }),
  };
}

function resolvePreparation(
  definition: FirstValueLessonDefinition,
  availability: FirstValueDependencyAvailability | undefined,
): FirstValuePreparation {
  if (definition.eligibility === "unsupported") {
    return {
      status: "unprovable",
      dependency: definition.dependency,
      message: "Esta atividade não permite comprovar conquista verificável.",
    };
  }
  if (!definition.dependency) {
    return { status: "ready", dependency: null, message: null };
  }
  const ready = availability?.[definition.dependency] === true;
  if (ready) {
    return { status: "ready", dependency: definition.dependency, message: null };
  }
  if (definition.dependency === "project") {
    return {
      status: "needs_project",
      dependency: "project",
      message: "É necessário criar um projeto antes de gravar este resultado.",
    };
  }
  if (definition.dependency === "landing_page_project") {
    return {
      status: "needs_landing_page_project",
      dependency: "landing_page_project",
      message: "É necessário ter uma landing page do curso antes desta atividade.",
    };
  }
  return {
    status: "needs_campaign_import",
    dependency: "campaign_import",
    message: "É necessário importar dados da campanha antes de fechar este resultado.",
  };
}

function preparationCta(
  definition: FirstValueLessonDefinition,
  preparation: FirstValuePreparation,
): { label: string; href: string } {
  if (preparation.status === "needs_project") {
    return { label: "Criar projeto primeiro", href: "/app/projetos/novo" };
  }
  if (preparation.status === "needs_campaign_import") {
    return { label: "Importar dados da campanha", href: "/app/projetos" };
  }
  if (preparation.status === "needs_landing_page_project") {
    return { label: "Preparar landing page", href: definition.startPath };
  }
  if (preparation.status === "unprovable") {
    return { label: "Abrir aula", href: definition.startPath };
  }
  return { label: "Começar meu resultado", href: definition.startPath };
}

function pickArtifactForLesson(
  input: FirstValueSelectInput,
  definition: FirstValueLessonDefinition,
  purchase: FirstValuePurchase,
): FirstValueArtifact | null {
  return pickOwnedArtifact(input.artifacts, {
    subjectUserId: input.subjectUserId,
    lessonSlug: definition.lessonSlug,
    evidenceKind: definition.evidenceKind,
    purchaseConfirmedAt: purchase.confirmedAt,
  });
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
      const artifact = pickArtifactForLesson(input, definition, purchase);
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
      if (!row.artifact || !isVerifiedAchievement(row.artifact)) return true;
      const attribution = attributeArtifactToPurchase(row.artifact, {
        subjectUserId: input.subjectUserId,
        purchaseConfirmedAt: purchase.confirmedAt,
      });
      return attribution === "before_purchase" || attribution === "preexisting_edited" || attribution === "unknown";
    })
    .filter((row) => !progressView(row.progress).completed || !row.artifact || !isVerifiedAchievement(row.artifact))
    .sort(
      (a, b) =>
        a.definition.firstValueRank - b.definition.firstValueRank ||
        a.definition.position - b.definition.position ||
        a.definition.lessonSlug.localeCompare(b.definition.lessonSlug),
    );
  if (withoutAchievement[0]) return withoutAchievement[0];

  const withAchievement = scored
    .filter((row) => row.artifact && isVerifiedAchievement(row.artifact))
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

  if (purchase.status === "NEEDS_REVIEW") {
    return recommendationBase(purchase, {
      state: "access_unavailable",
      activity: null,
      expectedOutcome: null,
      cta: { label: "Ver meu pedido", href: `/app/compras/${purchase.orderId}` },
      progress: null,
      existingResult: null,
      reason: "Pedido em NEEDS_REVIEW: sem liberar acesso nem declarar conquista pós-compra.",
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
      const historical = pickArtifactForLesson(input, only, purchase);
      if (historical && isVerifiedAchievement(historical)) {
        const attribution = attributeArtifactToPurchase(historical, {
          subjectUserId: input.subjectUserId,
          purchaseConfirmedAt: purchase.confirmedAt,
        });
        if (attribution === "after_purchase") {
          return recommendationBase(purchase, {
            state: "first_value_achieved",
            activity: activityFrom(only),
            expectedOutcome: only.pedagogicalOutcome,
            cta: { label: "Ver meus cursos", href: "/app" },
            progress: progressView(progressFor(input.progress, only.lessonSlug)),
            existingResult: existingResultView(historical, purchase, input.subjectUserId),
            reason: "Conquista histórica reconhecida; aula indisponível/publicação ausente — sem CTA de acesso pago.",
            fallback: false,
          });
        }
      }
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
      const artifact = pickArtifactForLesson(input, definition, purchase);
      if (!artifact || !isVerifiedAchievement(artifact)) return null;
      const attribution = attributeArtifactToPurchase(artifact, {
        subjectUserId: input.subjectUserId,
        purchaseConfirmedAt: purchase.confirmedAt,
      });
      if (attribution !== "after_purchase") return null;
      return {
        definition,
        artifact,
        progress: progressFor(input.progress, definition.lessonSlug),
        accessible: lessonAccessible({ definition, entitlements: input.entitlements, published }),
      };
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
      const nextPrep = resolvePreparation(next.definition, input.dependencyAvailability);
      const nextCta =
        nextPrep.status === "ready"
          ? {
              label: progressView(next.progress).inProgress ? "Continuar evolução" : "Próximo resultado",
              href: next.definition.startPath,
            }
          : preparationCta(next.definition, nextPrep);
      return recommendationBase(purchase, {
        state: "next_evolution",
        activity: activityFrom(next.definition),
        expectedOutcome: next.definition.pedagogicalOutcome,
        cta: nextCta,
        progress: progressView(next.progress),
        existingResult: existingResultView(primary.artifact, purchase, input.subjectUserId),
        preparation: nextPrep,
        reason: `Primeira conquista verificável em ${primary.definition.lessonSlug}; evoluir para ${next.definition.lessonSlug}.`,
        fallback: false,
      });
    }
    if (primary.accessible) {
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
    return recommendationBase(purchase, {
      state: "first_value_achieved",
      activity: activityFrom(primary.definition),
      expectedOutcome: primary.definition.pedagogicalOutcome,
      cta: { label: "Ver meus cursos", href: "/app" },
      progress: progressView(primary.progress),
      existingResult: existingResultView(primary.artifact, purchase, input.subjectUserId),
      reason: `Conquista histórica em ${primary.definition.lessonSlug} reconhecida; acesso atual indisponível — sem CTA pago.`,
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
  const preparation = resolvePreparation(definition, input.dependencyAvailability);

  if (view.inProgress) {
    return recommendationBase(purchase, {
      state: "in_progress",
      activity: activityFrom(definition),
      expectedOutcome: definition.pedagogicalOutcome,
      cta: { label: "Continuar aula", href: definition.startPath },
      progress: view,
      existingResult: existing,
      preparation,
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
      preparation,
      reason: "Resultado preexistente não atribuído à nova compra; oferecer revisão honesta.",
      fallback: false,
    });
  }

  if (existing && existing.attribution === "unknown") {
    return recommendationBase(purchase, {
      state: "continuation",
      activity: activityFrom(definition),
      expectedOutcome: definition.pedagogicalOutcome,
      cta: { label: "Revisar evidência", href: definition.startPath },
      progress: view,
      existingResult: existing,
      preparation,
      reason: "Timestamp do resultado não comprovável; não declara conquista pós-compra.",
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
      preparation,
      reason: "Sem artefato verificável; continuação pedagógica honesta (não inventa conquista).",
      fallback: true,
    });
  }

  if (preparation.status !== "ready") {
    return recommendationBase(purchase, {
      state: "ready_to_start",
      activity: activityFrom(definition),
      expectedOutcome: definition.pedagogicalOutcome,
      cta: preparationCta(definition, preparation),
      progress: view,
      existingResult: existing,
      preparation,
      reason: preparation.message ?? "Preparação obrigatória antes do resultado.",
      fallback: false,
    });
  }

  return recommendationBase(purchase, {
    state: "ready_to_start",
    activity: activityFrom(definition),
    expectedOutcome: definition.pedagogicalOutcome,
    cta: { label: "Começar meu resultado", href: definition.startPath },
    progress: view,
    existingResult: existing,
    preparation,
    reason: "Atividade elegível do produto adquirido ainda não realizada.",
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
