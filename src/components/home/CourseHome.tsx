import type { ReactNode } from "react";
import Link from "next/link";
import { ConnectedCourses } from "@/components/home/ConnectedCourses";
import { CourseDecisionGuide } from "@/components/home/CourseDecisionGuide";
import { FreeCourseJourney } from "@/components/home/FreeCourseJourney";
import { HomeArtifacts } from "@/components/home/HomeArtifacts";
import { HomeHero } from "@/components/home/HomeHero";
import { LearnOrDelegate } from "@/components/home/LearnOrDelegate";
import { ProductInAction } from "@/components/home/ProductInAction";
import { SystemStages } from "@/components/home/SystemStages";
import { Container } from "@/components/ui/Container";
import { buttonClass, navigationLinkClass } from "@/lib/button-styles";
import { publicHomeCopy } from "@/lib/home/public-home";
import type { CourseCatalogCard } from "@/lib/learning/course-catalog";

export function CourseHome({
  courses,
  continuation = null,
}: {
  courses: CourseCatalogCard[];
  continuation?: ReactNode;
}) {
  return (
    <>
      <HomeHero />
      <SystemStages />
      {continuation}
      <ConnectedCourses courses={courses} />
      <HomeArtifacts courses={courses} />
      <ProductInAction />
      <CourseDecisionGuide courses={courses} />
      <FreeCourseJourney courses={courses} />
      <section id="sobre" className="scroll-mt-24 py-14">
        <Container className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Sobre</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Tecnologia, marketing e produto na mesma experiência.</h2>
          <p className="mt-4 text-base leading-relaxed">
            Desenvolvimento, marketing, produto e tráfego no mesmo lugar. Por isso o anúncio e a página fazem parte do mesmo sistema.
          </p>
        </Container>
      </section>
      <LearnOrDelegate />
      <section className="border-t border-border py-20">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{publicHomeCopy.finalTitle}</h2>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link className={buttonClass("primary", "w-full sm:w-auto")} href="#formacoes">
              {publicHomeCopy.finalPrimaryCta}
            </Link>
            <Link className={navigationLinkClass()} href="#aulas-gratuitas">
              {publicHomeCopy.secondaryCta}
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
