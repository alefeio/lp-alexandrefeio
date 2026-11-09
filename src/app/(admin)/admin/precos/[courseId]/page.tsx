import Link from "next/link";
import { notFound } from "next/navigation";
import { PricingDesk } from "@/components/admin/pricing/PricingDesk";
import { Container } from "@/components/ui/Container";
import { loadPricingCourseDesk } from "@/lib/admin/pricing";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ courseId: string }> };

export default async function AdminPricingCoursePage({ params }: PageProps) {
  const session = await requireAdmin();
  if (!session) return null;
  const { courseId } = await params;
  const desk = await loadPricingCourseDesk(courseId);
  if (!desk) notFound();

  return (
    <Container className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Comercial</p>
      <p className="mt-3 text-sm">
        <Link className="underline underline-offset-4" href="/admin/precos">
          Preços
        </Link>
        {" · "}
        <Link className="underline underline-offset-4" href={`/admin/cursos/${desk.id}`}>
          Editor do curso
        </Link>
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{desk.title}</h1>
      <p className="mt-3 text-sm text-muted">
        Edite valores em reais. Pedidos já criados não mudam. Status de venda só muda nas ações de
        disponibilizar/retirar venda.
      </p>
      <PricingDesk desk={desk} />
    </Container>
  );
}
