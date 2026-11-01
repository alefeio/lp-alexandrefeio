import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseSales } from "../src/components/course/CourseSales";
import type { SalesCourse } from "../src/components/course/sales-types";
import { trackEvent } from "../src/lib/analytics";
import { canReadLessonBody } from "../src/lib/learning/access";
import { courseExperience, TRAFFIC_COURSE_SLUG } from "../src/lib/learning/course-experience";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { LESSON_01_SLUG } from "../src/lib/learning/lesson-01";
import { paidLessonAction } from "../src/lib/commerce/sale-action";
import { sitesCourseSeed } from "../src/lib/learning/sites-course";
import { STRATEGIC_JOURNEY_EVENTS } from "../src/lib/product-journey/events";

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

function position(html: string, marker: string): number {
  const index = html.indexOf(marker);
  assert.ok(index >= 0, marker);
  return index;
}

test("tráfego coloca a experiência gratuita antes da formação e Sites preserva a copy", () => {
  delete process.env.COMMERCE_ENABLED;
  delete process.env.COMMERCE_PRODUCTION_READY;
  const traffic = renderToStaticMarkup(createElement(CourseSales, { course: pageCourse(firstCourseSeed) }));
  const sites = renderToStaticMarkup(createElement(CourseSales, { course: pageCourse(sitesCourseSeed) }));
  const hero = readFileSync("src/components/course/CourseHero.tsx", "utf8");
  const sales = readFileSync("src/components/course/CourseSales.tsx", "utf8");

  assert.match(traffic, /Curso prático de tráfego pago/);
  assert.match(traffic, /3 aulas gratuitas/);
  assert.match(traffic, /sem cartão/);
  assert.match(traffic, /sem cadastro para começar/);
  assert.match(traffic, /Começar a 1ª aula grátis/);
  assert.match(traffic, new RegExp(`href="/aulas/${LESSON_01_SLUG}"`));
  assert.match(traffic, /href="#aulas-gratuitas"/);
  assert.match(traffic, /Ver as 3 aulas gratuitas/);
  assert.match(hero, /event="course_free_start"/);
  assert.match(hero, /event="course_cta_click"/);
  assert.match(hero, /primaryCtaName/);
  assert.match(hero, /secondaryCtaName/);

  const heroAt = position(traffic, "Aprenda a planejar campanhas");
  const outcomeAt = position(traffic, "Você não termina sabendo apenas onde clicar");
  const freeAt = position(traffic, 'id="aulas-gratuitas"');
  const builtAt = position(traffic, "O que você vai construir");
  const programAt = position(traffic, 'id="programa"');
  const complementaryAt = position(traffic, "Conhecer Sites que Convertem");
  const serviceAt = position(traffic, "Prefere delegar?");
  assert.ok(heroAt < outcomeAt);
  assert.ok(outcomeAt < freeAt);
  assert.ok(freeAt < builtAt);
  assert.ok(builtAt < programAt);
  assert.ok(programAt < complementaryAt);
  assert.ok(complementaryAt < serviceAt);
  assert.equal(traffic.slice(heroAt, freeAt).includes("Conhecer Sites que Convertem"), false);

  assert.match(traffic, /Comece sem cadastro/);
  assert.match(traffic, /Ver todas as entregas da formação/);
  const experience = courseExperience(TRAFFIC_COURSE_SLUG);
  assert.ok(experience);
  for (const artifact of experience.artifacts) assert.equal(traffic.includes(artifact), true, artifact);
  assert.match(traffic, /CSV ou XLSX/);

  assert.match(sites, /Começar gratuitamente/);
  assert.match(sites, /Ver programa completo/);
  assert.match(sites, /Experimente a metodologia com seu próprio negócio/);
  assert.match(sites, /Planeje, construa e publique sua própria landing page enquanto aprende/);
  assert.equal(sites.includes("sem cartão"), false);
  assert.equal(sites.includes("Aprenda a planejar campanhas"), false);
  assert.equal(sites.includes("Ver as 3 aulas gratuitas"), false);
  assert.equal(sites.includes("Ver todas as entregas da formação"), false);
  const sitesFree = position(sites, 'id="aulas-gratuitas"');
  const sitesProgram = position(sites, 'id="programa"');
  const sitesComplementary = position(sites, "Conhecer Tráfego Pago");
  assert.ok(sitesComplementary < sitesFree);
  assert.ok(sitesProgram < sitesFree);

  assert.match(sales, /isProductForSale/);
  assert.match(sales, /paidLessonIds/);
  assert.equal(paidLessonAction({ open: true, owned: false }), "buy");
  assert.equal(paidLessonAction({ open: false, owned: false }), "soon");
});

test("a primeira aula gratuita abre sem sessão e os eventos de clique e de leitura continuam distintos", () => {
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "FREE" }, { entitled: false }), true);
  const page = readFileSync("src/app/(learn)/aulas/[slug]/page.tsx", "utf8");
  const reader = readFileSync("src/components/learning/LessonReader.tsx", "utf8");
  assert.match(page, /LessonReader/);
  assert.match(page, /canReadLessonBody/);
  assert.equal(page.includes('redirect("/entrar"'), false);
  assert.equal(page.includes("redirect('/entrar'"), false);
  assert.match(reader, /lesson_started/);
  assert.equal(reader.includes("course_free_start"), false);
  assert.equal(STRATEGIC_JOURNEY_EVENTS.includes("course_free_start"), true);
  assert.equal(STRATEGIC_JOURNEY_EVENTS.includes("lesson_started"), true);
  assert.notEqual(
    STRATEGIC_JOURNEY_EVENTS.indexOf("course_free_start"),
    STRATEGIC_JOURNEY_EVENTS.indexOf("lesson_started"),
  );
});

test("sign_up só nasce depois do cadastro e não carrega dado pessoal", () => {
  const form = readFileSync("src/components/auth/AuthForms.tsx", "utf8");
  const signup = form.slice(form.indexOf("function SignUpForm"));
  const call = signup.indexOf('trackEvent("sign_up", { method: "email" })');
  const failure = signup.indexOf("if (authError)");
  const invalid = signup.indexOf("if (name.length < 2");
  assert.ok(invalid >= 0 && invalid < call);
  assert.ok(failure >= 0 && failure < call);
  assert.match(signup, /trackEvent\("sign_up", \{ method: "email" \}\)/);
  assert.equal(signup.includes('trackEvent("sign_up", { method: "email",'), false);

  const scope = globalThis as unknown as { window?: unknown };
  const previous = scope.window;
  const dataLayer: Array<Record<string, unknown>> = [];
  let persisted = 0;
  const previousFetch = globalThis.fetch;
  scope.window = {
    dataLayer,
    localStorage: { getItem: () => null },
    location: { pathname: "/criar-conta" },
  };
  globalThis.fetch = (() => {
    persisted += 1;
    return Promise.resolve(new Response(null, { status: 202 }));
  }) as typeof fetch;
  try {
    trackEvent("sign_up", { method: "email" });
  } finally {
    scope.window = previous;
    globalThis.fetch = previousFetch;
  }
  assert.deepEqual(dataLayer, [{ event: "sign_up", method: "email" }]);
  // Clique de Google Ads não equivale a JourneyEvent quando analytics não foi autorizado.
  assert.equal(persisted, 0);
  assert.equal(STRATEGIC_JOURNEY_EVENTS.includes("sign_up"), true);
});
