import { leadRetentionCutoff, metricsRetentionCutoff } from "@/lib/landing-page/retention/policy";

export type LandingPageRetentionRepository = {
  countExpiredLeads(cutoff: Date): Promise<number>;
  deleteExpiredLeads(cutoff: Date): Promise<number>;
  countExpiredMetrics(cutoff: Date): Promise<number>;
  deleteExpiredMetrics(cutoff: Date): Promise<number>;
};

export type LandingPageRetentionReport = {
  mode: "DRY_RUN" | "EXECUTE";
  expiredLeads: number;
  expiredMetricRows: number;
  deletedLeads: number;
  deletedMetricRows: number;
};

/** Só contagens. Não inclui lead, formulário, e-mail nem identificador. */
export function formatLandingPageRetentionReport(report: LandingPageRetentionReport): string {
  return [
    `mode ${report.mode}`,
    `expired leads: ${report.expiredLeads}`,
    `expired metric rows: ${report.expiredMetricRows}`,
    `deleted leads: ${report.deletedLeads}`,
    `deleted metric rows: ${report.deletedMetricRows}`,
  ].join("\n");
}

/**
 * Dry-run por omissão. A exclusão de leads e a de métricas são independentes.
 * Se a segunda falhar, a primeira já confirmada permanece e a próxima execução retoma o restante.
 */
export async function runLandingPageRetention(input: {
  now?: Date;
  execute?: boolean;
  repository: LandingPageRetentionRepository;
}): Promise<LandingPageRetentionReport> {
  const now = input.now ?? new Date();
  const leadCutoff = leadRetentionCutoff(now);
  const metricCutoff = metricsRetentionCutoff(now);
  const expiredLeads = await input.repository.countExpiredLeads(leadCutoff);
  const expiredMetricRows = await input.repository.countExpiredMetrics(metricCutoff);
  if (input.execute !== true) {
    return { mode: "DRY_RUN", expiredLeads, expiredMetricRows, deletedLeads: 0, deletedMetricRows: 0 };
  }
  const deletedLeads = await input.repository.deleteExpiredLeads(leadCutoff);
  const deletedMetricRows = await input.repository.deleteExpiredMetrics(metricCutoff);
  return { mode: "EXECUTE", expiredLeads, expiredMetricRows, deletedLeads, deletedMetricRows };
}
