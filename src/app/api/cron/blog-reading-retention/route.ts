import { blogReadingRetentionEnabled } from "@/lib/blog/reading/constants";
import { handleBlogReadingRetentionCron } from "@/lib/blog/reading/retention-cron";
import { createPrismaBlogReadingRetentionRepository } from "@/lib/blog/reading/repository";
import { runBlogReadingRetention } from "@/lib/blog/reading/retention";

export const dynamic = "force-dynamic";
/** Orçamento alinhado ao teto de lotes; o plano pode limitar abaixo disso. */
export const maxDuration = 60;

export function GET(request: Request) {
  return handleBlogReadingRetentionCron(request, {
    secret: process.env.CRON_SECRET,
    retentionEnabled: blogReadingRetentionEnabled(),
    run: () => runBlogReadingRetention({ execute: true, repository: createPrismaBlogReadingRetentionRepository() }),
  });
}
