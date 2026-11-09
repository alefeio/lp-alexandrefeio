/**
 * Contrato ACT-1A: primeira conquista prática pós-compra.
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

export type FirstValueEvidenceKind =
  | "lesson_result_personal"
  | "lesson_result_project"
  | "diagnostic_completed"
  | "landing_page_draft"
  | "landing_page_published"
  | "lesson_progress_complete"
  | "none";

export type FirstValueDependency = "project" | "landing_page_project" | "campaign_import" | null;

export type FirstValueAuthority =
  | "LessonResult"
  | "Diagnostic"
  | "LandingPageProject"
  | "LandingPagePublication"
  | "LessonProgress"
  | null;

export type FirstValueProductType = "LESSON" | "MODULE" | "COURSE";

export type FirstValueOrderStatus = "PENDING_PAYMENT" | "PAID" | "CANCELLED" | "EXPIRED" | "REFUNDED";

export type FirstValuePurchase = {
  orderId: string;
  status: FirstValueOrderStatus;
  zeroValueUpgrade: boolean;
  /** Instantâneo de confirmação financeira (approvedAt do pagamento ou createdAt do zero-upgrade). */
  confirmedAt: Date | null;
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

export type FirstValueArtifact = {
  lessonSlug: string;
  kind: FirstValueEvidenceKind;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
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
};

export type FirstValueAttribution = "after_purchase" | "before_purchase" | "preexisting_edited" | "unknown" | "other_user";

export type FirstValueRecommendation = {
  state: FirstValueState;
  product: {
    orderId: string | null;
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
    attribution: FirstValueAttribution;
  } | null;
  reason: string;
  fallback: boolean;
};
