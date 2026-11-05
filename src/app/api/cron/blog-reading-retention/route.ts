import { handleBlogReadingRetentionCron } from "@/lib/blog/reading/retention-cron";
import { createPrismaBlogReadingRetentionRepository } from "@/lib/blog/reading/repository";
import { runBlogReadingRetention } from "@/lib/blog/reading/retention";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleBlogReadingRetentionCron(request, {
    secret: process.env.CRON_SECRET,
    run: () => runBlogReadingRetention({ execute: true, repository: createPrismaBlogReadingRetentionRepository() }),
  });
}
