import { LANDING_PAGE_MEDIA_ORPHAN_GRACE_MS } from "@/lib/landing-page/media/orphan-cleanup";

/** Meses corridos a partir de LandingPageLead.createdAt. Arquivar não renova. */
export const LEAD_RETENTION_MONTHS = 12;

/** Meses corridos a partir de LandingPageMetricDaily.date. */
export const METRICS_RETENTION_MONTHS = 24;

/** Reutiliza a janela já usada pela limpeza de mídia sem referência. */
export const ORPHAN_MEDIA_GRACE_HOURS = LANDING_PAGE_MEDIA_ORPHAN_GRACE_MS / (60 * 60 * 1000);

export const LEAD_RETENTION_POLICY = {
  months: LEAD_RETENTION_MONTHS,
  basis: "createdAt",
  action: "DELETE",
} as const;

export const METRICS_RETENTION_POLICY = {
  months: METRICS_RETENTION_MONTHS,
  basis: "date",
  action: "DELETE",
} as const;

export const MEDIA_RETENTION_POLICY = {
  referenced: "RETAIN_WHILE_REFERENCED_OR_HISTORICAL",
  orphanGraceHours: ORPHAN_MEDIA_GRACE_HOURS,
} as const;

export const RETENTION_DECISIONS_FINALIZED = true;

/** Ainda não há cron de produção para esta rotina. */
export const RETENTION_MAINTENANCE_SCHEDULED = false;

export function subtractCalendarMonths(now: Date, months: number): Date {
  const shifted = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1, now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate();
  shifted.setUTCDate(Math.min(now.getUTCDate(), lastDay));
  return shifted;
}

/** Instante exclusivo: createdAt anterior a este corte entra na exclusão. */
export function leadRetentionCutoff(now: Date): Date {
  return subtractCalendarMonths(now, LEAD_RETENTION_MONTHS);
}

/**
 * Meia-noite UTC do dia civil 24 meses antes.
 * A coluna date guarda o dia, então a comparação não usa a hora de now.
 */
export function metricsRetentionCutoff(now: Date): Date {
  const shifted = subtractCalendarMonths(now, METRICS_RETENTION_MONTHS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

export function leadIsExpired(createdAt: Date, now: Date): boolean {
  return createdAt.getTime() < leadRetentionCutoff(now).getTime();
}

export function metricDayIsExpired(date: Date, now: Date): boolean {
  return date.getTime() < metricsRetentionCutoff(now).getTime();
}
