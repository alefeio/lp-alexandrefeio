export {
  FIRST_VALUE_LESSON_CATALOG,
  firstValueLessonBySlug,
  firstValueLessonsForCourse,
  firstValueOptionsFromPurchaseLessons,
  type FirstValueLessonDefinition,
} from "@/lib/learning/first-value/catalog";
export { attributeArtifactToPurchase, isVerifiedAchievementKind, pickOwnedArtifact } from "@/lib/learning/first-value/evidence";
export { selectFirstValueAction } from "@/lib/learning/first-value/select";
export {
  FIRST_VALUE_STATES,
  type FirstValueArtifact,
  type FirstValueAttribution,
  type FirstValueEligibility,
  type FirstValueEntitlement,
  type FirstValueEvidenceKind,
  type FirstValueProgress,
  type FirstValuePurchase,
  type FirstValueRecommendation,
  type FirstValueSelectInput,
  type FirstValueState,
} from "@/lib/learning/first-value/types";
