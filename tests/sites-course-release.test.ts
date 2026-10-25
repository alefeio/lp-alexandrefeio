import assert from "node:assert/strict";
import test from "node:test";
import { planCourseEnable, planLessonEnable, planModuleEnable, SALE_ALLOWLIST, type LessonShape } from "../src/lib/commerce/product-activation";
import { FIRST_COURSE_SLUG } from "../src/lib/learning/first-course";
import { LESSON_04_SLUG } from "../src/lib/learning/lesson-04";
import { LESSON_05_SLUG } from "../src/lib/learning/lesson-05";
import { LESSON_06_SLUG } from "../src/lib/learning/lesson-06";
import { LESSON_07_SLUG } from "../src/lib/learning/lesson-07";
import { LESSON_08_SLUG } from "../src/lib/learning/lesson-08";
import { LESSON_09_SLUG } from "../src/lib/learning/lesson-09";
import { LESSON_10_SLUG } from "../src/lib/learning/lesson-10";
import { LESSON_11_SLUG, LESSON_12_SLUG } from "../src/lib/learning/lesson-11";
import { SITE_LESSON_01_SLUG } from "../src/lib/learning/site-ajuda-a-vender";
import { SITE_LESSON_02_SLUG } from "../src/lib/learning/site-landing-page-ou-whatsapp";
import { SITE_LESSON_03_SLUG } from "../src/lib/learning/site-pagina-pronta-para-converter";
import { SITE_LESSON_04_SLUG } from "../src/lib/learning/site-oferta-publico-acao-principal";
import { SITE_LESSON_05_SLUG } from "../src/lib/learning/site-jornada-do-visitante";
import { SITE_LESSON_06_SLUG } from "../src/lib/learning/site-organize-as-secoes-da-pagina";
import { SITE_LESSON_07_SLUG } from "../src/lib/learning/site-mensagem-que-deixa-a-oferta-clara";
import { SITE_LESSON_08_SLUG } from "../src/lib/learning/site-hierarquia-visual-e-atencao";
import { SITE_LESSON_09_SLUG } from "../src/lib/learning/site-construa-confianca";
import { SITE_LESSON_10_SLUG } from "../src/lib/learning/site-pagina-mobile-e-experiencia";
import { SITE_LESSON_11_SLUG } from "../src/lib/learning/site-configure-o-que-precisa-ser-medido";
import { SITE_LESSON_12_SLUG } from "../src/lib/learning/site-revisao-antes-do-trafego";
import { SITES_COURSE_SLUG } from "../src/lib/learning/sites-course";

const FIRST_PAID = [LESSON_04_SLUG, LESSON_05_SLUG, LESSON_06_SLUG, LESSON_07_SLUG, LESSON_08_SLUG, LESSON_09_SLUG, LESSON_10_SLUG, LESSON_11_SLUG, LESSON_12_SLUG];
const SITES_PAID = [SITE_LESSON_04_SLUG, SITE_LESSON_05_SLUG, SITE_LESSON_06_SLUG, SITE_LESSON_07_SLUG, SITE_LESSON_08_SLUG, SITE_LESSON_09_SLUG, SITE_LESSON_10_SLUG, SITE_LESSON_11_SLUG, SITE_LESSON_12_SLUG];

function priced(kind: "lesson" | "module" | "course", slug: string) {
  return SALE_ALLOWLIST.find((item) => item.kind === kind && item.slug === slug);
}

function readyPaid(slug: string, priceCents: number, overrides: Partial<LessonShape> = {}): LessonShape {
  return {
    slug,
    title: slug,
    status: "PUBLISHED",
    accessType: "PAID",
    priceCents,
    commerceStatus: "NOT_FOR_SALE",
    publicPreview: "Amostra pública da aula.",
    contentReady: true,
    contentIssues: [],
    hasPublicPreviewBlocks: true,
    ...overrides,
  };
}

function available(slug: string) {
  return { slug, title: slug, commerceStatus: "AVAILABLE" as const, ready: true, status: "PUBLISHED" as const, accessType: "PAID" as const };
}

