import {
  BLOG_READING_CLOCK_SKEW_MS,
  BLOG_READING_IDLE_MS,
  BLOG_READING_MAX_ACTIVE_MS,
  BLOG_READING_MAX_INCREMENT_MS,
  BLOG_READING_SCHEMA_VERSION,
} from "@/lib/blog/reading/constants";
import type { BlogReadingCommand } from "@/lib/blog/reading/schema";

export type BlogReadingRecord = {
  id: string;
  clientReadingId: string;
  blogPostId: string | null;
  slugObserved: string;
  anonymousId: string;
  sessionId: string;
  startedAt: Date;
  lastActivityAt: Date;
  endedAt: Date | null;
  activeTimeMs: number;
  maxScrollPercent: number;
  reachedEndAt: Date | null;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  schemaVersion: number;
  recordVersion: number;
  consentUpdatedAt: Date;
};

export type BlogClickRecord = {
  id: string;
  eventId: string;
  readingSessionId: string;
  blogPostId: string | null;
  ctaName: string;
  destinationType: "course" | "service";
  targetPath: string | null;
  occurredAt: Date;
};

export type BlogReadingDecision =
  | { kind: "noop" }
  | { kind: "reject"; status: 400 | 404 | 409 }
  | { kind: "seal"; session: BlogReadingRecord }
  | { kind: "write"; session: BlogReadingRecord; click: BlogClickRecord | null; created: boolean };

function sameIdentity(existing: BlogReadingRecord, command: BlogReadingCommand): boolean {
  return existing.anonymousId === command.anonymousId && existing.sessionId === command.sessionId && existing.blogPostId === command.blogPostId;
}

function plausible(existing: BlogReadingRecord, command: BlogReadingCommand, now: number): boolean {
  const increment = command.activeTimeMs - existing.activeTimeMs;
  if (increment > BLOG_READING_MAX_INCREMENT_MS) return false;
  if (command.activeTimeMs > BLOG_READING_MAX_ACTIVE_MS) return false;
  const elapsed = now - existing.startedAt.getTime() + BLOG_READING_CLOCK_SKEW_MS;
  return command.activeTimeMs <= elapsed;
}

export function decideBlogReading(input: {
  now: number;
  command: BlogReadingCommand;
  existing: BlogReadingRecord | null;
  published: { id: string; slug: string } | null;
  existingClick: { readingSessionId: string } | null;
  nextId: () => string;
}): BlogReadingDecision {
  const { now, command, existing } = input;
  if (existing) {
    if (!sameIdentity(existing, command)) return { kind: "reject", status: 409 };
    const idle = now - existing.lastActivityAt.getTime() >= BLOG_READING_IDLE_MS;
    if (existing.endedAt || idle) {
      if (existing.endedAt) return { kind: "reject", status: 409 };
      return {
        kind: "seal",
        session: {
          ...existing,
          recordVersion: existing.recordVersion + 1,
          endedAt: new Date(existing.lastActivityAt.getTime() + BLOG_READING_IDLE_MS),
        },
      };
    }
    const timeBack = command.activeTimeMs < existing.activeTimeMs;
    const scrollBack = command.maxScrollPercent < existing.maxScrollPercent;
    const endForward = command.reachedEnd && !existing.reachedEndAt;
    if (timeBack || scrollBack) {
      const sameClick = command.click !== null && input.existingClick?.readingSessionId === existing.id;
      const stale = timeBack && command.maxScrollPercent <= existing.maxScrollPercent && !endForward && (!command.click || sameClick);
      if (stale) return { kind: "noop" };
      return { kind: "reject", status: 409 };
    }
    if (!plausible(existing, command, now)) return { kind: "reject", status: 400 };
    const click = resolveClick(existing, command, input.existingClick, now, input.nextId);
    if (click === "reject") return { kind: "reject", status: 409 };
    const changed =
      command.activeTimeMs !== existing.activeTimeMs ||
      command.maxScrollPercent !== existing.maxScrollPercent ||
      endForward ||
      command.ended ||
      click !== null;
    if (!changed) return { kind: "noop" };
    return {
      kind: "write",
      created: false,
      click,
      session: {
        ...existing,
        recordVersion: existing.recordVersion + 1,
        lastActivityAt: new Date(now),
        activeTimeMs: command.activeTimeMs,
        maxScrollPercent: command.maxScrollPercent,
        reachedEndAt: endForward ? new Date(now) : existing.reachedEndAt,
        endedAt: command.ended ? new Date(now) : existing.endedAt,
      },
    };
  }

  if (command.activeTimeMs !== 0) return { kind: "reject", status: 400 };
  if (command.maxScrollPercent !== 0 || command.reachedEnd || command.ended) return { kind: "reject", status: 404 };
  if (!input.published || input.published.id !== command.blogPostId) return { kind: "reject", status: 404 };
  const session: BlogReadingRecord = {
    id: input.nextId(),
    clientReadingId: command.clientReadingId,
    blogPostId: input.published.id,
    slugObserved: input.published.slug.trim().toLowerCase().slice(0, 120),
    anonymousId: command.anonymousId,
    sessionId: command.sessionId,
    startedAt: new Date(now),
    lastActivityAt: new Date(now),
    endedAt: null,
    activeTimeMs: 0,
    maxScrollPercent: 0,
    reachedEndAt: null,
    referrerHost: command.referrerHost,
    utmSource: command.utmSource,
    utmMedium: command.utmMedium,
    utmCampaign: command.utmCampaign,
    schemaVersion: BLOG_READING_SCHEMA_VERSION,
    recordVersion: 0,
    consentUpdatedAt: command.consentUpdatedAt,
  };
  const click = resolveClick(session, command, input.existingClick, now, input.nextId);
  if (click === "reject") return { kind: "reject", status: 409 };
  return { kind: "write", created: true, session, click };
}

function resolveClick(
  session: BlogReadingRecord,
  command: BlogReadingCommand,
  existingClick: { readingSessionId: string } | null,
  now: number,
  nextId: () => string,
): BlogClickRecord | null | "reject" {
  if (!command.click) return null;
  if (existingClick) return existingClick.readingSessionId === session.id ? null : "reject";
  return {
    id: nextId(),
    eventId: command.click.eventId,
    readingSessionId: session.id,
    blogPostId: session.blogPostId,
    ctaName: command.click.ctaName,
    destinationType: command.click.destinationType,
    targetPath: command.click.targetPath,
    occurredAt: new Date(now),
  };
}
