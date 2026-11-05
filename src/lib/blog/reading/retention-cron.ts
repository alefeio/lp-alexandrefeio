import { blogReadingRetentionEnabled } from "@/lib/blog/reading/constants";
import type { BlogReadingRetentionReport } from "@/lib/blog/reading/retention";

const NO_STORE = { "cache-control": "no-store" };

export async function handleBlogReadingRetentionCron(
  request: Request,
  options: {
    secret: string | undefined;
    /** Quando omitido, lê BLOG_READING_RETENTION_ENABLED (padrão: desligado). */
    retentionEnabled?: boolean;
    run: () => Promise<BlogReadingRetentionReport>;
  },
): Promise<Response> {
  const secret = options.secret?.trim();
  if (!secret) return new Response("Cron não configurado.", { status: 503, headers: NO_STORE });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Não autorizado.", { status: 401, headers: NO_STORE });
  }
  const enabled = options.retentionEnabled ?? blogReadingRetentionEnabled();
  if (!enabled) {
    return Response.json({ status: "SKIPPED", reason: "BLOG_READING_RETENTION_ENABLED" }, { status: 200, headers: NO_STORE });
  }
  try {
    const report = await options.run();
    return Response.json(
      {
        mode: report.mode,
        cutoff: report.cutoff,
        expiredCount: report.expiredCount,
        deletedSessions: report.deletedSessions,
        deletedClicks: report.deletedClicks,
        batchesRun: report.batchesRun,
        truncated: report.truncated,
      },
      { headers: NO_STORE },
    );
  } catch {
    return new Response("Falha na manutenção.", { status: 500, headers: NO_STORE });
  }
}
