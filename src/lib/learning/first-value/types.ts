/**
 * Contrato ACT-1A / ACT-1A.1: primeira conquista prática pós-compra.
 * Estados são derivados de Order / Entitlement / LessonProgress / artefatos — sem máquina persistida.
 */

export const FIRST_VALUE_STATES = [
  "payment_pending",
  "access_pending",
  "ready_to_start",
  "in_progress",
  "first_value_achieved",
  "next_evolution",
  "continuation",
  "access_unavailable",
] as const;

export type FirstValueState = (typeof FIRST_VALUE_STATES)[number];

export type FirstValueEligibility =
  | "verified_artifact"
  | "learning_progress_only"
  | "requires_dependency"
  | "unsupported";

/**
 * Kind operacional. `landing_page_draft` e `landing_page_project_shell` NÃO são conquista:
 * criação de LandingPageProject ≠ brief/wireframe/copy/revisão concluídos.
 */
export type FirstValueEvidenceKind =
  | "lesson_result_personal"
  | "lesson_result_project"
  | "diagnostic_completed"
  | "landing_page_draft"
  | "landing_page_project_shell"
  | "landing_page_published"
  | "lesson_progress_complete"
  | "none";

/** Origem do instante usado em atribuição temporal. */
export type FirstValueResultSource =
  | "lesson_result_created_at"
  | "lesson_response_created_at"
  | "diagnostic_completed_at"
  | "landing_page_publication_published_at"
  | "payload_completed_at"
  | "unproven"
  | "unknown";

export type FirstValueDependency = "project" | "landing_page_project" | "campaign_import" | null;

export type FirstValueAuthority =
  | "LessonResult"
  | "LessonResponse"
  | "Diagnostic"
  | "LandingPageProject"
  | "LandingPagePublication"
  | "LessonProgress"
  | null;

export type FirstValueProductType = "LESSON" | "MODULE" | "COURSE";

/** Alinhado a `OrderStatus` do Prisma — sem inventar EXPIRED. */
export type FirstValueOrderStatus = "PENDING_PAYMENT" | "PAID" | "CANCELLED" | "REFUNDED" | "NEEDS_REVIEW";

/**
 * Origem documentada de `confirmedAt` (loader ACT-1B):
 * - pagamento aprovado: `Payment.approvedAt` quando `Payment.status = APPROVED` e `Order.status = PAID`
 * - upgrade de valor zero: `Order.createdAt` no create com `zeroValueUpgrade` e status `PAID`
 * Nunca usar `Order.updatedAt` / revisão / NEEDS_REVIEW como confirmação financeira.
 */
export type FirstValueConfirmedAtSource = "payment_approved_at" | "zero_upgrade_created_at" | "unknown" | null;

export type FirstValuePurchase = {
  orderId: string;
  /** Identidade estável do OrderItem (pedido com vários itens). */
  orderItemId?: string | null;
  status: FirstValueOrderStatus;
  zeroValueUpgrade: boolean;
  /** Instantâneo de confirmação financeira comprovada; null se não comprovável. */
  confirmedAt: Date | null;
  confirmedAtSource?: FirstValueConfirmedAtSource;
  createdAt: Date;
  productType: FirstValueProductType;
  courseSlug: string | null;
  lessonSlugs: string[];
};

export type FirstValueEntitlement = {
  lessonSlug: string;
  status: "ACTIVE" | "REVOKED";
  grantedAt: Date;
};

export type FirstValueProgress = {
  lessonSlug: string;
  startedAt: Date | null;
  completedAt: Date | null;
  lastActiveAt: Date | null;
  percent: number;
};

/**
 * Evidência pedagógica por aula. O loader deve preencher `resultAchievedAt` só quando
 * houver prova do resultado (LessonResult/LessonResponse/Diagnostic.completedAt/Publication.publishedAt).
 * Shell de LandingPageProject → `kind: landing_page_project_shell`, `resultAchievedAt: null`.
 */
export type FirstValueArtifact = {
  id?: string;
  lessonSlug: string;
  kind: FirstValueEvidenceKind;
  userId: string;
  resultSource: FirstValueResultSource;
  /** Instantâneo do resultado pedagógico; null = atribuição unknown (nunca after_purchase). */
  resultAchievedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FirstValueDependencyAvailability = {
  project: boolean;
  landing_page_project: boolean;
  campaign_import: boolean;
};

export type FirstValuePreparationStatus = "ready" | "needs_project" | "needs_landing_page_project" | "needs_campaign_import" | "unprovable";

export type FirstValuePreparation = {
  status: FirstValuePreparationStatus;
  dependency: FirstValueDependency;
  message: string | null;
};

export type FirstValueSelectInput = {
  subjectUserId: string;
  now: Date;
  purchases: FirstValuePurchase[];
  entitlements: FirstValueEntitlement[];
  progress: FirstValueProgress[];
  artifacts: FirstValueArtifact[];
  /** Aulas publicadas e conhecidas no catálogo operacional. */
  publishedLessonSlugs: string[];
  /** Disponibilidade de pré-requisitos para CTA honesto (ACT-1B). */
  dependencyAvailability?: FirstValueDependencyAvailability;
};

export type FirstValueAttribution = "after_purchase" | "before_purchase" | "preexisting_edited" | "unknown" | "other_user";

export type FirstValueRecommendation = {
  state: FirstValueState;
  product: {
    orderId: string | null;
    orderItemId: string | null;
    productType: FirstValueProductType | null;
    courseSlug: string | null;
    zeroValueUpgrade: boolean;
  };
  activity: {
    lessonSlug: string;
    courseSlug: string;
    outcome: string;
    eligibility: FirstValueEligibility;
  } | null;
  expectedOutcome: string | null;
  cta: { label: string; href: string } | null;
  progress: { percent: number | null; inProgress: boolean; completed: boolean } | null;
  existingResult: {
    kind: FirstValueEvidenceKind;
    createdAt: string;
    updatedAt: string;
    resultAchievedAt: string | null;
    resultSource: FirstValueResultSource;
    attribution: FirstValueAttribution;
  } | null;
  preparation: FirstValuePreparation | null;
  reason: string;
  fallback: boolean;
};
