import Image from "next/image";
import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { Container } from "@/components/ui/Container";
import { buttonClass } from "@/lib/button-styles";
import { publicHomeCopy } from "@/lib/home/public-home";

export function HomeAbout() {
  return (
    <section id="sobre" className="scroll-mt-24 border-t border-border py-16">
      <Container>
        <div className="grid items-center gap-8 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <div className="relative mx-auto aspect-square w-40 overflow-hidden rounded-2xl border border-border lg:mx-0 lg:w-full">
            <Image src="/alexandre.jpg" alt="Alexandre Feio" fill sizes="160px" className="object-cover" priority={false} />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{publicHomeCopy.aboutName}</h2>
            <p className="mt-3 text-base leading-relaxed">{publicHomeCopy.aboutLine}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{publicHomeCopy.aboutSupport}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2" id="servico">
              <article className="rounded-2xl border border-border bg-surface p-5">
                <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-cta">{publicHomeCopy.learnLabel}</h3>
                <p className="mt-4">
                  <a className={buttonClass("primary")} href="#formacoes">
                    {publicHomeCopy.learnCta}
                  </a>
                </p>
              </article>
              <article className="rounded-2xl border border-border bg-surface p-5">
                <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-cta">{publicHomeCopy.delegateLabel}</h3>
                <p className="mt-4">
                  <AcquisitionLink
                    className={buttonClass("secondary")}
                    href="/trafego-pago"
                    event="service_from_course_click"
                    payload={{ cta_name: "conhecer_gestao" }}
                  >
                    {publicHomeCopy.delegateCta}
                  </AcquisitionLink>
                </p>
              </article>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
