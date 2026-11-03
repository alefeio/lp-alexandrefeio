import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { SitesPageVisual, TrafficCampaignVisual } from "@/components/course/CourseProductVisual";
import { Container } from "@/components/ui/Container";
import { buttonClass, navigationLinkClass } from "@/lib/button-styles";
import { TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";
import { formatPriceCents } from "@/lib/learning/money";
import Link from "next/link";

const TRAFFIC_HERO_STEPS = ["Objetivo", "Canal", "Campanha", "Dados", "Próxima ação"];
const SITES_HERO_STEPS = ["Oferta", "Estrutura", "Copy", "Página publicada"] as const;

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
    <section className="hero-stage final-stage overflow-x-clip py-4 text-on-ink max-[380px]:py-2 sm:py-16 lg:py-20">
      <Container className="grid min-w-0 items-center gap-10 max-[380px]:px-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
        <div className="min-w-0 max-w-xl">
          <p className="text-xs font-medium uppercase leading-snug tracking-[0.16em] text-on-ink max-[380px]:tracking-[0.08em]">{eyebrow}</p>
          <h1 className="mt-3 text-balance break-words text-[1.65rem] font-semibold leading-tight tracking-tight max-[380px]:mt-1.5 max-[380px]:text-[1.35rem] max-[380px]:leading-[1.15] sm:mt-4 sm:text-5xl sm:leading-[1.12]">{title}</h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-on-ink-muted max-[380px]:mt-1.5 max-[380px]:text-[0.8125rem] max-[380px]:leading-snug sm:mt-4 sm:text-base">{support}</p>
          <div className="mt-5 flex flex-col items-start gap-3 max-[380px]:mt-2.5 max-[380px]:gap-1 sm:mt-6">
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
          {slug === TRAFFIC_COURSE_SLUG ? <TrafficCampaignVisual steps={TRAFFIC_HERO_STEPS} title="Da oferta à próxima ação" /> : null}
          {slug === SITES_COURSE_SLUG ? (
            <div className="grid gap-4">
              <SitesPageVisual />
              <ol className="flex min-w-0 flex-wrap items-center gap-2" aria-label="Oferta, estrutura, copy e página publicada">
                {SITES_HERO_STEPS.map((step, index) => (
                  <li key={step} className="flex min-w-0 items-center gap-2">
                    <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-sm font-medium text-on-ink">{step}</span>
                    {index < SITES_HERO_STEPS.length - 1 ? <span className="text-on-ink-muted" aria-hidden>→</span> : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}

export function formatHeroPrice(cents: number | null, open: boolean): string | null {
  if (!open || cents == null) return null;
  return formatPriceCents(cents);
}
