import { fail, ok, type LandingPageResult } from "@/lib/landing-page/errors";
import type { LandingPageMetricDailyRecord, LandingPageMetricStore } from "@/lib/landing-page/measurement/metrics";
import type { LandingPageMeasurementEvent } from "@/lib/landing-page/measurement/schema";
import type { LandingPageStore } from "@/lib/landing-page/types";

export async function summarizeLandingPageMetrics(
  store: LandingPageStore,
  metrics: LandingPageMetricStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    publicationId?: string;
    from?: string;
    to?: string;
  },
): Promise<LandingPageResult<Array<{ eventType: LandingPageMeasurementEvent; count: number }>>> {
  const project = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project) return fail("NOT_FOUND");
  const rows = await metrics.listForProject(project.id);
  const totals = new Map<LandingPageMeasurementEvent, number>();
  for (const row of rows) {
    if (input.publicationId && row.publicationId !== input.publicationId) continue;
    if (input.from && row.date < input.from) continue;
    if (input.to && row.date > input.to) continue;
    totals.set(row.eventType, (totals.get(row.eventType) ?? 0) + row.count);
  }
  return ok([...totals.entries()].map(([eventType, count]) => ({ eventType, count })));
}

export type { LandingPageMetricDailyRecord };
