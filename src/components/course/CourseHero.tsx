import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { SitesPageVisual, TrafficCampaignVisual } from "@/components/course/CourseProductVisual";
import { Container } from "@/components/ui/Container";
import { buttonClass } from "@/lib/button-styles";
import { TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";
import { formatPriceCents } from "@/lib/learning/money";
import Link from "next/link";

export function CourseHero({
  slug,
  eyebrow,
  title,
  support,
  primaryCta,
  secondaryCta,
  primaryHref,
  ownsAllPaid,
  priceLabel,
}: {
  slug: string;
  eyebrow: string;
  title: string;
  support: string;
  primaryCta: string;
  secondaryCta: string;
  primaryHref: string;
  ownsAllPaid: boolean;
  priceLabel: string | null;
}) {
  return (
    <section className="hero-stage final-stage overflow-x-clip py-12 text-on-ink sm:py-16">
      <Container className="grid min-w-0 items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
        <div className="min-w-0 max-w-xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-on-ink">{eyebrow}</p>
          <h1 className="mt-4 text-[1.85rem] font-semibold leading-[1.12] tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-on-ink-muted">{support}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {ownsAllPaid ? (
              <Link className={buttonClass("inverted")} href="/app/aprendizado">
                Continuar curso
              </Link>
            ) : (
              <>
                <AcquisitionLink
                  className={buttonClass("inverted")}
                  href={primaryHref}
                  event="course_free_start"
                  payload={{ course_slug: slug, cta_name: "aulas_gratuitas" }}
                >
                  {primaryCta}
                </AcquisitionLink>
                <AcquisitionLink
                  className={buttonClass("secondary", "border-white/30 bg-transparent text-on-ink hover:bg-white/10")}
                  href="#programa"
                  event="course_cta_click"
                  payload={{ course_slug: slug, cta_name: "ver_programa" }}
                >
                  {secondaryCta}
                </AcquisitionLink>
              </>
            )}
          </div>
          {priceLabel ? <p className="mt-4 text-sm text-on-ink-muted">Formação completa · {priceLabel}</p> : null}
        </div>
        <div className="min-w-0">
          {slug === TRAFFIC_COURSE_SLUG ? <TrafficCampaignVisual /> : null}
          {slug === SITES_COURSE_SLUG ? <SitesPageVisual /> : null}
        </div>
      </Container>
    </section>
  );
}

export function formatHeroPrice(cents: number | null, open: boolean): string | null {
  if (!open || cents == null) return null;
  return formatPriceCents(cents);
}
