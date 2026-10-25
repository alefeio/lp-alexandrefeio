import { getPrisma } from "@/lib/db/prisma";
import type { LandingPageRetentionRepository } from "@/lib/landing-page/retention/service";

/** deleteMany remove pelo corte. O corte de lead ignora status e updatedAt. */
export function createPrismaLandingPageRetentionRepository(): LandingPageRetentionRepository {
  return {
    countExpiredLeads(cutoff) {
      return getPrisma().landingPageLead.count({ where: { createdAt: { lt: cutoff } } });
    },
    async deleteExpiredLeads(cutoff) {
      const result = await getPrisma().landingPageLead.deleteMany({ where: { createdAt: { lt: cutoff } } });
      return result.count;
    },
    countExpiredMetrics(cutoff) {
      return getPrisma().landingPageMetricDaily.count({ where: { date: { lt: cutoff } } });
    },
    async deleteExpiredMetrics(cutoff) {
      const result = await getPrisma().landingPageMetricDaily.deleteMany({ where: { date: { lt: cutoff } } });
      return result.count;
    },
  };
}
