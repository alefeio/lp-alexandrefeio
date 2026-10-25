import { handleLandingRetentionCron } from "@/lib/landing-page/retention/cron";
import { createPrismaLandingPageRetentionRepository } from "@/lib/landing-page/retention/prisma";
import { runLandingPageRetention } from "@/lib/landing-page/retention/service";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleLandingRetentionCron(request, {
    secret: process.env.CRON_SECRET,
    run: () =>
      runLandingPageRetention({
        execute: true,
        repository: createPrismaLandingPageRetentionRepository(),
      }),
  });
}
