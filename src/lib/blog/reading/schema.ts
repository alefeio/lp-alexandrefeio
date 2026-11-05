import { z } from "zod";
import { BLOG_READING_MAX_ACTIVE_MS, BLOG_READING_SCHEMA_VERSION } from "@/lib/blog/reading/constants";
import { journeyPath } from "@/lib/product-journey/paths";

const UUID = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const CUID = z.string().regex(/^c[a-z0-9]{24}$/);
const CTA = z.string().regex(/^[a-z0-9_-]{1,80}$/);

const bodySchema = z
  .object({
    schemaVersion: z.literal(BLOG_READING_SCHEMA_VERSION),
    clientReadingId: UUID,
    blogPostId: CUID,
    anonymousId: UUID,
    sessionId: UUID,
    activeTimeMs: z.number().int().min(0).max(BLOG_READING_MAX_ACTIVE_MS),
    maxScrollPercent: z.number().int().min(0).max(100),
    reachedEnd: z.boolean(),
    ended: z.boolean(),
    analyticsConsent: z.literal(true),
    consentUpdatedAt: z.number().finite(),
    attribution: z
      .object({
        utm_source: z.string().max(100).optional(),
        utm_medium: z.string().max(100).optional(),
        utm_campaign: z.string().max(100).optional(),
        referrer: z.string().max(500).optional(),
      })
      .strict()
      .optional(),
    click: z
      .object({
        eventId: UUID,
        ctaName: CTA,
        destinationType: z.enum(["course", "service"]),
        targetPath: z.string().max(300).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type BlogReadingCommand = {
  schemaVersion: number;
  clientReadingId: string;
  blogPostId: string;
  anonymousId: string;
  sessionId: string;
  activeTimeMs: number;
  maxScrollPercent: number;
  reachedEnd: boolean;
  ended: boolean;
  consentUpdatedAt: Date;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  click: { eventId: string; ctaName: string; destinationType: "course" | "service"; targetPath: string | null } | null;
};

function clean(value: string | undefined, max: number): string | null | undefined {
  if (!value) return null;
  const trimmed = value.replace(/[\r\n]+/g, " ").trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) return undefined;
  return trimmed.slice(0, max);
}

function referrerHost(value: string | undefined): string | null | undefined {
  const cleaned = clean(value, 500);
  if (cleaned === undefined) return undefined;
  if (!cleaned) return null;
  try {
    if (cleaned.includes("://")) {
      const host = new URL(cleaned).host;
      return host ? host.slice(0, 255) : null;
    }
  } catch {
    return undefined;
  }
  if (cleaned.includes("/") || cleaned.includes("?") || cleaned.includes(" ")) return undefined;
  return cleaned.slice(0, 255);
}

export function parseBlogReading(input: unknown, now: number): { ok: true; value: BlogReadingCommand } | { ok: false } {
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  if (parsed.data.consentUpdatedAt <= 0 || parsed.data.consentUpdatedAt > now + 24 * 60 * 60 * 1000) return { ok: false };
  const attribution = parsed.data.attribution;
  const utmSource = clean(attribution?.utm_source, 100);
  const utmMedium = clean(attribution?.utm_medium, 100);
  const utmCampaign = clean(attribution?.utm_campaign, 100);
  const host = referrerHost(attribution?.referrer);
  if (utmSource === undefined || utmMedium === undefined || utmCampaign === undefined || host === undefined) return { ok: false };
  let targetPath: string | null = null;
  if (parsed.data.click?.targetPath) {
    const path = journeyPath(parsed.data.click.targetPath);
    if (!path) return { ok: false };
    targetPath = path;
  }
  return {
    ok: true,
    value: {
      schemaVersion: parsed.data.schemaVersion,
      clientReadingId: parsed.data.clientReadingId,
      blogPostId: parsed.data.blogPostId,
      anonymousId: parsed.data.anonymousId,
      sessionId: parsed.data.sessionId,
      activeTimeMs: parsed.data.activeTimeMs,
      maxScrollPercent: parsed.data.maxScrollPercent,
      reachedEnd: parsed.data.reachedEnd,
      ended: parsed.data.ended,
      consentUpdatedAt: new Date(parsed.data.consentUpdatedAt),
      referrerHost: host,
      utmSource,
      utmMedium,
      utmCampaign,
      click: parsed.data.click
        ? {
            eventId: parsed.data.click.eventId,
            ctaName: parsed.data.click.ctaName,
            destinationType: parsed.data.click.destinationType,
            targetPath,
          }
        : null,
    },
  };
}

export function isBlogReadingPrefetch(headers: { get(name: string): string | null }): boolean {
  const purpose = `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""} ${headers.get("x-purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch")) return true;
  const next = headers.get("next-router-prefetch") ?? headers.get("x-middleware-prefetch");
  return next === "1" || next === "true";
}
