import Link from "next/link";
import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { ViewEvent } from "@/components/analytics/ViewEvent";
import { JsonLd } from "@/components/seo/JsonLd";
import { ComplementaryCourse } from "@/components/course/ComplementaryCourse";
import { CourseArtifacts } from "@/components/course/CourseArtifacts";
import { CourseCurriculum } from "@/components/course/CourseCurriculum";
import { CourseFreeLessons } from "@/components/course/CourseFreeLessons";
import { CourseHero, formatHeroPrice } from "@/components/course/CourseHero";
import { CourseOutcome } from "@/components/course/CourseOutcome";
import { CoursePurchasePanel } from "@/components/course/CoursePurchasePanel";
import type { SalesCourse } from "@/components/course/sales-types";
import { Container } from "@/components/ui/Container";
import { aboutContent } from "@/data/home";
import { buttonClass } from "@/lib/button-styles";
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
        secondaryCta={copy.secondaryCta}
        primaryHref={firstFree ? `/aulas/${firstFree.slug}` : "#aulas-gratuitas"}
        ownsAllPaid={ownsAllPaid}
        priceLabel={formatHeroPrice(course.bundlePriceCents, courseOpen && !hidePrices)}
      />
      {experience ? (
        <CourseOutcome headline={experience.outcomeHeadline} transformation={experience.transformation} steps={experience.outcomeSteps} />
      ) : null}
      {experience ? <CourseArtifacts featured={experience.featuredArtifacts} artifacts={experience.artifacts} note={artifactNote} /> : null}
      <CourseCurriculum
        courseSlug={course.slug}
        modules={course.modules}
        lessonsBySlug={lessonsBySlug}
        commerce={commerce}
        ownedLessonIds={ownedLessonIds}
        hidePrices={hidePrices}
      />
      {experience ? (
        <ComplementaryCourse
          sourceSlug={course.slug}
          targetSlug={experience.complementary.slug}
          targetTitle={COURSE_TITLES[experience.complementary.slug] ?? experience.complementary.cta}
          headline={experience.complementary.headline}
          body={experience.complementary.body}
          cta={experience.complementary.cta}
        />
      ) : null}
      <CourseFreeLessons
        courseSlug={course.slug}
        title={copy.freeSectionTitle}
        lessons={freeLessons}
        experiences={lessonsBySlug}
        ownedLessonIds={ownedLessonIds}
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
        artifacts={experience?.artifacts ?? []}
        benefits={experience?.benefits ?? []}
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
      <section className="border-t border-border py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">Conteúdo por Alexandre Feio</h2>
          <p className="mt-3 text-base leading-relaxed">{aboutContent.description}</p>
          <p className="mt-4">
            <Link className="text-sm font-medium underline underline-offset-4" href="/#sobre">
              Sobre Alexandre Feio
            </Link>
          </p>
        </Container>
      </section>
      <section className="border-t border-border py-16">
        <Container className="max-w-3xl space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">Perguntas frequentes</h2>
          <div>
            <h3 className="font-medium">Preciso de conta para as aulas gratuitas?</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">Não. O texto completo abre sem login. A conta serve para guardar progresso, notas e resultados no projeto.</p>
          </div>
          <div>
            <h3 className="font-medium">{copy.faqBuyTitle}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{salesOpen ? copy.faqBuyBodyOpen : copy.faqBuyBodyClosed}</p>
          </div>
          <div>
            <h3 className="font-medium">{copy.faqReplaceTitle}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{copy.faqReplaceBody}</p>
          </div>
        </Container>
      </section>
      <section className="border-t border-border py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">{copy.serviceTitle}</h2>
          <p className="mt-3 text-base leading-relaxed">{copy.serviceBody}</p>
          <p className="mt-6">
            <AcquisitionLink
              className={buttonClass("secondary")}
              href={copy.serviceHref}
              event="service_from_course_click"
              payload={{ course_slug: course.slug, cta_name: "conhecer_servico" }}
            >
              {copy.serviceCta}
            </AcquisitionLink>
          </p>
        </Container>
      </section>
    </>
  );
}