test("allowlist do curso 2 cobre preços aprovados e deixa o gratuito de fora", () => {
  assert.equal(priced("course", FIRST_COURSE_SLUG)?.priceCents, 24990);
  assert.equal(priced("course", SITES_COURSE_SLUG)?.priceCents, 24990);
  assert.deepEqual(SITES_PAID.map((slug) => priced("lesson", slug)?.priceCents), [3490, 3490, 3990, 3990, 3490, 3490, 3490, 3990, 3990]);
  assert.deepEqual(
    ["planeje-antes-de-desenhar", "estruture-e-comunique", "atencao-e-confianca", "publique-mea-e-melhore"].map((slug) => priced("module", slug)?.priceCents),
    [6290, 7190, 6290, 10390],
  );
  assert.equal(priced("lesson", SITE_LESSON_01_SLUG), undefined);
  assert.equal(priced("lesson", SITE_LESSON_02_SLUG), undefined);
  assert.equal(priced("lesson", SITE_LESSON_03_SLUG), undefined);
  assert.equal(priced("module", "antes-de-construir"), undefined);
  assert.equal(priced("module", "planeje-antes-de-anunciar")?.priceCents, 5790);
});

test("curso e módulo em rascunho, aula sem prontidão e dependências cruzadas ficam bloqueados", () => {
  const lesson = priced("lesson", SITE_LESSON_04_SLUG);
  assert.ok(lesson);
  assert.equal(planLessonEnable(readyPaid(lesson.slug, lesson.priceCents)).allowed, true);
  assert.equal(planLessonEnable(readyPaid(lesson.slug, lesson.priceCents, { contentReady: false, contentIssues: ["Falta a conclusão."] })).allowed, false);
  assert.equal(planLessonEnable(readyPaid(SITE_LESSON_01_SLUG, 0, { accessType: "FREE", priceCents: null })).allowed, false);

  const draftModule = planModuleEnable({
    slug: "planeje-antes-de-desenhar",
    title: "Planeje",
    priceCents: 6290,
    commerceStatus: "NOT_FOR_SALE",
    status: "DRAFT",
    lessons: [available(SITE_LESSON_04_SLUG), available(SITE_LESSON_05_SLUG)],
  });
  assert.equal(draftModule.allowed, false);
  assert.match(draftModule.reason ?? "", /publicado/);

  const moduleEarly = planModuleEnable({
    slug: "planeje-antes-de-desenhar",
    title: "Planeje",
    priceCents: 6290,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    lessons: [available(SITE_LESSON_04_SLUG), { ...available(SITE_LESSON_05_SLUG), commerceStatus: "NOT_FOR_SALE" }],
  });
  assert.equal(moduleEarly.allowed, false);

  const draftCourse = planCourseEnable({
    slug: SITES_COURSE_SLUG,
    title: "Sites",
    priceCents: 24990,
    commerceStatus: "NOT_FOR_SALE",
    status: "DRAFT",
    paidLessons: SITES_PAID.map(available),
  });
  assert.equal(draftCourse.allowed, false);

  const sitesBeforeLessons = planCourseEnable({
    slug: SITES_COURSE_SLUG,
    title: "Sites",
    priceCents: 24990,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    paidLessons: SITES_PAID.map((slug, index) => (index === 0 ? { ...available(slug), commerceStatus: "NOT_FOR_SALE" as const } : available(slug))),
  });
  assert.equal(sitesBeforeLessons.allowed, false);

  const sitesReady = planCourseEnable({
    slug: SITES_COURSE_SLUG,
    title: "Sites",
    priceCents: 24990,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    paidLessons: SITES_PAID.map(available),
  });
  assert.equal(sitesReady.allowed, true);
  assert.equal(sitesReady.priceCents, 24990);

  const firstStillReady = planCourseEnable({
    slug: FIRST_COURSE_SLUG,
    title: "Tráfego",
    priceCents: 24990,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    paidLessons: FIRST_PAID.map(available),
  });
  assert.equal(firstStillReady.allowed, true);

  const firstDoesNotNeedSites = planCourseEnable({
    slug: FIRST_COURSE_SLUG,
    title: "Tráfego",
    priceCents: 24990,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    paidLessons: [...FIRST_PAID.map(available), ...SITES_PAID.map((slug) => ({ ...available(slug), commerceStatus: "NOT_FOR_SALE" as const }))],
  });
  assert.equal(firstDoesNotNeedSites.allowed, true);

  const sitesDoesNotNeedFirst = planCourseEnable({
    slug: SITES_COURSE_SLUG,
    title: "Sites",
    priceCents: 24990,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    paidLessons: [...SITES_PAID.map(available), ...FIRST_PAID.map((slug) => ({ ...available(slug), commerceStatus: "NOT_FOR_SALE" as const }))],
  });
  assert.equal(sitesDoesNotNeedFirst.allowed, true);
});
