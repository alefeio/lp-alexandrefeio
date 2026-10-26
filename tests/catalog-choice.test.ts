import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseCatalog } from "../src/components/course/CourseCatalog";
import { catalogPageCopy } from "../src/lib/learning/catalog-copy";
import type { CourseCatalogCard } from "../src/lib/learning/course-catalog";
import { courseExperience, TRAFFIC_COURSE_SLUG } from "../src/lib/learning/course-experience";
import { acquisitionAnalyticsPayload } from "../src/lib/learning/acquisition-analytics";
import { SITES_COURSE_SLUG } from "../src/lib/learning/sites-course";

function card(slug: string, title: string, ctaLabel: CourseCatalogCard["ctaLabel"], progress: CourseCatalogCard["progress"] = null): CourseCatalogCard {
  return {
    id: slug,
    slug,
    title,
    summary: `Resumo ${slug}`,
    lessonCount: 12,
    moduleCount: 5,
    freeLessonCount: 3,
    freeLessons: [],
    href: `/cursos/${slug}`,
    ctaLabel,
    microcopy: ctaLabel === "Conhecer o curso" ? "Comece gratuitamente" : null,
    progress,
  };
}

test("o catálogo orienta a escolha a partir da experiência e do progresso", () => {
  const traffic = courseExperience(TRAFFIC_COURSE_SLUG);
  const sites = courseExperience(SITES_COURSE_SLUG);
  assert.ok(traffic);
  assert.ok(sites);
  const html = renderToStaticMarkup(createElement(CourseCatalog, {
    courses: [
      card(SITES_COURSE_SLUG, "Sites que Convertem para Pequenos Negócios", "Continuar curso", { label: "Em andamento", detail: "2 de 4 aulas" }),
      card(TRAFFIC_COURSE_SLUG, "Tráfego Pago na Prática para Pequenos Negócios", "Conhecer o curso"),
    ],
  }));
  assert.match(html, /Escolha onde seu negócio precisa avançar/);
  assert.match(html, /Tráfego/);
  assert.match(html, /Página/);
  assert.match(html, /O anúncio leva até a página/);
  assert.match(html, new RegExp(traffic.transformation.slice(0, 32)));
  assert.match(html, new RegExp(sites.shortOutcome.slice(0, 24)));
  assert.match(html, new RegExp(`/cursos/${TRAFFIC_COURSE_SLUG}`));
  assert.match(html, new RegExp(`/cursos/${SITES_COURSE_SLUG}`));
  assert.match(html, /Conhecer o curso/);
  assert.match(html, /Continuar curso/);
  assert.match(html, /Em andamento · 2 de 4 aulas/);
  assert.match(html, /Comece gratuitamente/);
  assert.match(html, /Não sabe por onde começar/);
  assert.equal(html.includes("249,90"), false);
  assert.match(catalogPageCopy.description, /tráfego|atrair/i);
  assert.match(catalogPageCopy.description, /páginas/);

  const page = readFileSync("src/app/(public)/cursos/page.tsx", "utf8");
  assert.match(page, /canonical: "\/cursos"/);
  assert.match(page, /catalogPageCopy/);
});

test("caminho do catálogo não leva dado privado", () => {
  const payload = acquisitionAnalyticsPayload({
    course_slug: TRAFFIC_COURSE_SLUG,
    scenario: "atrair",
    email: "a@b.com",
  } as never);
  assert.deepEqual(payload, { course_slug: TRAFFIC_COURSE_SLUG, scenario: "atrair" });
});
