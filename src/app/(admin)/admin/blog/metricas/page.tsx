import { BlogMetricsPanel } from "@/components/admin/blog/BlogMetricsPanel";
import { Container } from "@/components/ui/Container";
import { loadBlogMetrics } from "@/lib/admin/blog-metrics-load";
import { loadBlogReadingMetrics } from "@/lib/admin/blog-reading-metrics-load";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Métricas do blog", robots: { index: false, follow: false } };

export default async function AdminBlogMetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const session = await requireAdmin();
  if (!session) return null;
  const query = await searchParams;
  const [reading, ga4] = await Promise.all([loadBlogReadingMetrics(query), loadBlogMetrics(query)]);

  return (
    <Container>
      <BlogMetricsPanel reading={reading} ga4={ga4} />
    </Container>
  );
}
