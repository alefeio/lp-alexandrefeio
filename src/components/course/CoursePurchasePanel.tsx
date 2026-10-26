import Link from "next/link";
import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { AddToCartButton } from "@/components/commerce/AddToCartButton";
import { Container } from "@/components/ui/Container";
import { buttonClass } from "@/lib/button-styles";
import { formatPriceCents } from "@/lib/learning/money";

export function CoursePurchasePanel({
  courseId,
  courseSlug,
  courseTitle,
  title,
  support,
  lessonCount,
  moduleCount,
  freeCount,
  outcome,
  artifacts,
  benefits,
  bundlePriceCents,
  individualTotalCents,
  savingsCents,
  courseOpen,
  hidePrices,
  ownsAllPaid,
  hasPartialPurchase,
  paidLessonIds,
  firstFreeHref,
}: {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  title: string;
  support: string;
  lessonCount: number;
  moduleCount: number;
  freeCount: number;
  outcome: string;
  artifacts: string[];
  benefits: string[];
  bundlePriceCents: number | null;
  individualTotalCents: number;
  savingsCents: number;
  courseOpen: boolean;
  hidePrices: boolean;
  ownsAllPaid: boolean;
  hasPartialPurchase: boolean;
  paidLessonIds: string[];
  firstFreeHref: string | null;
}) {
  return (
    <section id="curso-completo" className="scroll-mt-24 overflow-x-clip border-t border-border py-20">
      <Container className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Formação completa</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-3 text-base leading-relaxed text-muted">{support}</p>
        <div className="mt-8 border-t border-border pt-6">
          <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{courseTitle}</h3>
          <p className="mt-3 text-sm text-muted">
            {lessonCount} aulas · {moduleCount} módulos
            {freeCount > 0 ? ` · ${freeCount} aulas gratuitas` : ""}
          </p>
          <p className="mt-4 text-sm leading-relaxed">{outcome}</p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {benefits.slice(0, 6).map((benefit) => (
              <li key={benefit} className="text-sm">
                <span className="mr-2 text-cta" aria-hidden>✓</span>
                {benefit}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-muted">Inclui {artifacts.slice(0, 4).join(", ")}.</p>
          {!hidePrices && bundlePriceCents != null ? (
            <div className="mt-6 space-y-2 border-t border-border pt-5">
              {individualTotalCents > 0 ? (
                <p className="text-sm text-muted">
                  Comprando as aulas individualmente: <span className="line-through">{formatPriceCents(individualTotalCents)}</span>
                </p>
              ) : null}
              <p className="text-lg font-semibold">
                Curso completo: {formatPriceCents(bundlePriceCents)}
                {courseOpen ? "" : " · Disponível em breve."}
              </p>
              {savingsCents > 0 ? (
                <p className="text-sm text-muted">
                  Economia: {formatPriceCents(savingsCents)}
                  {individualTotalCents > 0 ? ` (cerca de ${Math.round((savingsCents / individualTotalCents) * 100)}%)` : ""}
                </p>
              ) : null}
            </div>
          ) : null}
          {hidePrices ? (
            <p className="mt-6 text-sm leading-relaxed text-muted">A formação completa ainda não está à venda. As aulas gratuitas continuam abertas.</p>
          ) : null}
          <div className="mt-6">
            {ownsAllPaid ? (
              <Link className={buttonClass("primary")} href="/app/aprendizado">
                Continuar curso
              </Link>
            ) : courseOpen ? (
              <AddToCartButton
                id={courseId}
                type="COURSE"
                label={`Comprar curso completo — ${formatPriceCents(bundlePriceCents ?? 0)}`}
                lessonIds={paidLessonIds}
              />
            ) : firstFreeHref ? (
              <AcquisitionLink className={buttonClass("primary")} href={firstFreeHref} event="course_free_start" payload={{ course_slug: courseSlug, cta_name: "comecar_gratis_bloco" }}>
                Começar gratuitamente
              </AcquisitionLink>
            ) : (
              <p className="text-sm text-muted">Disponível em breve.</p>
            )}
          </div>
          {hasPartialPurchase && !ownsAllPaid && courseOpen ? (
            <p className="mt-4 text-sm leading-relaxed text-muted">Compras anteriores elegíveis viram crédito automaticamente no checkout.</p>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
