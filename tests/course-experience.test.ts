import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CoursePurchasePanel } from "../src/components/course/CoursePurchasePanel";
import { CourseSales } from "../src/components/course/CourseSales";
import type { SalesCourse } from "../src/components/course/sales-types";
import { acquisitionAnalyticsPayload } from "../src/lib/learning/acquisition-analytics";
import { courseExperience, courseExperiences, TRAFFIC_COURSE_SLUG } from "../src/lib/learning/course-experience";
import { FIRST_COURSE_SLUG, firstCourseSeed } from "../src/lib/learning/first-course";
import { paidLessonAction } from "../src/lib/commerce/sale-action";
import { SITES_COURSE_SLUG, sitesCourseSeed } from "../src/lib/learning/sites-course";

function lessonSlugs(seed: { modules: { lessons: { slug: string }[] }[] }) {
  return seed.modules.flatMap((moduleRow) => moduleRow.lessons.map((lesson) => lesson.slug));
}

function pageCourse(seed: typeof firstCourseSeed | typeof sitesCourseSeed): SalesCourse {
  return {
    id: seed.slug,
    slug: seed.slug,
    title: seed.title,
    subtitle: seed.subtitle,
    description: seed.description,
    bundlePriceCents: seed.bundlePriceCents,
    commerceStatus: "NOT_FOR_SALE",
    modules: seed.modules.map((moduleRow) => ({
      id: moduleRow.slug,
      title: moduleRow.title,
      description: moduleRow.description,
      bundlePriceCents: moduleRow.bundlePriceCents,
      commerceStatus: "NOT_FOR_SALE",
      lessons: moduleRow.lessons.map((lesson) => ({
        id: lesson.slug,
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        estimatedMinutes: lesson.estimatedMinutes,
        accessType: lesson.accessType,
        commerceStatus: "NOT_FOR_SALE",
        priceCents: lesson.priceCents,
        hasPublicPreview: lesson.accessType === "PAID",
        hasBody: true,
      })),
    })),
  };
}

test("as 24 aulas publicadas têm aprende, pratica e leva", () => {
  const trafficSlugs = lessonSlugs(firstCourseSeed);
  const sitesSlugs = lessonSlugs(sitesCourseSeed);
  assert.equal(trafficSlugs.length, 12);
  assert.equal(sitesSlugs.length, 12);
  assert.equal(new Set([...trafficSlugs, ...sitesSlugs]).size, 24);
  for (const [slug, expected] of [
    [TRAFFIC_COURSE_SLUG, trafficSlugs],
    [SITES_COURSE_SLUG, sitesSlugs],
  ] as const) {
    const experience = courseExperience(slug);
    assert.ok(experience);
    const actual = experience.lessons.map((lesson) => lesson.slug);
    assert.deepEqual(actual, expected);
    assert.equal(new Set(actual).size, actual.length);
    for (const lesson of experience.lessons) {
      assert.ok(lesson.learns.length >= 1, lesson.slug);
      assert.ok(lesson.practices.length >= 1, lesson.slug);
      assert.ok(lesson.outcome.trim().length > 0, lesson.slug);
      assert.equal("estimatedMinutes" in lesson, false);
    }
  }
  const known = new Set([...trafficSlugs, ...sitesSlugs]);
  for (const experience of courseExperiences()) {
    for (const lesson of experience.lessons) assert.equal(known.has(lesson.slug), true);
  }
});

test("cada curso aponta para o outro e o destino existe", () => {
  assert.equal(TRAFFIC_COURSE_SLUG, FIRST_COURSE_SLUG);
  const catalog = new Set([firstCourseSeed.slug, sitesCourseSeed.slug]);
  for (const experience of courseExperiences()) {
    assert.notEqual(experience.complementary.slug, experience.slug);
    assert.equal(catalog.has(experience.complementary.slug), true);
    assert.ok(courseExperience(experience.complementary.slug));
  }
  assert.equal(courseExperience(TRAFFIC_COURSE_SLUG)?.complementary.slug, SITES_COURSE_SLUG);
  assert.equal(courseExperience(SITES_COURSE_SLUG)?.complementary.slug, TRAFFIC_COURSE_SLUG);
  assert.equal(sitesCourseSeed.bundlePriceCents, 24990);
});

test("evento complementar só leva os slugs dos cursos", () => {
  const payload = acquisitionAnalyticsPayload({
    source_course_slug: TRAFFIC_COURSE_SLUG,
    target_course_slug: SITES_COURSE_SLUG,
    cta_name: "curso_complementar",
    email: "a@b.com",
    budget: "100",
  } as never);
  assert.deepEqual(payload, {
    source_course_slug: TRAFFIC_COURSE_SLUG,
    target_course_slug: SITES_COURSE_SLUG,
    cta_name: "curso_complementar",
  });
});

