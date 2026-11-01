import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { SitesPageVisual, TrafficCampaignVisual } from "@/components/course/CourseProductVisual";
import { Container } from "@/components/ui/Container";
import { buttonClass, navigationLinkClass } from "@/lib/button-styles";
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
  primaryCtaName,
  secondaryCta,
  secondaryHref,
  secondaryCtaName,
  riskNote,
  primaryHref,
  ownsAllPaid,
  priceLabel,
}: {
  slug: string;
  eyebrow: string;
  title: string;
  support: string;
  primaryCta: string;
  primaryCtaName: string;
  secondaryCta: string;
  secondaryHref: string;
  secondaryCtaName: string;
  riskNote: string | null;
  primaryHref: string;
  ownsAllPaid: boolean;
  priceLabel: string | null;
}) {
  return (
    <section className="hero-stage final-stage overflow-x-clip py-4 text-on-ink sm:py-16 lg:py-20">
      <Container className="grid min-w-0 items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
        <div className="min-w-0 max-w-xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-on-ink">{eyebrow}</p>
          <h1 className="mt-3 text-balance break-words text-[1.65rem] font-semibold leading-tight tracking-tight sm:mt-4 sm:text-5xl sm:leading-[1.12]">{title}</h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-on-ink-muted sm:mt-4 sm:text-base">{support}</p>
          <div className="mt-5 flex flex-col items-start gap-3 sm:mt-6">
            {ownsAllPaid ? (
              <Link className={buttonClass("primary")} href="/app/aprendizado">
                Continuar curso
              </Link>
            ) : (
              <>
                <AcquisitionLink
                  className={buttonClass("primary")}
                  href={primaryHref}
                  event="course_free_start"
                  payload={{ course_slug: slug, cta_name: primaryCtaName }}
                >
                  {primaryCta}
                </AcquisitionLink>
                <AcquisitionLink
                  className={navigationLinkClass("on-ink")}
                  href={secondaryHref}
                  event="course_cta_click"
                  payload={{ course_slug: slug, cta_name: secondaryCtaName }}
                >
                  {secondaryCta}
                </AcquisitionLink>
              </>
            )}
          </div>
          {riskNote ? <p className="mt-3 max-w-lg text-sm leading-relaxed text-on-ink-muted">{riskNote}</p> : null}
          {priceLabel ? <p className="mt-3 text-sm text-on-ink-muted">Formação completa · {priceLabel}</p> : null}
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
