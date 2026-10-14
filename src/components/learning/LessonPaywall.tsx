"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { acquisitionAnalyticsPayload, acquisitionDedupeKey } from "@/lib/learning/acquisition-analytics";
import { buttonClass } from "@/lib/button-styles";
import { formatPriceCents } from "@/lib/learning/money";
import { AddToCartButton } from "@/components/commerce/AddToCartButton";

export function LessonPaywall({
  lessonId,
  lessonSlug,
  courseSlug,
  courseTitle,
  moduleTitle,
  lessonPriceCents,
  modulePriceCents,
  coursePriceCents,
  lessonForSale,
  moduleForSale,
  courseForSale,
  moduleId,
  courseId,
}: {
  lessonId: string;
  lessonSlug: string;
  courseSlug: string;
  courseTitle: string;
  moduleTitle: string;
  lessonPriceCents: number | null;
  modulePriceCents: number | null;
  coursePriceCents: number | null;
  lessonForSale: boolean;
  moduleForSale: boolean;
  courseForSale: boolean;
  moduleId: string | null;
  courseId: string | null;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const key = acquisitionDedupeKey("lesson_paywall_view", lessonSlug);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        if (window.sessionStorage.getItem(key)) {
          observer.disconnect();
          return;
        }
        window.sessionStorage.setItem(key, "1");
        trackEvent("lesson_paywall_view", acquisitionAnalyticsPayload({ course_slug: courseSlug, lesson_slug: lessonSlug }));
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [courseSlug, lessonSlug]);

  const selling = lessonForSale || moduleForSale || courseForSale;

  return (
    <section ref={ref} className="lesson-paywall mt-12 rounded-lg border border-border bg-surface px-5 py-6">
      <h2 className="text-xl font-semibold tracking-tight">Continue esta aula</h2>
      <p className="mt-3 text-base leading-relaxed">Você chegou ao fim da parte gratuita.</p>
      {selling ? (
        <div className="mt-5 space-y-3 text-sm">
          {lessonForSale && lessonPriceCents != null ? (
            <div>
              <p>Esta aula: {formatPriceCents(lessonPriceCents)}</p>
              <AddToCartButton id={lessonId} type="LESSON" label={`Comprar esta aula — ${formatPriceCents(lessonPriceCents)}`} />
            </div>
          ) : null}
          {moduleForSale && modulePriceCents != null && moduleId ? (
            <div>
              <p>
                {moduleTitle}: {formatPriceCents(modulePriceCents)}
              </p>
              <AddToCartButton id={moduleId} type="MODULE" label={`Ver módulo — ${formatPriceCents(modulePriceCents)}`} />
            </div>
          ) : null}
          {courseForSale && coursePriceCents != null && courseId ? (
            <div>
              <p>
                {courseTitle}: {formatPriceCents(coursePriceCents)}
              </p>
              <AddToCartButton id={courseId} type="COURSE" label={`Curso completo — ${formatPriceCents(coursePriceCents)}`} />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-muted">Conteúdo completo disponível em breve.</p>
      )}
      <p className="mt-6">
        <Link className={`${buttonClass("secondary")} w-full sm:w-auto`} href={`/cursos/${courseSlug}`}>
          Ver o curso
        </Link>
      </p>
    </section>
  );
}
