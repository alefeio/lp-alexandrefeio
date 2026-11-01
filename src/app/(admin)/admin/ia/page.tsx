import { AiEconomicsDashboard } from "@/components/admin/ai/AiEconomicsDashboard";
import { Container } from "@/components/ui/Container";
import { loadAiEconomics } from "@/lib/admin/load-ai-economics";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "IA", robots: { index: false, follow: false } };

export default async function AdminAiPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const session = await requireAdmin();
  if (!session) return null;
  const query = await searchParams;
  const view = await loadAiEconomics(query);

  return (
    <Container>
      <AiEconomicsDashboard view={view} />
    </Container>
  );
}
