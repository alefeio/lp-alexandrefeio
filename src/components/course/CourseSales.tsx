import Image from "next/image";
import Link from "next/link";
import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { ViewEvent } from "@/components/analytics/ViewEvent";
import { JsonLd } from "@/components/seo/JsonLd";
import { CourseCurriculum } from "@/components/course/CourseCurriculum";
import { CourseFreeLessons } from "@/components/course/CourseFreeLessons";
import { CourseHero, formatHeroPrice } from "@/components/course/CourseHero";
import { CoursePurchasePanel } from "@/components/course/CoursePurchasePanel";
import { CourseResults } from "@/components/course/CourseResults";
import type { SalesCourse } from "@/components/course/sales-types";
import { Container } from "@/components/ui/Container";
import { buttonClass, navigationLinkClass } from "@/lib/button-styles";
import { isCommerceEnabled, isProductForSale } from "@/lib/commerce/config";
import { courseExperience, TRAFFIC_COURSE_SLUG, type LessonExperience } from "@/lib/learning/course-experience";
import { courseSalesCopy } from "@/lib/learning/course-sales-copy";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";
import { breadcrumbList, courseJsonLd } from "@/lib/seo/learning-jsonld";

const COURSE_TITLES: Record<string, string> = {
  [TRAFFIC_COURSE_SLUG]: "Tráfego Pago na Prática para Pequenos Negócios",
  [SITES_COURSE_SLUG]: "Sites que Convertem para Pequenos Negócios",
};

