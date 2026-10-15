import { UserFilters, UserTable } from "@/components/admin/Operations";
import { Container } from "@/components/ui/Container";
import { loadAdminUsers } from "@/lib/admin/load-operations";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usuários", robots: { index: false, follow: false } };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; filtro?: string; q?: string }>;
}) {
  const session = await requireAdmin();
  if (!session) return null;
  const query = await searchParams;
  const list = await loadAdminUsers(query);

  return (
    <Container>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Usuários</h1>
      <p className="mt-3 text-sm text-muted">{list.total} {list.total === 1 ? "cadastro" : "cadastros"} neste recorte. 20 por página.</p>
      <UserFilters filter={list.filter} search={list.search} />
      <UserTable list={list} />
    </Container>
  );
}
