import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canIndexLesson, isPublicLesson } from "../src/lib/learning/access";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import {
  SITES_COURSE_SLUG,
  sitesCourseEditorial,
  sitesCourseIsPubliclyVisible,
  sitesCourseLessons,
  sitesCoursePaidLessonsTotalCents,
  sitesCoursePaidModulesTotalCents,
  sitesCoursePlannedTools,
  sitesCourseSeed,
} from "../src/lib/learning/sites-course";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";

test("segundo curso existe no scaffold com release suspenso e promessa de landing page", () => {
  assert.equal(sitesCourseSeed.slug, SITES_COURSE_SLUG);
  assert.equal(sitesCourseSeed.title, "Sites que Convertem para Pequenos Negócios");
  assert.equal(sitesCourseSeed.sortOrder, 1);
  assert.equal(sitesCourseSeed.status, "DRAFT");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(sitesCourseEditorial.contentStatus, "REFRAMED_LANDING_PAGE_BUILDER");
  assert.equal(sitesCourseEditorial.publicRelease, "SUSPENDED");
  assert.equal(sitesCourseEditorial.commerceRelease, "NOT_APPROVED");
  assert.equal(sitesCourseEditorial.paidBoundary, "BUILD_AND_PUBLISH");
  assert.match(sitesCourseSeed.subtitle, /publique sua própria landing page/i);
  assert.equal(sitesCourseIsPubliclyVisible(), false);
});

test("scaffold tem 5 módulos e 12 aulas na ordem correta", () => {
  assert.equal(sitesCourseSeed.modules.length, 5);
  const lessons = sitesCourseLessons();
  assert.equal(lessons.length, 12);
  assert.deepEqual(
    sitesCourseSeed.modules.map((moduleRow) => moduleRow.sortOrder),
    [0, 1, 2, 3, 4],
  );
  assert.deepEqual(
    lessons.map((lesson) => lesson.slug),
    [
      "site-ajuda-a-vender",
      "site-landing-page-ou-whatsapp",
      "pagina-pronta-para-converter",
      "oferta-publico-acao-principal",
      "jornada-do-visitante",
      "organize-as-secoes-da-pagina",
      "mensagem-que-deixa-a-oferta-clara",
      "hierarquia-visual-e-atencao",
      "construa-confianca",
      "pagina-mobile-e-experiencia",
      "mensuracao-da-pagina",
      "revisao-antes-do-trafego",
    ],
  );
});

test("aulas 1–3 FREE e 4–12 PAID com resultados do builder", () => {
  const lessons = sitesCourseLessons();
  assert.deepEqual(
    lessons.slice(0, 3).map((lesson) => lesson.accessType),
    ["FREE", "FREE", "FREE"],
  );
  assert.ok(lessons.slice(3).every((lesson) => lesson.accessType === "PAID"));
  assert.deepEqual(
    lessons.slice(3).map((lesson) => lesson.plannedResult),
    [
      "Brief de conversão da minha landing page",
      "Mapa de decisão do visitante",
      "Estrutura da minha landing page",
      "Copy da minha landing page",
      "Direção visual da minha landing page",
      "Plano de confiança da minha landing page",
      "Revisão de experiência da minha landing page",
      "Mapa de mensuração aplicado ao projeto",
      "Landing page publicada",
    ],
  );
  assert.deepEqual(
    lessons.slice(3).map((lesson) => lesson.plannedTool),
    [
      "CONVERSION_PAGE_BRIEF_V1",
      "VISITOR_DECISION_JOURNEY_V1",
      "LANDING_PAGE_WIREFRAME_V1",
      "LANDING_PAGE_COPY_ASSIST_V1",
      "LANDING_PAGE_VISUAL_DIRECTION_V1",
      "LANDING_PAGE_TRUST_V1",
      "LANDING_PAGE_EXPERIENCE_REVIEW_V1",
      "LANDING_PAGE_MEASUREMENT_V1",
      "LANDING_PAGE_PUBLISH_V1",
    ],
  );
  assert.equal(lessons[11]!.title, "Revise e publique sua landing page");
});

test("preços planejados: aulas 334,10 · módulos 301,60 · curso 249,90", () => {
  assert.equal(sitesCoursePaidLessonsTotalCents(), 33410);
  assert.equal(sitesCoursePaidModulesTotalCents(), 30160);
  assert.equal(sitesCourseSeed.bundlePriceCents, 24990);
});