export function CourseSales({ course, ownedLessonIds = [] }: { course: SalesCourse; ownedLessonIds?: string[] }) {
  const copy = courseSalesCopy(course.slug, course.title);
  const experience = courseExperience(course.slug);
  const commerce = isCommerceEnabled();
  const courseOpen = isProductForSale(course.commerceStatus, course.bundlePriceCents);
  const allLessons = course.modules.flatMap((moduleRow) => moduleRow.lessons);
  const paidLessons = allLessons.filter((lesson) => lesson.accessType === "PAID");
  const freeLessons = allLessons.filter((lesson) => lesson.accessType === "FREE");
  const ownsAllPaid = paidLessons.length > 0 && paidLessons.every((lesson) => ownedLessonIds.includes(lesson.id));
  const hasPartialPurchase = ownedLessonIds.length > 0 && !ownsAllPaid;
  const individualTotalCents = paidLessons.reduce((sum, lesson) => sum + (lesson.priceCents ?? 0), 0);
  const savingsCents =
    course.bundlePriceCents != null && individualTotalCents > course.bundlePriceCents
      ? individualTotalCents - course.bundlePriceCents
      : 0;
  const salesOpen = course.modules.some(
    (moduleRow) =>
      isProductForSale(moduleRow.commerceStatus, moduleRow.bundlePriceCents, commerce) ||
      moduleRow.lessons.some((lesson) => lesson.accessType === "PAID" && isProductForSale(lesson.commerceStatus, lesson.priceCents, commerce)),
  );
  const hidePrices = copy.hidePricesWhenNotForSale && !courseOpen && !salesOpen;
  const firstFree = freeLessons.find((lesson) => lesson.hasBody) ?? freeLessons[0];
  const freeReady = freeLessons.filter((lesson) => lesson.hasBody);
  const lessonsBySlug: Record<string, LessonExperience> = {};
  for (const lesson of experience?.lessons ?? []) lessonsBySlug[lesson.slug] = lesson;
  const artifactNote =
    course.slug === TRAFFIC_COURSE_SLUG
      ? "Nas aulas de análise, você também pode enviar um CSV ou XLSX privado da campanha. O arquivo não aparece em páginas públicas."
      : "A página publicada fica na plataforma. A formação não exporta código, não abre WordPress e não inclui domínio próprio.";

  return (
    <>
      <ViewEvent event="course_view" slug={course.slug} courseSlug={course.slug} />
      <JsonLd
        data={courseJsonLd({
          title: course.title,
          description: course.description,
          path: `/cursos/${course.slug}`,
          hasFreeContent: freeReady.length > 0,
        })}
      />
      <JsonLd
        data={breadcrumbList([
          { name: "Cursos", path: "/cursos" },
          { name: course.title, path: `/cursos/${course.slug}` },
        ])}
      />
      <CourseHero
        slug={course.slug}
        eyebrow={copy.heroEyebrow}
        title={copy.heroTitle}
        support={copy.heroSupport}
        primaryCta={copy.primaryCta}
        primaryCtaName={copy.primaryCtaName}
        secondaryCta={copy.secondaryCta}
        secondaryHref={copy.secondaryHref}
        secondaryCtaName={copy.secondaryCtaName}
        riskNote={copy.heroRiskNote}
        primaryHref={firstFree ? `/aulas/${firstFree.slug}` : "#aulas-gratuitas"}
        ownsAllPaid={ownsAllPaid}
        priceLabel={formatHeroPrice(course.bundlePriceCents, courseOpen && !hidePrices)}
      />
      {experience ? <CourseResults courseSlug={course.slug} featured={experience.featuredArtifacts} note={artifactNote} /> : null}
      <CourseFreeLessons
        courseSlug={course.slug}
        title={copy.freeSectionTitle}
        intro={copy.freeSectionIntro}
        lessons={freeLessons}
        experiences={lessonsBySlug}
        ownedLessonIds={ownedLessonIds}
      />
      <CourseCurriculum
        courseSlug={course.slug}
        modules={course.modules}
        lessonsBySlug={lessonsBySlug}
        commerce={commerce}
        ownedLessonIds={ownedLessonIds}
        hidePrices={hidePrices}
      />
      <CoursePurchasePanel
        courseId={course.id}
        courseSlug={course.slug}
        courseTitle={course.title}
        title={copy.fullCourseTitle}
        support={copy.fullCourseSupport}
        lessonCount={allLessons.length}
        moduleCount={course.modules.length}
        freeCount={freeReady.length}
        outcome={experience?.shortOutcome ?? course.description}
        benefits={copy.offerBenefits}
        bundlePriceCents={course.bundlePriceCents}
        individualTotalCents={individualTotalCents}
        savingsCents={savingsCents}
        courseOpen={courseOpen}
        hidePrices={hidePrices}
        ownsAllPaid={ownsAllPaid}
        hasPartialPurchase={hasPartialPurchase}
        paidLessonIds={paidLessons.map((lesson) => lesson.id)}
        firstFreeHref={firstFree?.hasBody ? `/aulas/${firstFree.slug}` : null}
      />
      <section className="border-t border-border py-14">
        <Container className="flex max-w-3xl flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border">
            <Image src="/alexandre.jpg" alt="Alexandre Feio" fill sizes="80px" className="object-cover" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">Conteúdo por Alexandre Feio</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Desenvolvimento, marketing e produto para transformar atenção em ação.
            </p>
            <p className="mt-3">
              <Link className={navigationLinkClass()} href="/#sobre">
                Sobre Alexandre
              </Link>
            </p>
          </div>
        </Container>
      </section>
      <section className="border-t border-border py-14">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">Perguntas frequentes</h2>
          <div className="mt-6 divide-y divide-border border-y border-border">
            <FaqItem question="Preciso de conta para as aulas gratuitas?">
              Não. O texto completo abre sem login. A conta serve para guardar progresso, notas e resultados no projeto.
            </FaqItem>
            <FaqItem question={copy.faqBuyTitle}>{salesOpen ? copy.faqBuyBodyOpen : copy.faqBuyBodyClosed}</FaqItem>
            <FaqItem question={copy.faqReplaceTitle}>{copy.faqReplaceBody}</FaqItem>
          </div>
        </Container>
      </section>
      <section className="border-t border-border py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">{copy.nextStepTitle}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {experience ? (
              <article className="rounded-2xl border border-border bg-surface p-5">
                <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Continuar aprendendo</h3>
                <p className="mt-3 text-sm leading-relaxed">{COURSE_TITLES[experience.complementary.slug] ?? experience.complementary.cta}</p>
                <p className="mt-4">
                  <AcquisitionLink
                    className={buttonClass("secondary")}
                    href={`/cursos/${experience.complementary.slug}`}
                    event="course_complementary_click"
                    payload={{ source_course_slug: course.slug, target_course_slug: experience.complementary.slug, cta_name: "curso_complementar" }}
                  >
                    {experience.complementary.cta}
                  </AcquisitionLink>
                </p>
              </article>
            ) : null}
            <article className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-cta">{copy.serviceTitle}</h3>
              <p className="mt-3 text-sm leading-relaxed">{copy.serviceBody}</p>
              <p className="mt-4">
                <AcquisitionLink
                  className={buttonClass("secondary")}
                  href={copy.serviceHref}
                  event="service_from_course_click"
                  payload={{ course_slug: course.slug, cta_name: "conhecer_servico" }}
                >
                  {copy.serviceCta}
                </AcquisitionLink>
              </p>
            </article>
          </div>
        </Container>
      </section>
    </>
  );
}

function FaqItem({ question, children }: { question: string; children: string }) {
  return (
    <details className="group py-4">
      <summary className="cursor-pointer list-none text-base font-medium marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-start justify-between gap-4">
          <span>{question}</span>
          <span className="text-muted group-open:hidden" aria-hidden>+</span>
          <span className="hidden text-muted group-open:inline" aria-hidden>−</span>
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-muted">{children}</p>
    </details>
  );
}
