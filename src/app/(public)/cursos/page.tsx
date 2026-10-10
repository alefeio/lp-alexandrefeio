import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { listPublishedCourses } from "@/lib/learning/catalog";
import { formatPriceCents } from "@/lib/learning/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cursos",
  description: "Trilha em texto de tráfego pago para pequenos negócios.",
  alternates: { canonical: "/cursos" },
};

export default async function CoursesPage() {
  const courses = await listPublishedCourses();

  return (
    <Container className="max-w-3xl py-16 sm:py-24">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Cursos</p>
      <h1 className="mt-3 text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">O que dá para estudar</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        As aulas são texto. A ordem é uma sugestão. Compra de aula ainda não está aberta.
      </p>
      <ul className="mt-10 space-y-6">
        {courses.map((course) => (
          <li key={course.id} className="rounded-lg border border-border p-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              <Link className="underline underline-offset-4" href={`/cursos/${course.slug}`}>
                {course.title}
              </Link>
            </h2>
            {course.subtitle ? <p className="mt-3 text-base leading-relaxed text-muted">{course.subtitle}</p> : null}
            {course.bundlePriceCents != null ? (
              <p className="mt-3 text-sm text-muted">Curso completo: {formatPriceCents(course.bundlePriceCents)}. Disponível em breve.</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Container>
  );
}
