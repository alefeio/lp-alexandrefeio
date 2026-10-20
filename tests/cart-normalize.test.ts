import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mergeCartLine, normalizeCartSelection } from "../src/lib/commerce/cart-normalize";
import { quoteCart, type SaleCourse, type SaleLesson, type SaleModule } from "../src/lib/commerce/quote";

function lesson(id: string, moduleId: string, price = 2990): SaleLesson {
  return {
    id,
    slug: id,
    title: `Aula ${id}`,
    accessType: "PAID",
    status: "PUBLISHED",
    commerceStatus: "AVAILABLE",
    priceCents: price,
    moduleId,
    courseId: "course",
  };
}

const lessons = [
  lesson("l4", "planeje", 2990),
  lesson("l5", "planeje", 2990),
  lesson("l6", "google", 3990),
  lesson("l7", "google", 3990),
  lesson("l8", "google", 3490),
  lesson("l9", "meta", 3990),
];

const modules: SaleModule[] = [
  {
    id: "planeje",
    slug: "planeje",
    title: "Planeje",
    status: "PUBLISHED",
    commerceStatus: "AVAILABLE",
    bundlePriceCents: 5790,
    courseId: "course",
    paidLessonIds: ["l4", "l5"],
    lessonCount: 2,
  },
  {
    id: "google",
    slug: "google",
    title: "Google Ads na Prática",
    status: "PUBLISHED",
    commerceStatus: "AVAILABLE",
    bundlePriceCents: 10390,
    courseId: "course",
    paidLessonIds: ["l6", "l7", "l8"],
    lessonCount: 3,
  },
  {
    id: "meta",
    slug: "meta",
    title: "Meta Ads",
    status: "PUBLISHED",
    commerceStatus: "AVAILABLE",
    bundlePriceCents: 7190,
    courseId: "course",
    paidLessonIds: ["l9"],
    lessonCount: 1,
  },
];

const course: SaleCourse = {
  id: "course",
  slug: "trafego",
  title: "Tráfego Pago na Prática para Pequenos Negócios",
  status: "PUBLISHED",
  commerceStatus: "AVAILABLE",
  bundlePriceCents: 24990,
  paidLessonIds: ["l4", "l5", "l6", "l7", "l8", "l9"],
  lessonCount: 12,
};

const catalog = { lessons, modules, courses: [course] };

test("aula + curso vira só curso", () => {
  assert.deepEqual(
    normalizeCartSelection(
      [
        { type: "LESSON", id: "l4" },
        { type: "COURSE", id: "course" },
      ],
      catalog,
    ),
    [{ type: "COURSE", id: "course" }],
  );
});

test("módulo + curso vira só curso", () => {
  assert.deepEqual(
    normalizeCartSelection(
      [
        { type: "MODULE", id: "google" },
        { type: "COURSE", id: "course" },
      ],
      catalog,
    ),
    [{ type: "COURSE", id: "course" }],
  );
});

test("aulas contidas + módulo viram só módulo", () => {
  assert.deepEqual(
    normalizeCartSelection(
      [
        { type: "LESSON", id: "l6" },
        { type: "LESSON", id: "l7" },
        { type: "MODULE", id: "google" },
      ],
      catalog,
    ),
    [{ type: "MODULE", id: "google" }],
  );
});

test("aula fora do módulo + módulo coexistentes", () => {
  assert.deepEqual(
    normalizeCartSelection(
      [
        { type: "LESSON", id: "l5" },
        { type: "MODULE", id: "google" },
      ],
      catalog,
    ),
    [
      { type: "LESSON", id: "l5" },
      { type: "MODULE", id: "google" },
    ],
  );
});

test("duas aulas independentes permanecem", () => {
  assert.deepEqual(
    normalizeCartSelection(
      [
        { type: "LESSON", id: "l4" },
        { type: "LESSON", id: "l9" },
      ],
      catalog,
    ),
    [
      { type: "LESSON", id: "l4" },
      { type: "LESSON", id: "l9" },
    ],
  );
});

test("produto duplicado vira um só", () => {
  assert.deepEqual(
    normalizeCartSelection(
      [
        { type: "LESSON", id: "l4" },
        { type: "LESSON", id: "l4" },
      ],
      catalog,
    ),
    [{ type: "LESSON", id: "l4" }],
  );
});

test("merge no cliente: curso substitui tudo", () => {
  assert.deepEqual(
    mergeCartLine(
      [
        { type: "LESSON", id: "l4" },
        { type: "MODULE", id: "google" },
      ],
      { type: "COURSE", id: "course", lessonIds: course.paidLessonIds },
    ),
    [{ type: "COURSE", id: "course" }],
  );
});

test("quote de curso com crédito da Aula 4", () => {
  const quote = quoteCart({
    lines: [
      { type: "LESSON", id: "l4" },
      { type: "COURSE", id: "course" },
    ],
    ...catalog,
    sources: [{ orderItemId: "paid-l4", finalPriceCents: 2990, lessonIds: ["l4"] }],
    ownedLessonIds: ["l4"],
  });
  assert.equal(quote.ok, true);
  if (!quote.ok) return;
  assert.equal(quote.items.length, 1);
  assert.equal(quote.subtotalCents, 24990);
  assert.equal(quote.creditCents, 2990);
  assert.equal(quote.totalCents, 22000);
  assert.equal(quote.itemType, "COURSE");
});

test("quote de curso sem crédito", () => {
  const quote = quoteCart({
    lines: [{ type: "COURSE", id: "course" }],
    ...catalog,
    sources: [],
    ownedLessonIds: [],
  });
  assert.equal(quote.ok, true);
  if (!quote.ok) return;
  assert.equal(quote.creditCents, 0);
  assert.equal(quote.totalCents, 24990);
});

test("módulo Google com Aula 6 já paga", () => {
  const quote = quoteCart({
    lines: [
      { type: "LESSON", id: "l6" },
      { type: "MODULE", id: "google" },
    ],
    ...catalog,
    sources: [{ orderItemId: "paid-l6", finalPriceCents: 3990, lessonIds: ["l6"] }],
    ownedLessonIds: ["l6"],
  });
  assert.equal(quote.ok, true);
  if (!quote.ok) return;
  assert.equal(quote.items.length, 1);
  assert.equal(quote.subtotalCents, 10390);
  assert.equal(quote.creditCents, 3990);
  assert.equal(quote.totalCents, 6400);
});

test("UI do carrinho remove copy técnica e usa nomes reais", () => {
  const page = readFileSync(new URL("../src/app/(app)/app/carrinho/page.tsx", import.meta.url), "utf8");
  const screen = readFileSync(new URL("../src/components/commerce/CartScreen.tsx", import.meta.url), "utf8");
  assert.match(page, /Finalizar compra/);
  assert.equal(page.includes("calculados de novo no servidor"), false);
  assert.equal(screen.includes("Calculando o preço."), false);
  assert.equal(screen.includes("Este checkout aceita"), false);
  assert.match(screen, /Crédito de conteúdos já adquiridos/);
  assert.match(screen, /Calculando seu valor/);
  assert.match(screen, /Tentar novamente/);
  assert.match(screen, /Seu carrinho está vazio/);
  assert.match(screen, /Você já tem este conteúdo/);
  assert.match(screen, /Pagar \$\{formatPriceCents/);
});
