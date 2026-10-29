"use client";

import { useState } from "react";
import Link from "next/link";
import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { AddToCartButton } from "@/components/commerce/AddToCartButton";
import { Container } from "@/components/ui/Container";
import { buttonClass } from "@/lib/button-styles";
import { isProductForSale } from "@/lib/commerce/config";
import { paidLessonAction } from "@/lib/commerce/sale-action";
import { trackEvent } from "@/lib/analytics";
import { acquisitionAnalyticsPayload } from "@/lib/learning/acquisition-analytics";
import type { LessonExperience } from "@/lib/learning/course-experience";
import { formatPriceCents } from "@/lib/learning/money";
import type { SalesLesson, SalesModule } from "@/components/course/sales-types";

export function CourseCurriculum({
  courseSlug,
  modules,
  lessonsBySlug,
  commerce,
  ownedLessonIds,
  hidePrices,
}: {
  courseSlug: string;
  modules: SalesModule[];
  lessonsBySlug: Record<string, LessonExperience>;
  commerce: boolean;
  ownedLessonIds: string[];
  hidePrices: boolean;
}) {
  const owned = new Set(ownedLessonIds);
  const numberById = new Map(modules.flatMap((moduleRow) => moduleRow.lessons).map((lesson, index) => [lesson.id, index + 1]));
  return (
    <section id="programa" className="scroll-mt-24 overflow-x-clip border-t border-border bg-[linear-gradient(180deg,#f7f9fc_0%,#ffffff_40%)] py-16">
      <Container className="max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">O que você aprende e coloca em prática</h2>
        <p className="mt-3 text-base leading-relaxed text-muted">Abra cada aula para ver o que você aprende, pratica e leva para o seu negócio.</p>
        <div className="mt-8 space-y-10">
          {modules.map((moduleRow, index) => {
            return (
              <section key={moduleRow.id}>
                <h3 className="text-xl font-semibold">
                  Módulo {index + 1} — {moduleRow.title}
                </h3>
                <p className="mt-1 text-sm text-muted">
                  {moduleRow.lessons.length} {moduleRow.lessons.length === 1 ? "aula" : "aulas"}
                </p>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{moduleRow.description}</p>
                {!hidePrices ? <ModuleOffer moduleRow={moduleRow} commerce={commerce} /> : null}
                <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                  {moduleRow.lessons.map((lesson) => {
                    return (
                      <LessonCurriculumItem
                        key={lesson.id}
                        number={numberById.get(lesson.id) ?? 0}
                        lesson={lesson}
                        experience={lessonsBySlug[lesson.slug] ?? null}
                        courseSlug={courseSlug}
                        commerce={commerce}
                        owned={owned.has(lesson.id)}
                        hidePrice={hidePrices}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function ModuleOffer({ moduleRow, commerce }: { moduleRow: SalesModule; commerce: boolean }) {
  if (moduleRow.bundlePriceCents == null) return null;
  const open = isProductForSale(moduleRow.commerceStatus, moduleRow.bundlePriceCents, commerce);
  return (
    <div className="mt-3 text-sm text-muted">
      <p>{`Módulo: ${formatPriceCents(moduleRow.bundlePriceCents)}.${open ? "" : " Disponível em breve."}`}</p>
      {open ? (
        <AddToCartButton
          id={moduleRow.id}
          type="MODULE"
          label={`Ver módulo — ${formatPriceCents(moduleRow.bundlePriceCents)}`}
          lessonIds={moduleRow.lessons.filter((lesson) => lesson.accessType === "PAID").map((lesson) => lesson.id)}
        />
      ) : null}
    </div>
  );
}

function LessonCurriculumItem({
  number,
  lesson,
  experience,
  courseSlug,
  commerce,
  owned,
  hidePrice,
}: {
  number: number;
  lesson: SalesLesson;
  experience: LessonExperience | null;
  courseSlug: string;
  commerce: boolean;
  owned: boolean;
  hidePrice: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `curriculum-${lesson.slug}`;
  const paid = lesson.accessType === "PAID";
  const forSale = paid && isProductForSale(lesson.commerceStatus, lesson.priceCents, commerce);
  const action = paid ? paidLessonAction({ open: forSale, owned }) : null;
  const duration = lesson.estimatedMinutes ? `≈ ${lesson.estimatedMinutes} min` : null;

  function toggle() {
    setOpen((current) => {
      const next = !current;
      if (next) {
        trackEvent("curriculum_lesson_expand", acquisitionAnalyticsPayload({ course_slug: courseSlug, lesson_slug: lesson.slug }));
      }
      return next;
    });
  }

  return (
    <article className="min-w-0">
      <h4 className="text-base">
        <button
          type="button"
          className="flex w-full min-w-0 flex-col gap-2 px-4 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cta sm:flex-row sm:items-center sm:justify-between"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
        >
          <span className="min-w-0">
            <span className="block text-xs font-medium uppercase tracking-[0.14em] text-muted">Aula {number}</span>
            <span className="mt-1 block font-medium">{lesson.title}</span>
          </span>
          <span className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
            <span className={paid ? "rounded-full border border-border px-2 py-1 font-medium text-muted" : "rounded-full bg-cta/10 px-2 py-1 font-medium text-cta"}>{paid ? "Paga" : "Grátis"}</span>
            {duration ? <span className="text-muted">{duration}</span> : null}
            {!hidePrice && paid && lesson.priceCents != null ? <span className="text-muted">{formatPriceCents(lesson.priceCents)}</span> : null}
          </span>
        </button>
      </h4>
      <div id={panelId} hidden={!open} className="min-w-0 px-4 pb-5">
        {experience ? (
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
            <LessonFacet label="Aprende" items={experience.learns} />
            <LessonFacet label="Pratica" items={experience.practices} />
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Leva</p>
              <p className="mt-2 text-sm leading-relaxed">{experience.outcome}</p>
            </div>
          </div>
        ) : (
          <p className="border-t border-border pt-4 text-sm leading-relaxed text-muted">{lesson.summary}</p>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {!paid && lesson.hasBody ? (
            <AcquisitionLink
              className={buttonClass("primary")}
              href={`/aulas/${lesson.slug}`}
              event="course_free_start"
              payload={{ course_slug: courseSlug, lesson_slug: lesson.slug, cta_name: "comecar_aula" }}
            >
              Começar aula gratuita
            </AcquisitionLink>
          ) : null}
          {action !== "access" && paid && lesson.hasPublicPreview ? (
            <Link className="text-sm underline underline-offset-4" href={`/aulas/${lesson.slug}`}>
              Ler a parte gratuita
            </Link>
          ) : null}
          {action === "soon" && !hidePrice ? <p className="text-sm">Disponível em breve.</p> : null}
          {action === "access" ? (
            <Link className={buttonClass("primary")} href={`/aulas/${lesson.slug}`}>
              Acessar minha aula
            </Link>
          ) : null}
          {action === "buy" && lesson.priceCents != null ? (
            <AddToCartButton id={lesson.id} type="LESSON" label={`Comprar esta aula — ${formatPriceCents(lesson.priceCents)}`} lessonIds={[lesson.id]} />
          ) : null}
          {paid && !lesson.hasBody ? <p className="text-sm text-muted">Em preparação.</p> : null}
        </div>
      </div>
    </article>
  );
}

function LessonFacet({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">{label}</p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-relaxed">{item}</li>
        ))}
      </ul>
    </div>
  );
}
