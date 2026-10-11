import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { requireAdmin } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const session = await requireAdmin();
  if (!session) return null;
  const courses = await getPrisma().course.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: { modules: { include: { lessons: { select: { commerceStatus: true, accessType: true, status: true } } } } },
  });

  return (
    <Container className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Editorial</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Cursos</h1>
      <ul className="mt-8 space-y-4">
        {courses.map((course) => {
          const lessons = course.modules.flatMap((moduleRow) => moduleRow.lessons);
          const paid = lessons.filter((lesson) => lesson.accessType === "PAID");
          const forSale = paid.filter((lesson) => lesson.commerceStatus === "AVAILABLE").length;
          return (
            <li key={course.id} className="rounded-lg border border-border p-4">
              <Link className="text-lg font-medium underline-offset-4 hover:underline" href={`/admin/cursos/${course.id}`}>
                {course.title}
              </Link>
              <p className="mt-2 text-sm text-muted">
                {course.status === "PUBLISHED" ? "Publicado" : "Rascunho"} · {course.commerceStatus === "AVAILABLE" ? "Pacote à venda" : "Pacote fora de venda"} · {forSale} de {paid.length} aulas pagas disponíveis
              </p>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
