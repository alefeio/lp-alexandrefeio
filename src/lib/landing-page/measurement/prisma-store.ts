import { getPrisma } from "@/lib/db/prisma";
import type { LandingPageMetricDailyRecord, LandingPageMetricIncrement, LandingPageMetricStore } from "@/lib/landing-page/measurement/metrics";

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toRecord(row: { landingPageProjectId: string; publicationId: string; date: Date; eventType: LandingPageMetricDailyRecord["eventType"]; count: number }): LandingPageMetricDailyRecord {
  return {
    landingPageProjectId: row.landingPageProjectId,
    publicationId: row.publicationId,
    date: row.date.toISOString().slice(0, 10),
    eventType: row.eventType,
    count: row.count,
  };
}

export function createPrismaLandingPageMetricStore(): LandingPageMetricStore {
  return {
    async increment(input: LandingPageMetricIncrement) {
      const date = dateOnly(input.date);
      const row = await getPrisma().landingPageMetricDaily.upsert({
        where: {
          landingPageProjectId_publicationId_date_eventType: {
            landingPageProjectId: input.landingPageProjectId,
            publicationId: input.publicationId,
            date,
            eventType: input.eventType,
          },
        },
        create: {
          landingPageProjectId: input.landingPageProjectId,
          publicationId: input.publicationId,
          date,
          eventType: input.eventType,
          count: 1,
        },
        update: { count: { increment: 1 } },
      });
      return toRecord(row);
    },
    async listForProject(landingPageProjectId) {
      const rows = await getPrisma().landingPageMetricDaily.findMany({ where: { landingPageProjectId } });
      return rows.map(toRecord);
    },
  };
}
