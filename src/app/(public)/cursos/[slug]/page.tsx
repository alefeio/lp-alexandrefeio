import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { getPublishedCourse } from "@/lib/learning/catalog";
import { formatPriceCents } from "@/lib/learning/money";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublishedCourse(slug);
  if (!course) return { robots: { index: false, follow: false } };
  return {
    title: course.title,
    description: course.subtitle ?? course.description,
    alternates: { canonical: `/cursos/${course.slug}` },
  };
}

export default async function CoursePage({ params }: PageProps) {
  const { slug } = await params;
  const course = await getPublishedCourse(slug);
  if (!course) notFound();

  const minutes = course.modules.reduce(
    (total, moduleRow) => total + moduleRow.lessons.reduce((sum, lesson) => sum + (lesson.estimatedMinutes ?? 0), 0),
    0,
  );

  return (
    <Container className="max-w-3xl py-16 sm:py-24">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Curso</p>
      <h1 className="mt-3 text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">{course.title}</h1>
      {course.subtitle ? <p className="mt-4 text-lg leading-relaxed">{course.subtitle}</p> : null}
      <p className="mt-4 text-base leading-relaxed text-muted">{course.description}</p>
      <p className="mt-4 text-sm text-muted">
        {minutes > 0 ? `${minutes} min no total, somando as estimativas. ` : ""}
        Nenhuma aula exige a anterior.
        {course.bundlePriceCents != null ? ` Curso completo: ${formatPriceCents(course.bundlePriceCents)}. Disponível em breve.` : ""}
      </p>
      <div className="mt-12 space-y-12">
        {course.modules.map((moduleRow, index) => (
          <section key={moduleRow.id}>
            <h2 className="text-2xl font-semibold tracking-tight">
              {index === 0 ? "Módulo gratuito" : `Módulo ${index}`} — {moduleRow.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted">{moduleRow.description}</p>
            {moduleRow.bundlePriceCents != null ? (
              <p className="mt-2 text-sm text-muted">
                Módulo: {formatPriceCents(moduleRow.bundlePriceCents)}. Disponível em breve.
              </p>
            ) : null}
            <ol className="mt-6 space-y-4">
              {moduleRow.lessons.map((lesson, lessonIndex) => (
                <li key={lesson.id} className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted">
                    {lessonIndex + 1}. {lesson.accessType === "FREE" ? "Gratuita" : "Paga"}
                    {lesson.priceCents != null ? ` · ${formatPriceCents(lesson.priceCents)}` : ""}
                    {lesson.estimatedMinutes ? ` · ${lesson.estimatedMinutes} min` : ""}
                  </p>
                  <h3 className="mt-2 text-lg font-medium">
                    <Link className="underline underline-offset-4" href={`/aulas/${lesson.slug}`}>
                      {lesson.title}
                    </Link>
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{lesson.summary}</p>
                  {lesson.accessType === "PAID" ? <p className="mt-2 text-sm">Disponível em breve.</p> : null}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </Container>
  );
}
