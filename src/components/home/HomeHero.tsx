import Link from "next/link";
import { AcquisitionConversionFlow } from "@/components/home/AcquisitionConversionFlow";
import { Container } from "@/components/ui/Container";
import { buttonClass, navigationLinkClass } from "@/lib/button-styles";
import { publicHomeCopy } from "@/lib/home/public-home";

export function HomeHero() {
  return (
    <section className="hero-stage final-stage py-14 text-on-ink sm:py-16 lg:py-20">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-on-ink">Alexandre Feio</p>
            <h1 className="mt-4 max-w-xl text-[2.05rem] font-semibold leading-[1.08] tracking-tight text-on-ink sm:text-5xl">
              {publicHomeCopy.hero}
            </h1>
            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
              <Link className={buttonClass("primary", "w-full sm:w-auto")} href="#formacoes">
                {publicHomeCopy.primaryCta}
              </Link>
              <Link className={navigationLinkClass("on-ink")} href="#aulas-gratuitas">
                {publicHomeCopy.secondaryCta}
              </Link>
            </div>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-on-ink-muted sm:text-lg">{publicHomeCopy.support}</p>
            <p className="mt-3 max-w-xl text-sm font-medium text-on-ink">{publicHomeCopy.complement}</p>
          </div>
          <AcquisitionConversionFlow />
        </div>
      </Container>
    </section>
  );
}
