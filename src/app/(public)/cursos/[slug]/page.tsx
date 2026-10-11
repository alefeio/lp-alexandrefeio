import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { AddToCartButton } from "@/components/commerce/AddToCartButton";
import { isCommerceEnabled } from "@/lib/commerce/config";
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
        Nenhuma aula exige a anterior. A ordem é uma sequência sugerida.
        {course.bundlePriceCents != null
          ? ` Curso completo: ${formatPriceCents(course.bundlePriceCents)}. ${isCommerceEnabled() && course.commerceStatus === "AVAILABLE" ? "" : "Disponível em breve."}`
          : ""}
      </p>
      {isCommerceEnabled() && course.commerceStatus === "AVAILABLE" && course.bundlePriceCents ? (
        <AddToCartButton id={course.id} type="COURSE" label="Comprar o curso" />
      ) : null}
      <div className="mt-12 space-y-12">
        {course.modules.map((moduleRow, index) => (
          <section key={moduleRow.id}>
            <h2 className="text-2xl font-semibold tracking-tight">
              {index === 0 ? "Módulo gratuito" : `Módulo ${index}`} — {moduleRow.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted">{moduleRow.description}</p>
            {moduleRow.bundlePriceCents != null ? (
              <ModuleOffer moduleRow={moduleRow} />
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
                  {lesson.accessType === "PAID" && !(isCommerceEnabled() && lesson.commerceStatus === "AVAILABLE") ? (
                    <p className="mt-2 text-sm">Disponível em breve.</p>
                  ) : null}
                  {isCommerceEnabled() && lesson.accessType === "PAID" && lesson.commerceStatus === "AVAILABLE" && lesson.priceCents ? (
                    <AddToCartButton id={lesson.id} type="LESSON" label="Comprar esta aula" />
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </Container>
  );
}

function ModuleOffer({
  moduleRow,
}: {
  moduleRow: {
    id: string;
    commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
    bundlePriceCents: number | null;
    lessons: { accessType: "FREE" | "PAID"; priceCents: number | null; commerceStatus: "NOT_FOR_SALE" | "AVAILABLE" }[];
  };
}) {
  const price = moduleRow.bundlePriceCents;
  if (price == null) return null;
  const open = isCommerceEnabled() && moduleRow.commerceStatus === "AVAILABLE";
  const individual = moduleRow.lessons.reduce((sum, lesson) => sum + (lesson.accessType === "PAID" ? lesson.priceCents ?? 0 : 0), 0);
  if (!open) {
    return <p className="mt-2 text-sm text-muted">Módulo: {formatPriceCents(price)}. Disponível em breve.</p>;
  }
  return (
    <div className="mt-2 text-sm">
      <p>Módulo: {formatPriceCents(price)}. Soma das aulas: {formatPriceCents(individual)}.</p>
      {individual > price ? <p>Economia de {formatPriceCents(individual - price)} em relação às aulas separadas.</p> : null}
      <p className="text-muted">O crédito de aulas já compradas entra no checkout, calculado no servidor.</p>
      <AddToCartButton id={moduleRow.id} type="MODULE" label="Comprar módulo" />
    </div>
  );
}
