/**
 * Decisões e progressão da jornada. Visualização genérica fica só no GA4.
 * JourneyEvent não é a verdade de Order, Payment, LessonProgress, Diagnostic, Entitlement nem LandingPageProject.
 * A ausência de purchase_completed aqui não significa que a compra não existiu.
 * anonymousId identifica o navegador ou perfil, não uma pessoa, e não equivale a userId.
 */
export const STRATEGIC_JOURNEY_EVENTS = [
  "home_course_path_click",
  "course_catalog_path_click",
  "course_catalog_click",
  "course_view",
  "course_complementary_click",
  "course_free_start",
  "lesson_started",
  "lesson_completed",
  "diagnostic_started",
  "diagnostic_completed",
  "checkout_started",
  "purchase_completed",
  "service_interest",
] as const;

export type StrategicJourneyEvent = (typeof STRATEGIC_JOURNEY_EVENTS)[number];

const STRATEGIC = new Set<string>(STRATEGIC_JOURNEY_EVENTS);

export function isStrategicJourneyEvent(event: string): event is StrategicJourneyEvent {
  return STRATEGIC.has(event);
}

/** Continuam no dataLayer e não entram no PostgreSQL nesta versão. */
export const GA_ONLY_ANALYTICS_EVENTS = [
  "curriculum_lesson_expand",
  "course_cta_click",
  "lesson_paywall_view",
  "lesson_public_preview_view",
  "course_catalog_view",
] as const;
