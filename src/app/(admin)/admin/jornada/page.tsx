import { JourneyDashboard } from "@/components/admin/journey/JourneyDashboard";
import { Container } from "@/components/ui/Container";
import { loadJourneyDashboard } from "@/lib/admin/journey-dashboard";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jornada", robots: { index: false, follow: false } };

export default async function AdminJourneyPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; curso?: string }>;
}) {
  const session = await requireAdmin();
  if (!session) return null;
  const query = await searchParams;
  const view = await loadJourneyDashboard(query);

  return (
    <Container>
      <JourneyDashboard view={view} />
    </Container>
  );
}
