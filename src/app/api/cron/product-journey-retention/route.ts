import { handleJourneyRetentionCron } from "@/lib/product-journey/retention-cron";
import { createPrismaJourneyRetentionRepository } from "@/lib/product-journey/repository";
import { runJourneyRetention } from "@/lib/product-journey/retention";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleJourneyRetentionCron(request, {
    secret: process.env.CRON_SECRET,
    run: () => runJourneyRetention({ execute: true, repository: createPrismaJourneyRetentionRepository() }),
  });
}
