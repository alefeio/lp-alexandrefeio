/** Dias inteiros de cobertura. O resto da divisão não conta como dia cheio. */
export function coverageDays(currentBalanceCents: number, plannedDailyBudgetCents: number): number | null {
  if (!Number.isInteger(currentBalanceCents) || currentBalanceCents < 0) return null;
  if (!Number.isInteger(plannedDailyBudgetCents) || plannedDailyBudgetCents <= 0) return null;
  return Math.floor(currentBalanceCents / plannedDailyBudgetCents);
}

/**
 * Lembrete de recarga: data de referência + (cobertura − antecedência), ao meio-dia UTC.
 * Se a antecedência já passou da cobertura, o lembrete fica para agora.
 */
export function budgetRemindAt(balanceAsOf: Date, days: number, leadDays: number, now = new Date()): Date {
  const until = Math.max(days - leadDays, 0);
  const remind = new Date(balanceAsOf);
  remind.setUTCDate(remind.getUTCDate() + until);
  remind.setUTCHours(12, 0, 0, 0);
  if (remind.getTime() < now.getTime()) return new Date(now);
  return remind;
}

export function remindBeforeDue(dueAt: Date, leadDays: number): Date {
  const remind = new Date(dueAt);
  remind.setUTCDate(remind.getUTCDate() - leadDays);
  return remind;
}

export function coverageLabel(days: number): string {
  if (days === 0) return "menos de 1 dia";
  if (days === 1) return "aproximadamente 1 dia";
  return `aproximadamente ${days} dias`;
}
