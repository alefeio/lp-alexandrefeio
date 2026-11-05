import { fetchBlogGa4Snapshot } from "@/lib/admin/blog-ga4";
import {
  assembleBlogMetrics,
  blogMetricsPending,
  parseBlogMetricPeriod,
  type BlogMetricCatalogItem,
  type BlogMetricsView,
} from "@/lib/admin/blog-metrics";
import { listBlogMetricCatalog } from "@/lib/blog/service";

export async function loadBlogMetrics(
  query: { periodo?: string },
  options?: { now?: Date; catalog?: BlogMetricCatalogItem[]; fetchImpl?: typeof fetch; env?: { GA4_PROPERTY_ID?: string; GA4_CLIENT_EMAIL?: string; GA4_PRIVATE_KEY?: string } },
): Promise<BlogMetricsView> {
  const now = options?.now ?? new Date();
  const period = parseBlogMetricPeriod(query.periodo);
  const report = await fetchBlogGa4Snapshot({ period, now, env: options?.env, fetchImpl: options?.fetchImpl });
  if (!report.ok) return blogMetricsPending({ period, now, status: report.status, message: report.message });
  const catalog = options?.catalog ?? (await listBlogMetricCatalog());
  return assembleBlogMetrics({ period, now, snapshot: report.snapshot, catalog });
}
