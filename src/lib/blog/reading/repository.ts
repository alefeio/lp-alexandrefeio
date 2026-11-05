import { getPrisma } from "@/lib/db/prisma";
import { BlogReadingConflict, type BlogReadingStore } from "@/lib/blog/reading/ingest";
import type { BlogClickRecord, BlogReadingRecord } from "@/lib/blog/reading/lifecycle";
import type { BlogReadingRetentionRepository } from "@/lib/blog/reading/retention";

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

function toSession(row: {
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
  consentUpdatedAt: Date;
}): BlogReadingRecord {
  return row;
}

export function createPrismaBlogReadingStore(): BlogReadingStore {
  const prisma = () => getPrisma();
  return {
    async findSession(clientReadingId) {
      const row = await prisma().blogReadingSession.findUnique({ where: { clientReadingId } });
      return row ? toSession(row) : null;
    },
    async insertSession(row) {
      try {
        await prisma().blogReadingSession.create({ data: sessionData(row) });
      } catch (error) {
        if (isUniqueConstraint(error)) throw new BlogReadingConflict();
        throw error;
      }
    },
    async saveSession(row) {
      const result = await prisma().blogReadingSession.updateMany({
        where: {
          id: row.id,
          clientReadingId: row.clientReadingId,
          anonymousId: row.anonymousId,
          sessionId: row.sessionId,
          blogPostId: row.blogPostId,
        },
        data: {
          lastActivityAt: row.lastActivityAt,
          endedAt: row.endedAt,
          activeTimeMs: row.activeTimeMs,
          maxScrollPercent: row.maxScrollPercent,
          reachedEndAt: row.reachedEndAt,
        },
      });
      return result.count === 1;
    },
    async findClick(eventId) {
      const row = await prisma().blogCommercialClick.findUnique({ where: { eventId }, select: { readingSessionId: true } });
      return row;
    },
    async insertClick(row: BlogClickRecord) {
      try {
        await prisma().blogCommercialClick.create({
          data: {
            id: row.id,
            eventId: row.eventId,
            readingSessionId: row.readingSessionId,
            blogPostId: row.blogPostId,
            ctaName: row.ctaName,
            destinationType: row.destinationType,
            targetPath: row.targetPath,
            occurredAt: row.occurredAt,
          },
        });
      } catch (error) {
        if (isUniqueConstraint(error)) throw new BlogReadingConflict();
        throw error;
      }
    },
  };
}

function sessionData(row: BlogReadingRecord) {
  return {
    id: row.id,
    clientReadingId: row.clientReadingId,
    blogPostId: row.blogPostId,
    slugObserved: row.slugObserved,
    anonymousId: row.anonymousId,
    sessionId: row.sessionId,
    startedAt: row.startedAt,
    lastActivityAt: row.lastActivityAt,
    endedAt: row.endedAt,
    activeTimeMs: row.activeTimeMs,
    maxScrollPercent: row.maxScrollPercent,
    reachedEndAt: row.reachedEndAt,
    referrerHost: row.referrerHost,
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    schemaVersion: row.schemaVersion,
    consentUpdatedAt: row.consentUpdatedAt,
  };
}

export async function findPublishedBlogPost(id: string): Promise<{ id: string; slug: string } | null> {
  return getPrisma().blogPost.findFirst({
    where: { id, status: "PUBLISHED" },
    select: { id: true, slug: true },
  });
}

export function createPrismaBlogReadingRetentionRepository(): BlogReadingRetentionRepository {
  return {
    async countExpired(cutoff) {
      return getPrisma().blogReadingSession.count({ where: { startedAt: { lt: cutoff } } });
    },
    async deleteExpired(cutoff) {
      return getPrisma().$transaction(async (tx) => {
        const expired = await tx.blogReadingSession.findMany({
          where: { startedAt: { lt: cutoff } },
          select: { id: true },
        });
        const ids = expired.map((row) => row.id);
        const clicks = ids.length === 0 ? { count: 0 } : await tx.blogCommercialClick.deleteMany({ where: { readingSessionId: { in: ids } } });
        const sessions = await tx.blogReadingSession.deleteMany({ where: { startedAt: { lt: cutoff } } });
        return { sessions: sessions.count, clicks: clicks.count };
      });
    },
  };
}
