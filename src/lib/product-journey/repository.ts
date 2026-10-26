import { getPrisma } from "@/lib/db/prisma";
import type { JourneyInsert } from "@/lib/product-journey/ingest";
import type { JourneyRetentionRepository } from "@/lib/product-journey/retention";

export async function insertJourneyEvent(row: JourneyInsert): Promise<void> {
  await getPrisma().journeyEvent.create({
    data: {
      eventId: row.eventId,
      eventName: row.eventName,
      userId: row.userId,
      anonymousId: row.anonymousId,
      sessionId: row.sessionId,
      courseSlug: row.courseSlug,
      lessonSlug: row.lessonSlug,
      sourceCourseSlug: row.sourceCourseSlug,
      targetCourseSlug: row.targetCourseSlug,
      scenario: row.scenario,
      ctaName: row.ctaName,
      sourcePath: row.sourcePath,
      targetPath: row.targetPath,
      utmSource: row.utmSource,
      utmMedium: row.utmMedium,
      utmCampaign: row.utmCampaign,
      utmContent: row.utmContent,
      utmTerm: row.utmTerm,
      leadSource: row.leadSource,
      leadMedium: row.leadMedium,
      landingPath: row.landingPath,
      referrerHost: row.referrerHost,
      consentUpdatedAt: row.consentUpdatedAt,
      occurredAt: row.occurredAt,
    },
  });
}

export function createPrismaJourneyRetentionRepository(): JourneyRetentionRepository {
  return {
    async countExpired(cutoff) {
      return getPrisma().journeyEvent.count({ where: { occurredAt: { lt: cutoff } } });
    },
    async deleteExpired(cutoff) {
      const result = await getPrisma().journeyEvent.deleteMany({ where: { occurredAt: { lt: cutoff } } });
      return result.count;
    },
  };
}
