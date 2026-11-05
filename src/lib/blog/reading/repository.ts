import { getPrisma } from "@/lib/db/prisma";
import type { BlogReadingCommit, BlogReadingCommitResult, BlogReadingStore } from "@/lib/blog/reading/ingest";
import type { BlogReadingRecord } from "@/lib/blog/reading/lifecycle";
import type { BlogReadingRetentionRepository } from "@/lib/blog/reading/retention";

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

function toSession(row: BlogReadingRecord): BlogReadingRecord {
  return row;
}

function versionWhere(row: BlogReadingRecord) {
  return {
    id: row.id,
    recordVersion: row.recordVersion - 1,
    clientReadingId: row.clientReadingId,
    anonymousId: row.anonymousId,
    sessionId: row.sessionId,
    blogPostId: row.blogPostId,
    endedAt: null,
    activeTimeMs: { lte: row.activeTimeMs },
    maxScrollPercent: { lte: row.maxScrollPercent },
    ...(row.reachedEndAt === null ? { reachedEndAt: null } : {}),
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
    recordVersion: row.recordVersion,
    consentUpdatedAt: row.consentUpdatedAt,
  };
}

export function createPrismaBlogReadingStore(): BlogReadingStore {
  const prisma = () => getPrisma();
  return {
    async findSession(clientReadingId) {
      const row = await prisma().blogReadingSession.findUnique({ where: { clientReadingId } });
      return row ? toSession(row) : null;
    },
    async findClick(eventId) {
      return prisma().blogCommercialClick.findUnique({ where: { eventId }, select: { readingSessionId: true } });
    },
    async commit(input: BlogReadingCommit): Promise<BlogReadingCommitResult> {
      try {
        return await prisma().$transaction(async (tx) => {
          if (input.kind === "create") {
            await tx.blogReadingSession.create({ data: sessionData(input.session) });
          } else {
            const updated = await tx.blogReadingSession.updateMany({
              where: versionWhere(input.session),
              data: {
                recordVersion: input.session.recordVersion,
                lastActivityAt: input.session.lastActivityAt,
                endedAt: input.session.endedAt,
                activeTimeMs: input.session.activeTimeMs,
                maxScrollPercent: input.session.maxScrollPercent,
                reachedEndAt: input.session.reachedEndAt,
              },
            });
            if (updated.count !== 1) return "stale";
          }
          if (!input.click) return "applied";
          const current = await tx.blogCommercialClick.findUnique({
            where: { eventId: input.click.eventId },
            select: { readingSessionId: true },
          });
          if (current) return current.readingSessionId === input.session.id ? "applied" : "click-conflict";
          try {
            await tx.blogCommercialClick.create({
              data: {
                id: input.click.id,
                eventId: input.click.eventId,
                readingSessionId: input.click.readingSessionId,
                blogPostId: input.click.blogPostId,
                ctaName: input.click.ctaName,
                destinationType: input.click.destinationType,
                targetPath: input.click.targetPath,
                occurredAt: input.click.occurredAt,
              },
            });
          } catch (error) {
            if (!isUniqueConstraint(error)) throw error;
            const winner = await tx.blogCommercialClick.findUnique({
              where: { eventId: input.click.eventId },
              select: { readingSessionId: true },
            });
            if (winner?.readingSessionId === input.session.id) return "applied";
            return "click-conflict";
          }
          return "applied";
        });
      } catch (error) {
        if (isUniqueConstraint(error)) return "stale";
        throw error;
      }
    },
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
    async deleteBatch(cutoff, limit) {
      const expired = await getPrisma().blogReadingSession.findMany({
        where: { startedAt: { lt: cutoff } },
        select: { id: true },
        orderBy: { startedAt: "asc" },
        take: limit,
      });
      if (expired.length === 0) return { sessions: 0, clicks: 0, fetched: 0 };
      const ids = expired.map((row) => row.id);
      const deleted = await getPrisma().$transaction(async (tx) => {
        const clicks = await tx.blogCommercialClick.deleteMany({ where: { readingSessionId: { in: ids } } });
        const sessions = await tx.blogReadingSession.deleteMany({ where: { id: { in: ids }, startedAt: { lt: cutoff } } });
        return { sessions: sessions.count, clicks: clicks.count };
      });
      return { ...deleted, fetched: expired.length };
    },
  };
}
