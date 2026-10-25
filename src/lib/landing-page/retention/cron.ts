import type { LandingPageRetentionReport } from "@/lib/landing-page/retention/service";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * O Vercel Cron chama GET. A exclusão só começa depois do Bearer.
 * A resposta fica restrita às contagens.
 */
export async function handleLandingRetentionCron(
  request: Request,
  options: {
    secret: string | undefined;
    run: () => Promise<LandingPageRetentionReport>;
  },
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
        expiredLeads: report.expiredLeads,
        expiredMetricRows: report.expiredMetricRows,
        deletedLeads: report.deletedLeads,
        deletedMetricRows: report.deletedMetricRows,
      },
      { headers: NO_STORE },
    );
  } catch {
    return new Response("Falha na manutenção.", { status: 500, headers: NO_STORE });
  }
}
