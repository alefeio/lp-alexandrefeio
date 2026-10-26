import type { JourneyRetentionReport } from "@/lib/product-journey/retention";

const NO_STORE = { "cache-control": "no-store" };

export async function handleJourneyRetentionCron(
  request: Request,
  options: { secret: string | undefined; run: () => Promise<JourneyRetentionReport> },
): Promise<Response> {
  const secret = options.secret?.trim();
  if (!secret) return new Response("Cron não configurado.", { status: 503, headers: NO_STORE });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Não autorizado.", { status: 401, headers: NO_STORE });
  }
  try {
    const report = await options.run();
    return Response.json(
      {
        mode: report.mode,
        cutoff: report.cutoff,
        expiredCount: report.expiredCount,
        deletedCount: report.deletedCount,
      },
      { headers: NO_STORE },
    );
  } catch {
    return new Response("Falha na manutenção.", { status: 500, headers: NO_STORE });
  }
}
