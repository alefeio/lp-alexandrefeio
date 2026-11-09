import { ATTRIBUTION_STORAGE_KEY, readStoredAttribution, type LeadAttribution } from "@/lib/attribution";
import { CONSENT_STORAGE_KEY, parseConsent } from "@/lib/consent";
import { isSiteFirstInteractionTrigger, type StrategicJourneyEvent } from "@/lib/product-journey/events";
import {
  JOURNEY_FIRST_INTERACTION_KEY,
  nextClientOccurredAt,
  readOrCreateAnonymousId,
  readOrCreateSessionId,
} from "@/lib/product-journey/identity";
import { journeyPath } from "@/lib/product-journey/paths";
import { journeyObservedPath } from "@/lib/product-journey/public-path";

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

function firstInteractionAlreadyRecorded(session: Storage, sessionId: string): boolean {
  return session.getItem(JOURNEY_FIRST_INTERACTION_KEY) === sessionId;
}

function markFirstInteractionRecorded(session: Storage, sessionId: string): void {
  session.setItem(JOURNEY_FIRST_INTERACTION_KEY, sessionId);
}

function sendJourneyBody(body: Record<string, unknown>): void {
  void fetch("/api/analytics/journey", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined);
}

function baseBody(input: {
  eventName: StrategicJourneyEvent;
  anonymousId: string;
  sessionId: string;
  picked: JourneyParams;
  attribution: ReturnType<typeof attributionForJourney>;
  sourcePath: string | undefined;
  targetPath?: string;
  consentUpdatedAt: number;
  clientOccurredAt: number;
}) {
  return {
    eventId: crypto.randomUUID(),
    eventName: input.eventName,
    anonymousId: input.anonymousId,
    sessionId: input.sessionId,
    courseSlug: input.picked.course_slug,
    lessonSlug: input.picked.lesson_slug,
    sourceCourseSlug: input.picked.source_course_slug,
    targetCourseSlug: input.picked.target_course_slug,
    scenario: input.picked.scenario,
    ctaName: input.picked.cta_name,
    sourcePath: input.sourcePath,
    targetPath: input.targetPath,
    attribution: input.attribution,
    analyticsConsent: true,
    consentUpdatedAt: input.consentUpdatedAt,
    clientOccurredAt: input.clientOccurredAt,
  };
}

/** Envio best effort. Não chama trackEvent e não espera a resposta. */
export function persistJourneyEvent(input: {
  eventName: StrategicJourneyEvent;
  params: Record<string, unknown>;
  targetPath?: string;
  sourcePathOverride?: string;
  consentUpdatedAt: number;
  skipFirstInteractionHook?: boolean;
  skipSessionEntryPageView?: boolean;
}): void {
  try {
    if (typeof window === "undefined") return;
    const consent = parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    if (!consent?.analytics) return;

    const now = Date.now();
    const anonymousId = readOrCreateAnonymousId(window.localStorage, now, () => crypto.randomUUID());
    const session = readOrCreateSessionId(window.sessionStorage, () => crypto.randomUUID(), now);
    const sessionId = session.id;
    const picked = journeyParamsFromAnalytics(input.params);
    const attribution = attributionForJourney(readStoredAttribution(window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY)));
    const sourcePath = journeyPath(input.sourcePathOverride) ?? journeyPath(window.location.pathname);

    if (session.renewed) {
      window.sessionStorage.removeItem(JOURNEY_FIRST_INTERACTION_KEY);
      if (!input.skipSessionEntryPageView && input.eventName !== "site_page_view") {
        const entryPath = journeyObservedPath(window.location.pathname);
        if (entryPath) {
          sendJourneyBody(
            baseBody({
              eventName: "site_page_view",
              anonymousId,
              sessionId,
              picked: {},
              attribution,
              sourcePath: entryPath,
              consentUpdatedAt: input.consentUpdatedAt,
              clientOccurredAt: nextClientOccurredAt(window.sessionStorage, now),
            }),
          );
        }
      }
    }

    const body = baseBody({
      eventName: input.eventName,
      anonymousId,
      sessionId,
      picked,
      attribution,
      sourcePath,
      targetPath: input.targetPath,
      consentUpdatedAt: input.consentUpdatedAt,
      clientOccurredAt: nextClientOccurredAt(window.sessionStorage, now),
    });
    sendJourneyBody(body);

    if (
      input.skipFirstInteractionHook ||
      input.eventName === "site_first_interaction" ||
      input.eventName === "site_page_view" ||
      !isSiteFirstInteractionTrigger(input.eventName)
    ) {
      return;
    }
    if (firstInteractionAlreadyRecorded(window.sessionStorage, sessionId)) return;
    markFirstInteractionRecorded(window.sessionStorage, sessionId);
    sendJourneyBody({
      ...body,
      eventId: crypto.randomUUID(),
      eventName: "site_first_interaction",
      ctaName: picked.cta_name,
      targetPath: input.targetPath,
      clientOccurredAt: nextClientOccurredAt(window.sessionStorage, now),
    });
  } catch {
    // A jornada nunca bloqueia a navegação nem a ação que o visitante acabou de fazer.
  }
}
