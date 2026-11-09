export {
  FIRST_VALUE_LESSON_CATALOG,
  firstValueLessonBySlug,
  firstValueLessonsForCourse,
  firstValueOptionsFromPurchaseLessons,
  type FirstValueLessonDefinition,
} from "@/lib/learning/first-value/catalog";
export {
  attributeArtifactToPurchase,
  buildFirstValueArtifact,
  isVerifiedAchievement,
  isVerifiedAchievementKind,
  pickOwnedArtifact,
} from "@/lib/learning/first-value/evidence";
export {
  FIRST_VALUE_RESULT_FIELD_KEYS,
  isValidPedagogicalPayload,
  isValidResultLessonPayload,
  matchesOwnedCompletedDiagnostic,
  parsePublicationLessonPayload,
  parseTrafficReadinessLink,
  readMutablePayloadCompletedAt,
  resolveTrustedResultAchievedAt,
  verifiedToolKeys,
} from "@/lib/learning/first-value/evidence-validate";
export { resolvePurchaseConfirmation } from "@/lib/learning/first-value/finance";
export {
  FIRST_VALUE_CATALOG_SLUGS,
  buildArtifactsFromRecords,
  buildDependencyAvailability,
  buildFirstValueSelectInput,
  buildPurchasesFromOrders,
  knownFirstValueLesson,
  type FirstValueLoaderRecords,
  type FirstValueOrderRecord,
} from "@/lib/learning/first-value/from-records";
export {
  loadFirstValueForAuthenticatedUser,
  loadFirstValueRecommendation,
  recommendFromFirstValueRecords,
} from "@/lib/learning/first-value/load";
export {
  firstValueCardHasPrivateKeys,
  presentFirstValueRecommendation,
  shouldSuppressLearningContinuation,
  type FirstValueCardTone,
  type FirstValueCardViewModel,
  type FirstValuePresentationState,
} from "@/lib/learning/first-value/present";
export { selectFirstValueAction } from "@/lib/learning/first-value/select";
export {
  FIRST_VALUE_STATES,
  type FirstValueArtifact,
  type FirstValueAttribution,
  type FirstValueConfirmedAtSource,
  type FirstValueDependency,
  type FirstValueDependencyAvailability,
  type FirstValueEligibility,
  type FirstValueEntitlement,
  type FirstValueEvidenceKind,
  type FirstValueOrderStatus,
  type FirstValuePreparation,
  type FirstValuePreparationStatus,
  type FirstValueProgress,
  type FirstValuePurchase,
  type FirstValueRecommendation,
  type FirstValueResultSource,
  type FirstValueSelectInput,
  type FirstValueState,
} from "@/lib/learning/first-value/types";
