import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SALE_ALLOWLIST,
  hasCommercialPrice,
  planCourseEnable,
  planLessonEnable,
  planModuleEnable,
  type LessonShape,
} from "../src/lib/commerce/product-activation";
import { FIRST_COURSE_SLUG } from "../src/lib/learning/first-course";
import { LESSON_04_SLUG } from "../src/lib/learning/lesson-04";
import { LESSON_05_SLUG } from "../src/lib/learning/lesson-05";
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

const SITES_PAID = [
  SITE_LESSON_04_SLUG,
  SITE_LESSON_05_SLUG,
  SITE_LESSON_06_SLUG,
  SITE_LESSON_07_SLUG,
  SITE_LESSON_08_SLUG,
  SITE_LESSON_09_SLUG,
  SITE_LESSON_10_SLUG,
  SITE_LESSON_11_SLUG,
  SITE_LESSON_12_SLUG,
];

function readyPaid(slug: string, priceCents: number | null, overrides: Partial<LessonShape> = {}): LessonShape {
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
  return {
    slug,
    title: slug,
    commerceStatus: "AVAILABLE" as const,
    ready: true,
    status: "PUBLISHED" as const,
    accessType: "PAID" as const,
  };
}

test("COM-1: allowlist não carrega centavos hardcoded", () => {
  assert.ok(SALE_ALLOWLIST.some((row) => row.kind === "course" && row.slug === FIRST_COURSE_SLUG));
  assert.ok(SALE_ALLOWLIST.some((row) => row.kind === "course" && row.slug === SITES_COURSE_SLUG));
  assert.ok(SALE_ALLOWLIST.some((row) => row.kind === "lesson" && row.slug === LESSON_04_SLUG));
  for (const row of SALE_ALLOWLIST) {
    assert.equal("priceCents" in row, false);
  }
});

test("COM-1: preço persistido diferente do seed antigo ainda pode ser ativado", () => {
  const lesson = planLessonEnable(readyPaid(LESSON_04_SLUG, 1990));
  assert.equal(lesson.allowed, true);
  assert.equal(lesson.priceCents, 1990);

  const modulePlan = planModuleEnable({
    slug: "planeje-antes-de-anunciar",
    title: "Planeje",
    priceCents: 4500,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    lessons: [available(LESSON_04_SLUG), available(LESSON_05_SLUG)],
  });
  assert.equal(modulePlan.allowed, true);

  const coursePlan = planCourseEnable({
    slug: SITES_COURSE_SLUG,
    title: "Sites",
    priceCents: 19900,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    paidLessons: SITES_PAID.map(available),
  });
  assert.equal(coursePlan.allowed, true);
  assert.equal(coursePlan.priceCents, 19900);
});

test("COM-1: preço inválido ou slug fora da allowlist continua bloqueado", () => {
  assert.equal(hasCommercialPrice(null), false);
  assert.equal(hasCommercialPrice(0), false);
  assert.equal(hasCommercialPrice(-10), false);
  assert.equal(hasCommercialPrice(3490), true);

  assert.equal(planLessonEnable(readyPaid(LESSON_04_SLUG, null)).allowed, false);
  assert.equal(planLessonEnable(readyPaid(LESSON_04_SLUG, 0)).allowed, false);
  assert.equal(planLessonEnable(readyPaid("aula-fora-da-allowlist", 3490)).allowed, false);
  assert.match(planLessonEnable(readyPaid(LESSON_04_SLUG, null)).reason ?? "", /preço válido/i);
});

test("COM-1: deploy e seeds não regram preço em update", () => {
  const deploy = readFileSync(new URL("../src/lib/learning/catalog-deploy.ts", import.meta.url), "utf8");
  const updateBlocks = [...deploy.matchAll(/update:\s*\{([\s\S]*?)\n\s*\},/g)].map((match) => match[1] ?? "");
  assert.ok(updateBlocks.length >= 4);
  for (const block of updateBlocks) {
    assert.equal(/\bpriceCents\s*:/.test(block), false, "update do deploy não deve escrever priceCents");
    assert.equal(/\bbundlePriceCents\s*:/.test(block), false, "update do deploy não deve escrever bundlePriceCents");
  }
  assert.match(deploy, /create:[\s\S]*bundlePriceCents:/);
  assert.match(deploy, /create:[\s\S]*priceCents:/);

  const seed04 = readFileSync(new URL("../src/lib/learning/seed-lesson-04.ts", import.meta.url), "utf8");
  const update = seed04.match(/await prisma\.lesson\.update\(\{([\s\S]*?)\n\s*\}\);/);
  assert.ok(update);
  assert.equal(/\bpriceCents\s*:/.test(update![1] ?? ""), false);
});

test("COM-1: cotação e pedidos leem catálogo; Admin permanece caminho de escrita", () => {
  const quote = readFileSync(new URL("../src/lib/commerce/quote.ts", import.meta.url), "utf8");
  assert.match(quote, /priceCents/);
  assert.match(quote, /listPriceCents/);
  const orders = readFileSync(new URL("../src/lib/commerce/orders.ts", import.meta.url), "utf8");
  assert.match(orders, /quoteCart|quoteForUser/);
  const pricing = readFileSync(new URL("../src/lib/admin/pricing.ts", import.meta.url), "utf8");
  assert.match(pricing, /priceCents:\s*parsed\.cents/);
  assert.match(pricing, /bundlePriceCents:\s*parsed\.cents/);
  assert.match(pricing, /updateMany/);
  const editorial = readFileSync(new URL("../src/lib/editorial/service.ts", import.meta.url), "utf8");
  assert.match(editorial, /\/admin\/precos/);
  assert.equal(/bundlePriceCents:\s*price\b/.test(editorial), false);
});