test("páginas mostram resultado, ementa e curso complementar", () => {
  delete process.env.COMMERCE_ENABLED;
  delete process.env.COMMERCE_PRODUCTION_READY;
  const traffic = renderToStaticMarkup(createElement(CourseSales, { course: pageCourse(firstCourseSeed) }));
  const sites = renderToStaticMarkup(createElement(CourseSales, { course: pageCourse(sitesCourseSeed) }));
  assert.match(traffic, /Você não termina sabendo apenas onde clicar/);
  assert.match(traffic, /O que você aprende e coloca em prática/);
  assert.match(traffic, /Aprende/);
  assert.match(traffic, /Pratica/);
  assert.match(traffic, /Leva/);
  assert.match(traffic, /aria-expanded="false"/);
  assert.match(traffic, /aria-controls="curriculum-como-funciona-o-trafego-pago"/);
  assert.match(traffic, /Conhecer Sites que Convertem/);
  assert.match(traffic, /Começar aula/);
  assert.match(traffic, /249,90/);
  assert.match(traffic, /"@type":"Course"/);
  assert.match(traffic, /"@type":"BreadcrumbList"/);
  assert.doesNotMatch(traffic, /Continuar curso/);
  assert.match(sites, /Você não termina com um exercício/);
  assert.match(sites, /Aprende/);
  assert.match(sites, /Conhecer Tráfego Pago/);
  assert.match(sites, /Começar gratuitamente/);
  assert.equal(sites.includes("page builder"), false);
  assert.equal(sites.includes("fora do catálogo"), false);
  assert.equal(paidLessonAction({ open: true, owned: false }), "buy");
  assert.equal(paidLessonAction({ open: true, owned: true }), "access");
});

test("compra parcial e curso já adquirido continuam reconhecidos", () => {
  const owned = renderToStaticMarkup(createElement(CourseSales, {
    course: pageCourse(firstCourseSeed),
    ownedLessonIds: lessonSlugs(firstCourseSeed).filter((slug) => firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons).find((lesson) => lesson.slug === slug)?.accessType === "PAID"),
  }));
  assert.match(owned, /Continuar curso/);
  assert.equal(owned.includes("Comprar curso completo"), false);
  const partial = renderToStaticMarkup(createElement(CoursePurchasePanel, {
    courseId: "course",
    courseSlug: SITES_COURSE_SLUG,
    courseTitle: sitesCourseSeed.title,
    title: "A formação completa",
    support: "Suporte",
    lessonCount: 12,
    moduleCount: 5,
    freeCount: 3,
    outcome: "Página publicada",
    artifacts: ["Brief de conversão"],
    benefits: ["Publicar uma versão real da landing page"],
    bundlePriceCents: 24990,
    individualTotalCents: 33410,
    savingsCents: 8420,
    courseOpen: false,
    hidePrices: false,
    ownsAllPaid: false,
    hasPartialPurchase: true,
    paidLessonIds: ["aula"],
    firstFreeHref: "/aulas/site-ajuda-a-vender",
  }));
  assert.match(partial, /249,90/);
  assert.equal(partial.includes("Comprar curso completo"), false);
  const purchase = readFileSync("src/components/course/CoursePurchasePanel.tsx", "utf8");
  assert.match(purchase, /hasPartialPurchase && !ownsAllPaid && courseOpen/);
  assert.match(purchase, /Compras anteriores elegíveis viram crédito automaticamente no checkout/);
});

test("commerce e a home permanecem no lugar", () => {
  const sales = readFileSync("src/components/course/CourseSales.tsx", "utf8");
  const purchase = readFileSync("src/components/course/CoursePurchasePanel.tsx", "utf8");
  const curriculum = readFileSync("src/components/course/CourseCurriculum.tsx", "utf8");
  const lessonPage = readFileSync("src/app/(learn)/aulas/[slug]/page.tsx", "utf8");
  const home = readFileSync("src/components/home/CourseHome.tsx", "utf8");
  const page = readFileSync("src/app/(public)/cursos/[slug]/page.tsx", "utf8");
  assert.match(purchase, /AddToCartButton/);
  assert.match(curriculum, /AddToCartButton/);
  assert.match(curriculum, /paidLessonAction/);
  assert.match(sales, /isProductForSale/);
  assert.match(sales, /hasPartialPurchase/);
  assert.match(lessonPage, /LessonPaywall/);
  assert.match(page, /canonical: `\/cursos\/\$\{course\.slug\}`/);
  assert.match(home, /Conhecer o curso/);
  assert.equal(sales.includes("LandingPageProject"), false);
});
