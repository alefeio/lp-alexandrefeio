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

test("segundo curso existe no catálogo editorial scaffold", () => {
  assert.equal(sitesCourseSeed.slug, SITES_COURSE_SLUG);
  assert.equal(sitesCourseSeed.title, "Sites que Convertem para Pequenos Negócios");
  assert.equal(sitesCourseSeed.sortOrder, 1);
  assert.equal(sitesCourseSeed.status, "DRAFT");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(sitesCourseEditorial.contentStatus, "SCAFFOLDED");
  assert.equal(sitesCourseEditorial.publicRelease, "NOT_APPROVED");
  assert.equal(sitesCourseEditorial.commerceRelease, "NOT_APPROVED");
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
    sitesCourseSeed.modules.map((moduleRow) => moduleRow.slug),
    [
      "antes-de-construir",
      "planeje-antes-de-desenhar",
      "estruture-e-comunique",
      "atencao-e-confianca",
      "publique-mea-e-melhore",
    ],
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
  for (const moduleRow of sitesCourseSeed.modules) {
    moduleRow.lessons.forEach((lesson, index) => {
      assert.equal(lesson.sortOrder, index);
    });
  }
});

test("aulas 1–3 FREE e 4–12 PAID", () => {
  const lessons = sitesCourseLessons();
  assert.deepEqual(
    lessons.slice(0, 3).map((lesson) => lesson.accessType),
    ["FREE", "FREE", "FREE"],
  );
  assert.ok(lessons.slice(0, 3).every((lesson) => lesson.priceCents === null));
  assert.ok(lessons.slice(3).every((lesson) => lesson.accessType === "PAID"));
  assert.deepEqual(
    lessons.slice(3).map((lesson) => lesson.priceCents),
    [3490, 3490, 3990, 3990, 3490, 3490, 3490, 3990, 3990],
  );
});

test("preços planejados: aulas 334,10 · módulos 301,60 · curso 249,90", () => {
  assert.equal(sitesCoursePaidLessonsTotalCents(), 33410);
  assert.equal(sitesCoursePaidModulesTotalCents(), 30160);
  assert.equal(sitesCourseSeed.bundlePriceCents, 24990);
  assert.deepEqual(
    sitesCourseSeed.modules.map((moduleRow) => moduleRow.bundlePriceCents),
    [null, 6290, 7190, 6290, 10390],
  );
});

test("todos os produtos novos ficam NOT_FOR_SALE e nenhum AVAILABLE", () => {
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(sitesCourseEditorial.commerceStatus, "NOT_FOR_SALE");
  assert.ok(sitesCourseLessons().every((lesson) => lesson.accessType === "FREE" || lesson.priceCents != null));
  const deploy = readFileSync(new URL("../src/lib/learning/catalog-deploy.ts", import.meta.url), "utf8");
  const scaffoldFn = deploy.slice(deploy.indexOf("export async function deploySitesCourseScaffold"));
  assert.match(scaffoldFn, /status: "DRAFT"/);
  assert.match(scaffoldFn, /commerceStatus: "NOT_FOR_SALE"/);
  assert.match(scaffoldFn, /commerceStatus: commerceStatusForCreate\(\)/);
  assert.equal(scaffoldFn.includes("AVAILABLE"), false);
});
test("novo curso não é público, indexável nem entra no sitemap", () => {
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

test("Tools e resultados ficam só no plano editorial", () => {
  const tools = sitesCoursePlannedTools();
  assert.equal(tools.length, 12);
  assert.ok(tools.every((tool) => tool.endsWith("_V1")));
  assert.ok(sitesCourseLessons().every((lesson) => lesson.plannedResult.length > 0));
  const sitesSource = readFileSync(new URL("../src/lib/learning/sites-course.ts", import.meta.url), "utf8");
  assert.equal(sitesSource.includes('type: "TOOL"'), false);
  assert.equal(sitesSource.includes("prisma.lessonResult"), false);
  assert.equal(sitesSource.includes("blocks:"), false);
  const deploy = readFileSync(new URL("../src/lib/learning/catalog-deploy.ts", import.meta.url), "utf8");
  const scaffoldFn = deploy.slice(deploy.indexOf("export async function deploySitesCourseScaffold"));
  assert.equal(scaffoldFn.includes("createMany"), false);
  assert.equal(scaffoldFn.includes("lessonBlock.create"), false);
  assert.equal(scaffoldFn.includes("lessonResult"), false);
});
test("primeiro curso permanece intacto no seed", () => {
  assert.equal(firstCourseSeed.slug, "trafego-pago-na-pratica");
  assert.equal(firstCourseSeed.bundlePriceCents, 24990);
  assert.equal(firstCourseSeed.modules.length, 5);
  const lessons = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons);
  assert.equal(lessons.length, 12);
  assert.deepEqual(
    firstCourseSeed.modules.map((moduleRow) => moduleRow.bundlePriceCents),
    [null, 5790, 10390, 7190, 6790],
  );
  assert.deepEqual(
    lessons.map((lesson) => lesson.slug),
    [
      "como-funciona-o-trafego-pago",
      "google-ads-ou-meta-ads",
      "negocio-pronto-para-anunciar",
      "objetivo-oferta-orcamento",
      "destino-e-mensuracao",
      "campanha-de-pesquisa",
      "palavras-chave-com-intencao",
      "anuncios-alinhados-a-conversao",
      "objetivo-publico-estrutura",
      "campanhas-leads-whatsapp",
      "leia-os-numeros",
      "o-que-mudar",
    ],
  );
  const sitesSlugs = new Set(sitesCourseLessons().map((lesson) => lesson.slug));
  for (const lesson of lessons) {
    assert.equal(sitesSlugs.has(lesson.slug), false);
  }
});

test("scaffold é idempotente por slugs estáveis", () => {
  const first = sitesCourseLessons().map((lesson) => lesson.slug);
  const second = sitesCourseLessons().map((lesson) => lesson.slug);
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, 12);
  assert.equal(new Set(sitesCourseSeed.modules.map((moduleRow) => moduleRow.slug)).size, 5);
  const deploy = readFileSync(new URL("../src/lib/learning/catalog-deploy.ts", import.meta.url), "utf8");
  assert.match(deploy, /where: \{ slug: sitesCourseSeed\.slug \}/);
  assert.match(deploy, /courseId_slug/);
  assert.match(deploy, /where: \{ slug: lessonSeed\.slug \}/);
});

test("documentação do curso registra status SCAFFOLDED", () => {
  const doc = readFileSync(new URL("../docs/courses/sites-que-convertem.md", import.meta.url), "utf8");
  assert.match(doc, /CONTENT_STATUS \| SCAFFOLDED/);
  assert.match(doc, /PUBLIC_RELEASE \| NOT_APPROVED/);
  assert.match(doc, /COMMERCE_RELEASE \| NOT_APPROVED/);
  assert.match(doc, /sites-que-convertem/);
  assert.match(doc, /R\$ 249,90/);
  assert.match(doc, /R\$ 334,10/);
  assert.match(doc, /R\$ 301,60/);
});
