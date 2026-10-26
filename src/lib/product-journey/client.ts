import { ATTRIBUTION_STORAGE_KEY, readStoredAttribution, type LeadAttribution } from "@/lib/attribution";
import { readOrCreateAnonymousId, readOrCreateSessionId } from "@/lib/product-journey/identity";
import { journeyPath } from "@/lib/product-journey/paths";
import type { StrategicJourneyEvent } from "@/lib/product-journey/events";

type JourneyParams = {
  course_slug?: string;
  lesson_slug?: string;
  source_course_slug?: string;
  target_course_slug?: string;
  scenario?: string;
  cta_name?: string;
};

const PARAM_KEYS = ["course_slug", "lesson_slug", "source_course_slug", "target_course_slug", "scenario", "cta_name"] as const;

export function journeyParamsFromAnalytics(params: Record<string, unknown>): JourneyParams {
  const picked: JourneyParams = {};
  for (const key of PARAM_KEYS) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) picked[key] = value.trim();
  }
  return picked;
}

function attributionForJourney(attribution: LeadAttribution): Omit<LeadAttribution, "gclid" | "fbclid"> {
  return {
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_content: attribution.utm_content,
    utm_term: attribution.utm_term,
    lead_source: attribution.lead_source,
    lead_medium: attribution.lead_medium,
    landing_page: journeyPath(attribution.landing_page),
    referrer: attribution.referrer,
  };
}

/** Envio best effort. Não chama trackEvent e não espera a resposta. */
export function persistJourneyEvent(input: {
  eventName: StrategicJourneyEvent;
  params: Record<string, unknown>;
  targetPath?: string;
  consentUpdatedAt: number;
}): void {
  try {
    const anonymousId = readOrCreateAnonymousId(window.localStorage, Date.now(), () => crypto.randomUUID());
    const sessionId = readOrCreateSessionId(window.sessionStorage, () => crypto.randomUUID());
    const picked = journeyParamsFromAnalytics(input.params);
    const attribution = attributionForJourney(readStoredAttribution(window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY)));
    const body = {
      eventId: crypto.randomUUID(),
      eventName: input.eventName,
      anonymousId,
      sessionId,
      courseSlug: picked.course_slug,
      lessonSlug: picked.lesson_slug,
      sourceCourseSlug: picked.source_course_slug,
      targetCourseSlug: picked.target_course_slug,
      scenario: picked.scenario,
      ctaName: picked.cta_name,
      sourcePath: window.location.pathname,
      targetPath: input.targetPath,
      attribution,
      analyticsConsent: true,
      consentUpdatedAt: input.consentUpdatedAt,
    };
    void fetch("/api/analytics/journey", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // A jornada nunca bloqueia a navegação nem a ação que o visitante acabou de fazer.
  }
}
