import { Container } from "@/components/ui/Container";
import { FunnelCounts, OverviewGrid } from "@/components/admin/Operations";
import { adminOverviewView, loadAdminOverview } from "@/lib/admin/load-operations";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Visão geral", robots: { index: false, follow: false } };

export default async function AdminHomePage() {
  const session = await requireAdmin();
  if (!session) return null;
  const view = adminOverviewView(await loadAdminOverview());

  return (
    <Container>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Visão operacional</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Acompanhamento somente leitura. Aulas iniciadas e concluídas contam registros de progresso. Receita recebida soma pagamentos aprovados e parcialmente reembolsados, já líquidos do valor estornado. R$ 0,00 é o estado válido enquanto não houver venda.
      </p>
      <OverviewGrid cards={view.cards} />
      <FunnelCounts funnel={view.funnel} />
    </Container>
  );
}
