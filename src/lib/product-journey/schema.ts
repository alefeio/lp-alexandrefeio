import { z } from "zod";
import { isStrategicJourneyEvent, type StrategicJourneyEvent } from "@/lib/product-journey/events";
import { journeyPath } from "@/lib/product-journey/paths";

const UUID = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const bodySchema = z
  .object({
    eventId: UUID,
    eventName: z.string().max(80),
    anonymousId: UUID,
    sessionId: UUID,
    courseSlug: z.string().max(120).optional(),
    lessonSlug: z.string().max(120).optional(),
    sourceCourseSlug: z.string().max(120).optional(),
    targetCourseSlug: z.string().max(120).optional(),
    scenario: z.string().max(100).optional(),
    ctaName: z.string().max(100).optional(),
    sourcePath: z.string().max(300).optional(),
    targetPath: z.string().max(300).optional(),
    attribution: z
      .object({
        utm_source: z.string().max(100).optional(),
        utm_medium: z.string().max(100).optional(),
        utm_campaign: z.string().max(100).optional(),
        utm_content: z.string().max(100).optional(),
        utm_term: z.string().max(100).optional(),
        lead_source: z.string().max(100).optional(),
        lead_medium: z.string().max(100).optional(),
        landing_page: z.string().max(300).optional(),
        referrer: z.string().max(500).optional(),
        gclid: z.string().max(200).optional(),
        fbclid: z.string().max(200).optional(),
      })
      .strict()
      .optional(),
    analyticsConsent: z.literal(true),
    consentUpdatedAt: z.number().finite(),
  })
  .strict();

export type JourneyEventRecord = {
  eventId: string;
  eventName: StrategicJourneyEvent;
  anonymousId: string;
  sessionId: string;
  courseSlug: string | null;
  lessonSlug: string | null;
  sourceCourseSlug: string | null;
  targetCourseSlug: string | null;
  scenario: string | null;
  ctaName: string | null;
  sourcePath: string | null;
  targetPath: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  leadSource: string | null;
  leadMedium: string | null;
  landingPath: string | null;
  referrerHost: string | null;
  consentUpdatedAt: Date;
};

function text(value: string | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.replace(/[\r\n]+/g, " ").trim();
  if (!trimmed || trimmed.includes("@")) return null;
  return trimmed.slice(0, max);
}

function referrerHost(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.includes("://")) {
      const host = new URL(trimmed).host;
      return host ? host.slice(0, 255) : null;
    }
  } catch {
    return null;
  }
  if (trimmed.includes("/") || trimmed.includes("?") || trimmed.includes(" ") || trimmed.includes("@")) return null;
  return trimmed.slice(0, 255);
}

export function parseJourneyEvent(input: unknown, now: number): { ok: true; value: JourneyEventRecord } | { ok: false } {
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  if (!isStrategicJourneyEvent(parsed.data.eventName)) return { ok: false };
  if (parsed.data.consentUpdatedAt <= 0 || parsed.data.consentUpdatedAt > now + 24 * 60 * 60 * 1000) return { ok: false };
  const attribution = parsed.data.attribution;
  return {
    ok: true,
    value: {
      eventId: parsed.data.eventId,
      eventName: parsed.data.eventName,
      anonymousId: parsed.data.anonymousId,
      sessionId: parsed.data.sessionId,
      courseSlug: text(parsed.data.courseSlug, 120),
      lessonSlug: text(parsed.data.lessonSlug, 120),
      sourceCourseSlug: text(parsed.data.sourceCourseSlug, 120),
      targetCourseSlug: text(parsed.data.targetCourseSlug, 120),
      scenario: text(parsed.data.scenario, 100),
      ctaName: text(parsed.data.ctaName, 100),
      sourcePath: journeyPath(parsed.data.sourcePath) ?? null,
      targetPath: journeyPath(parsed.data.targetPath) ?? null,
      utmSource: text(attribution?.utm_source, 100),
      utmMedium: text(attribution?.utm_medium, 100),
      utmCampaign: text(attribution?.utm_campaign, 100),
      utmContent: text(attribution?.utm_content, 100),
      utmTerm: text(attribution?.utm_term, 100),
      leadSource: text(attribution?.lead_source, 100),
      leadMedium: text(attribution?.lead_medium, 100),
      landingPath: journeyPath(attribution?.landing_page) ?? null,
      referrerHost: referrerHost(attribution?.referrer),
      consentUpdatedAt: new Date(parsed.data.consentUpdatedAt),
    },
  };
}
