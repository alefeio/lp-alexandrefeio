/**
 * Decisões e progressão da jornada. Visualização genérica fica só no GA4.
 * JourneyEvent não é a verdade de Order, Payment, LessonProgress, Diagnostic, Entitlement, User nem LandingPageProject.
 * sign_up aqui é a cópia analítica do cadastro concluído. Better Auth continua sendo a autoridade da conta.
 * A ausência de purchase_completed aqui não significa que a compra não existiu.
 * anonymousId identifica o navegador ou perfil, não uma pessoa, e não equivale a userId.
 * site_page_view / site_first_interaction / site_cta_click cobrem entrada e engajamento inicial (J2-A).
 */
export const STRATEGIC_JOURNEY_EVENTS = [
  "site_page_view",
  "site_first_interaction",
  "site_cta_click",
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
  "sign_up",
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

/** Eventos GA cujo clique comercial vira `site_cta_click` first-party (sem duplicar strategic específico). */
export const SITE_CTA_BRIDGE_EVENTS = [
  "cta_click",
  "auth_cta_click",
  "whatsapp_click",
  "course_cta_click",
  "service_from_course_click",
] as const;

export type SiteCtaBridgeEvent = (typeof SITE_CTA_BRIDGE_EVENTS)[number];

const SITE_CTA_BRIDGE = new Set<string>(SITE_CTA_BRIDGE_EVENTS);

export function isSiteCtaBridgeEvent(event: string): event is SiteCtaBridgeEvent {
  return SITE_CTA_BRIDGE.has(event);
}

/** Cliques / decisões que contam como primeira interação significativa da sessão. */
export const SITE_FIRST_INTERACTION_TRIGGERS = [
  "site_cta_click",
  "home_course_path_click",
  "course_catalog_path_click",
  "course_catalog_click",
  "course_complementary_click",
  "course_free_start",
  "service_interest",
  "diagnostic_started",
  "checkout_started",
  "sign_up",
] as const;

const FIRST_INTERACTION = new Set<string>(SITE_FIRST_INTERACTION_TRIGGERS);

export function isSiteFirstInteractionTrigger(event: string): boolean {
  return FIRST_INTERACTION.has(event);
}
