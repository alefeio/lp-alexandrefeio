import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { listPricingCourses } from "@/lib/admin/pricing";
import { requireAdmin } from "@/lib/auth/session";
import { formatCentsToBrl } from "@/lib/commerce/money";

export const dynamic = "force-dynamic";

export default async function AdminPricingIndexPage() {
  const session = await requireAdmin();
  if (!session) return null;
  const courses = await listPricingCourses();

  return (
    <Container className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Comercial</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Preços</h1>
      <p className="mt-3 text-sm text-muted">
        Gestão comercial de aulas, módulos e cursos. O editor pedagógico não altera preços — use esta área.
      </p>
      <ul className="mt-8 space-y-4">
        {courses.map((course) => (
          <li key={course.id} className="border-t border-border pt-4">
            <Link className="text-lg font-medium underline underline-offset-4" href={`/admin/precos/${course.id}`}>
              {course.title}
            </Link>
            <p className="mt-2 text-sm text-muted">
              {course.status === "PUBLISHED" ? "Publicado" : "Rascunho"} ·{" "}
              {course.commerceStatus === "AVAILABLE" ? "À venda" : "Fora de venda"} · {course.moduleCount}{" "}
              módulos · {course.paidLessonCount} aulas pagas · {course.lessonCount} aulas · Pacote{" "}
              {formatCentsToBrl(course.bundlePriceCents)}
            </p>
          </li>
        ))}
      </ul>
    </Container>
  );
}
