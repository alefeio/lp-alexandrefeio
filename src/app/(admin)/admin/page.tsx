import { Container } from "@/components/ui/Container";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const session = await requireAdmin();
  if (!session) return null;

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Área administrativa</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">A autorização está ativa. Ainda não há painel.</p>
    </Container>
  );
}
