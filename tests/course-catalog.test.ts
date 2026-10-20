import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { navigation, footerNavigation } from "../src/data/navigation";
import { buildCourseCatalogCard } from "../src/lib/learning/course-catalog";
import { collectionPageJsonLd } from "../src/lib/seo/learning-jsonld";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";

function publishedCourse(patch: {
  modules?: Array<{
    id: string;
    lessons: Array<{ id: string; accessType: "FREE" | "PAID" }>;
  }>;
} = {}) {
  return {
    id: "course-1",
    slug: "trafego-pago-na-pratica",
    title: "Tráfego Pago na Prática para Pequenos Negócios",
    subtitle: "Uma trilha em texto para decidir, anunciar e ler o que aconteceu.",
    description: "Descrição longa do curso.",
    status: "PUBLISHED" as const,
    commerceStatus: "AVAILABLE" as const,
    bundlePriceCents: 24990,
    sortOrder: 0,
    publishedAt: new Date(),
    updatedAt: new Date(),
    createdAt: new Date(),
    modules: patch.modules ?? [
      {
        id: "m0",
        lessons: [
          { id: "l1", accessType: "FREE" as const },
          { id: "l2", accessType: "FREE" as const },
          { id: "l3", accessType: "FREE" as const },
        ],
      },
      {
        id: "m1",
        lessons: [
          { id: "l4", accessType: "PAID" as const },
          { id: "l5", accessType: "PAID" as const },
        ],
      },
      {
        id: "m2",
        lessons: [
          { id: "l6", accessType: "PAID" as const },
          { id: "l7", accessType: "PAID" as const },
          { id: "l8", accessType: "PAID" as const },
        ],
      },
      {
        id: "m3",
        lessons: [
          { id: "l9", accessType: "PAID" as const },
          { id: "l10", accessType: "PAID" as const },
        ],
      },
      {
        id: "m4",
        lessons: [
          { id: "l11", accessType: "PAID" as const },
          { id: "l12", accessType: "PAID" as const },
        ],
      },
    ],
  };
}

test("catálogo data-driven mostra 12 aulas e 5 módulos", () => {
  const card = buildCourseCatalogCard(publishedCourse() as never);
  assert.equal(card.lessonCount, 12);
  assert.equal(card.moduleCount, 5);
  assert.equal(card.href, "/cursos/trafego-pago-na-pratica");
  assert.equal(card.ctaLabel, "Conhecer o curso");
  assert.equal(card.freeLessonCount, 3);
  assert.equal(card.microcopy, "Comece gratuitamente");
  assert.equal(card.progress, null);
});

test("catálogo autenticado com progresso fica discreto", () => {
  const card = buildCourseCatalogCard(publishedCourse() as never, {
    ownedLessonIds: ["l4"],
    completedLessonIds: ["l1", "l4"],
  });
  assert.equal(card.progress?.label, "Em andamento");
  assert.equal(card.progress?.detail, "2 de 4 aulas");
  assert.equal(card.ctaLabel, "Continuar curso");
  assert.equal(card.microcopy, null);
});

test("navegação pública e footer usam Cursos → /cursos", () => {
  const publicItem = navigation.find((item) => item.label === "Cursos");
  assert.equal(publicItem?.href, "/cursos");
  assert.equal(navigation.some((item) => item.label === "Curso"), false);
  const footerItem = footerNavigation.find((item) => item.label === "Cursos");
  assert.equal(footerItem?.href, "/cursos");
  assert.equal(footerNavigation.some((item) => item.label === "Curso"), false);
});

test("página de vendas prioriza curso completo antes dos módulos", () => {
  const sales = readFileSync(new URL("../src/components/course/CourseSales.tsx", import.meta.url), "utf8");
  const freeIdx = sales.indexOf('id="aulas-gratuitas"');
  const fullIdx = sales.indexOf('id="curso-completo"');
  const programIdx = sales.indexOf('id="programa"');
  assert.ok(freeIdx > 0);
  assert.ok(fullIdx > freeIdx);
  assert.ok(programIdx > fullIdx);
  assert.match(sales, /individualTotalCents/);
  assert.match(sales, /savingsCents/);
  assert.match(sales, /formatPriceCents/);
  assert.equal(sales.includes("249,90"), false);
  assert.equal(sales.includes("334,10"), false);
  assert.equal(sales.includes("84,20"), false);
  assert.match(sales, /hidePrices/);
  assert.match(sales, /courseSalesCopy/);
});

test("Home multi-curso usa catálogo data-driven", () => {
  const home = readFileSync(new URL("../src/components/home/CourseHome.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/app/(public)/page.tsx", import.meta.url), "utf8");
  assert.match(page, /loadCourseCatalog/);
  assert.match(home, /md:grid-cols-2/);
  assert.match(home, /Conhecer o curso/);
  assert.match(home, /freeLessonCount/);
});

test("CollectionPage e sitemap incluem /cursos", () => {
  const json = collectionPageJsonLd({
    name: "Cursos",
    description: "Catálogo",
    path: "/cursos",
    courses: [{ name: "Tráfego", path: "/cursos/trafego-pago-na-pratica" }],
  });
  assert.equal(json["@type"], "CollectionPage");
  assert.equal("aggregateRating" in json, false);
  const sitemap = buildPublicSitemap("https://alexandrefeio.com.br", {
    courses: [{ slug: "trafego-pago-na-pratica", updatedAt: new Date("2026-10-01") }],
    lessons: [],
  });
  assert.ok(sitemap.some((entry) => entry.url === "https://alexandrefeio.com.br/cursos"));
});

test("página /cursos é pública e data-driven", () => {
  const page = readFileSync(new URL("../src/app/(public)/cursos/page.tsx", import.meta.url), "utf8");
  assert.match(page, /loadCourseCatalog/);
  assert.match(page, /CourseCatalog/);
  assert.match(page, /canonical: "\/cursos"/);
  assert.match(page, /index: true, follow: true/);
  assert.equal(page.includes("em breve"), false);
});
