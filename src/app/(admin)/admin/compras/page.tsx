import {
  CommerceFilters,
  CommerceMetricsGrid,
  CommerceOrdersTable,
  CommerceScopeTabs,
} from "@/components/admin/Commerce";
import { Container } from "@/components/ui/Container";
import { CONVERSION_DENOMINATOR_NOTE, METHOD_FILTER_NOTE, TEMPORAL_METRICS_NOTE } from "@/lib/admin/commerce";
import { loadCommerceDashboard } from "@/lib/admin/commerce-load";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compras", robots: { index: false, follow: false } };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdmin();
  if (!session) return null;
  const raw = await searchParams;
  const query = {
    escopo: typeof raw.escopo === "string" ? raw.escopo : undefined,
    periodo: typeof raw.periodo === "string" ? raw.periodo : undefined,
    usuario: typeof raw.usuario === "string" ? raw.usuario : undefined,
    produto: typeof raw.produto === "string" ? raw.produto : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    metodo: typeof raw.metodo === "string" ? raw.metodo : undefined,
    atencao: typeof raw.atencao === "string" ? raw.atencao : undefined,
    pagina: typeof raw.pagina === "string" ? raw.pagina : undefined,
  };
  const dashboard = await loadCommerceDashboard(query);

  return (
    <Container>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Gestão comercial</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Contas de teste ficam fora da visão comercial por padrão. {CONVERSION_DENOMINATOR_NOTE}{" "}
        {TEMPORAL_METRICS_NOTE} {METHOD_FILTER_NOTE}
      </p>
      {dashboard.invalidFilters.status || dashboard.invalidFilters.method ? (
        <p className="mt-3 text-sm text-muted">Filtro de status ou método inválido — nenhum resultado.</p>
      ) : null}
      <CommerceScopeTabs scope={dashboard.scope} />
      <CommerceMetricsGrid metrics={dashboard.metrics} />
      <CommerceFilters scope={dashboard.scope} query={query} />
      <p className="mt-4 text-xs text-muted">
        {dashboard.totalFiltered} pedido(s) no filtro · página {dashboard.page}/{dashboard.pages}
      </p>
      <CommerceOrdersTable
        orders={dashboard.orders}
        page={dashboard.page}
        pages={dashboard.pages}
        scope={dashboard.scope}
        query={query}
      />
    </Container>
  );
}