test("todos os produtos novos ficam NOT_FOR_SALE e scaffold força DRAFT", () => {
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  const deploy = readFileSync(new URL("../src/lib/learning/catalog-deploy.ts", import.meta.url), "utf8");
  const scaffoldFn = deploy.slice(deploy.indexOf("export async function deploySitesCourseScaffold"));
  assert.match(scaffoldFn, /status: "DRAFT"/);
  assert.match(scaffoldFn, /commerceStatus: "NOT_FOR_SALE"/);
  assert.equal(scaffoldFn.includes("AVAILABLE"), false);
  assert.equal(scaffoldFn.includes("LandingPageProject"), false);
});

test("curso sites não é público nem entra no sitemap", () => {
  assert.equal(sitesCourseIsPubliclyVisible("DRAFT"), false);
  assert.equal(isPublicLesson({ status: "DRAFT" }), false);
  assert.equal(canIndexLesson({ status: "DRAFT", accessType: "FREE", publicPreview: null }, false), false);
  const sitemap = buildPublicSitemap("https://alexandrefeio.com.br", {
    courses: [{ slug: firstCourseSeed.slug, updatedAt: new Date() }],
    lessons: [
      { slug: "como-funciona-o-trafego-pago", updatedAt: new Date(), indexable: true },
      { slug: "site-ajuda-a-vender", updatedAt: new Date(), indexable: false },
    ],
  });
  assert.equal(sitemap.some((entry) => entry.url.includes(SITES_COURSE_SLUG)), false);
  assert.equal(sitemap.some((entry) => entry.url.includes("site-ajuda-a-vender")), false);
  assert.equal(sitemap.some((entry) => entry.url.endsWith(`/cursos/${firstCourseSeed.slug}`)), true);
});

test("Tools planejadas; scaffold não cria blocks/results do builder", () => {
  const tools = sitesCoursePlannedTools();
  assert.equal(tools.length, 12);
  assert.ok(tools.every((tool) => tool.endsWith("_V1")));
  const sitesSource = readFileSync(new URL("../src/lib/learning/sites-course.ts", import.meta.url), "utf8");
  assert.equal(sitesSource.includes('type: "TOOL"'), false);
  assert.equal(sitesSource.includes("prisma.lessonResult"), false);
  const deploy = readFileSync(new URL("../src/lib/learning/catalog-deploy.ts", import.meta.url), "utf8");
  const scaffoldFn = deploy.slice(deploy.indexOf("export async function deploySitesCourseScaffold"));
  assert.equal(scaffoldFn.includes("lessonBlock.create"), false);
});

test("primeiro curso permanece intacto no seed", () => {
  assert.equal(firstCourseSeed.slug, "trafego-pago-na-pratica");
  assert.equal(firstCourseSeed.bundlePriceCents, 24990);
  const lessons = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons);
  assert.equal(lessons.length, 12);
  const sitesSlugs = new Set(sitesCourseLessons().map((lesson) => lesson.slug));
  for (const lesson of lessons) {
    assert.equal(sitesSlugs.has(lesson.slug), false);
  }
});

test("documentação e ADR registram reframe e release suspenso", () => {
  const doc = readFileSync(new URL("../docs/courses/sites-que-convertem.md", import.meta.url), "utf8");
  const adr = readFileSync(new URL("../docs/adr/landing-page-builder-v1.md", import.meta.url), "utf8");
  assert.match(doc, /CONTENT_STATUS \| REFRAMED_LANDING_PAGE_BUILDER/);
  assert.match(doc, /PUBLIC_RELEASE \| SUSPENDED/);
  assert.match(doc, /COMMERCE_RELEASE \| NOT_APPROVED/);
  assert.match(doc, /LandingPageProject/);
  assert.match(doc, /R\$ 249,90/);
  assert.match(doc, /NOT_FOR_SALE/);
  assert.match(adr, /LandingPageProject/);
  assert.match(adr, /\/p\/\[slug\]/);
  assert.match(adr, /noindex/);
  assert.match(adr, /Open business decisions/i);
  assert.match(adr, /Arbitrary code execution/i);
  assert.match(adr, /DEFERRED/);
});
