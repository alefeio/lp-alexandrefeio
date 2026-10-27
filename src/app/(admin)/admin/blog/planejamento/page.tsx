import { EditorialDesk } from "@/components/admin/blog/EditorialDesk";
import { Container } from "@/components/ui/Container";
import { blogCategoryLabel } from "@/lib/blog/catalog";
import { coverageSnapshot } from "@/lib/blog/inventory";
import { listEditorialIdeas, loadEditorialInventory } from "@/lib/blog/service";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Planejamento editorial", robots: { index: false, follow: false } };

export default async function BlogPlanningPage() {
  const session = await requireAdmin();
  if (!session) return null;
  const [inventory, ideas] = await Promise.all([loadEditorialInventory(), listEditorialIdeas()]);
  const snapshot = coverageSnapshot(inventory);

  return (
    <Container>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Inteligência editorial</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">A IA sugere. A publicação continua sendo uma decisão sua. Nada aqui publica um artigo.</p>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Publicados", snapshot.published],
          ["Rascunhos", snapshot.drafts],
          ["Planejados", snapshot.planned],
          ["Descartados", snapshot.dismissed],
        ].map(([label, value]) => (
          <li key={label} className="rounded-lg border border-border p-3 text-sm">
            <p>{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </li>
        ))}
      </ul>
      <ul className="mt-4 space-y-1 text-sm text-muted">
        {snapshot.byCategory.map((row) => (
          <li key={row.slug}>{blogCategoryLabel(row.slug)}: {row.published} publicados, {row.drafts} rascunhos</li>
        ))}
      </ul>
      <EditorialDesk ideas={ideas.map((idea) => ({ id: idea.id, title: idea.title, status: idea.status, categorySlug: idea.categorySlug, angle: idea.angle, rationale: idea.rationale, draftPostId: idea.draftPostId }))} />
    </Container>
  );
}
