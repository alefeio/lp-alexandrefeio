import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { config as loadEnv } from "dotenv";
import { isProductForSale } from "../src/lib/commerce/config";
import { canIndexLesson, canReadLessonBody } from "../src/lib/learning/access";
import { acquisitionAnalyticsPayload } from "../src/lib/learning/acquisition-analytics";
import { getPublicLesson, loadLessonBlocks, sitemapLearningEntries } from "../src/lib/learning/catalog";
import { getPrisma } from "../src/lib/db/prisma";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { lesson04Blocks } from "../src/lib/learning/lesson-04";
import { lesson05Blocks } from "../src/lib/learning/lesson-05";
import { lesson06Blocks } from "../src/lib/learning/lesson-06";
import {
  LESSON_04_PUBLIC_PREVIEW_KEYS,
  LESSON_05_PUBLIC_PREVIEW_KEYS,
  LESSON_06_PUBLIC_PREVIEW_KEYS,
  PUBLIC_PREVIEW_TYPES,
  publicPreviewFlag,
} from "../src/lib/learning/public-preview";
import { siteConfig } from "../src/data/site-config";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";
import { breadcrumbList, courseJsonLd, lessonJsonLd } from "../src/lib/seo/learning-jsonld";

loadEnv({ path: ".env.local" });

const allowed = new Set<string>(PUBLIC_PREVIEW_TYPES);
const later = [
  "palavras-chave-com-intencao",
  "anuncios-alinhados-a-conversao",
  "objetivo-publico-estrutura",
  "campanhas-leads-whatsapp",
  "leia-os-numeros",
  "o-que-mudar",
];

function assertPreviewKeys(blocks: { blockKey: string; data: { type: string } }[], keys: readonly string[], forbidden: string[]) {
  for (const key of keys) {
    const block = blocks.find((item) => item.blockKey === key);
    assert.ok(block, key);
    assert.equal(allowed.has(block.data.type), true, key);
  }
  for (const key of forbidden) {
    assert.equal(keys.includes(key), false);
  }
}

test("amostra editorial das aulas 4 a 6", () => {
  assertPreviewKeys(lesson04Blocks, LESSON_04_PUBLIC_PREVIEW_KEYS, ["checkpoint-objetivo-negocio"]);
  assertPreviewKeys(lesson05Blocks, LESSON_05_PUBLIC_PREVIEW_KEYS, ["checkpoint-destino-coerente"]);
  assertPreviewKeys(lesson06Blocks, LESSON_06_PUBLIC_PREVIEW_KEYS, ["checkpoint-hierarquia-pesquisa", "blueprint-campanha-pesquisa"]);
  assert.equal(publicPreviewFlag("TOOL", true), false);
  assert.equal(publicPreviewFlag("CHECKPOINT", true), false);
  assert.equal(publicPreviewFlag("TEXT", true), true);
  assert.equal(publicPreviewFlag("TEXT", false), false);
});

test("indexação e canonical", () => {
  const published = { status: "PUBLISHED" as const, accessType: "FREE" as const, publicPreview: null };
  assert.equal(canIndexLesson({ ...published, status: "DRAFT" }, true, true), false);
  assert.equal(canIndexLesson(published, true), true);
  assert.equal(canIndexLesson({ ...published, accessType: "PAID" }, true, false), false);
  assert.equal(canIndexLesson({ ...published, accessType: "PAID" }, true, true), true);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }, { entitled: true }), true);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }), false);
  assert.equal(siteConfig.url, "https://alexandrefeio.com.br");
  assert.equal(siteConfig.url.includes("www."), false);

  const sitemap = buildPublicSitemap(siteConfig.url, {
    courses: [{ slug: "trafego-pago-na-pratica", updatedAt: new Date("2026-10-14") }],
    lessons: [
      { slug: "aula-paga", updatedAt: new Date("2026-10-14"), indexable: true },
      { slug: "rascunho", updatedAt: new Date("2026-10-14"), indexable: false },
    ],
  });
  assert.equal(sitemap.some((entry) => entry.url.endsWith("/aulas/aula-paga")), true);
  assert.equal(sitemap.some((entry) => entry.url.includes("rascunho")), false);
  assert.equal(sitemap.some((entry) => entry.url.includes("www.")), false);
  assert.equal(sitemap.some((entry) => entry.url.includes("?")), false);
});

test("dados estruturados e paywall comercial", () => {
  const free = lessonJsonLd({
    title: "Como o tráfego pago funciona",
    description: "Mapa inicial.",
    path: "/aulas/como-funciona-o-trafego-pago",
    publishedAt: new Date("2026-10-13T00:00:00.000Z"),
    updatedAt: new Date("2026-10-14T00:00:00.000Z"),
    free: true,
    paywall: false,
  });
  assert.deepEqual(free["@type"], ["Article", "LearningResource"]);
  assert.equal(free.isAccessibleForFree, true);
  assert.equal("hasPart" in free, false);
  assert.equal((free.author as { name: string }).name, "Alexandre Feio");

  const paid = lessonJsonLd({
    title: "Objetivo, oferta e orçamento",
    description: "Brief.",
    path: "/aulas/objetivo-oferta-orcamento",
    publishedAt: null,
    updatedAt: new Date("2026-10-14T00:00:00.000Z"),
    free: false,
    paywall: true,
  });
  assert.equal(paid.isAccessibleForFree, false);
  assert.equal((paid.hasPart as { cssSelector: string }).cssSelector, ".lesson-paywall");

  const crumbs = breadcrumbList([
    { name: "Home", path: "/" },
    { name: "Curso", path: "/cursos/trafego-pago-na-pratica" },
    { name: "Aula", path: "/aulas/objetivo-oferta-orcamento" },
  ]);
  assert.equal(crumbs["@type"], "BreadcrumbList");
  assert.equal((crumbs.itemListElement as { name: string }[])[0]?.name, "Home");
  assert.equal((crumbs.itemListElement as { item: string }[])[2]?.item, "https://alexandrefeio.com.br/aulas/objetivo-oferta-orcamento");

  const course = courseJsonLd({ title: "Curso", description: "Trilha", path: "/cursos/trafego-pago-na-pratica" });
  assert.equal(course["@type"], "Course");
  assert.equal("offers" in course, false);
  assert.equal("aggregateRating" in course, false);

  assert.equal(isProductForSale("NOT_FOR_SALE", 2990, true), false);
  assert.equal(isProductForSale("AVAILABLE", 2990, false), false);
  assert.equal(isProductForSale("AVAILABLE", 2990, true), true);
});

test("analytics de aquisição não carrega dado de negócio", () => {
  const payload = acquisitionAnalyticsPayload({
    course_slug: "trafego-pago-na-pratica",
    lesson_slug: "campanha-de-pesquisa",
    cta_name: "comecar_aula",
    projectId: "proj",
    email: "a@b.com",
    budget: "100",
    diagnostic: "x",
  } as never);
  assert.deepEqual(payload, {
    course_slug: "trafego-pago-na-pratica",
    lesson_slug: "campanha-de-pesquisa",
    cta_name: "comecar_aula",
  });
});

test("preço e aulas futuras não estão hardcoded na página de vendas", () => {
  const sales = readFileSync(new URL("../src/components/course/CourseSales.tsx", import.meta.url), "utf8");
  assert.equal(sales.includes("29,90"), false);
  assert.equal(sales.includes("249,90"), false);
  assert.match(sales, /formatPriceCents/);
  assert.match(sales, /Disponível em breve/);
  assert.match(sales, /isProductForSale/);
  const home = readFileSync(new URL("../src/components/home/CourseHome.tsx", import.meta.url), "utf8");
  assert.match(home, /Começar gratuitamente/);
  assert.match(home, /Prefiro contratar a gestão/);
  const page = readFileSync(new URL("../src/app/(learn)/aulas/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /loadLessonBlocks\(page\.lesson\.id, "full"\)/);
  assert.match(page, /lesson-paywall|LessonPaywall/);
  const preview = readFileSync(new URL("../src/app/(admin)/admin/aulas/[id]/preview/page.tsx", import.meta.url), "utf8");
  assert.match(preview, /index: false, follow: false/);
  assert.equal(preview.includes("ViewEvent"), false);
  assert.match(preview, /preview/);
  for (const slug of later) {
    const seedLesson = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons).find((lesson) => lesson.slug === slug);
    assert.equal(seedLesson?.blocks.length, 0, slug);
  }
});

test("consulta pública da aula paga não devolve bloco privado", async () => {
  const prisma = getPrisma();
  const slugs = ["objetivo-oferta-orcamento", "destino-e-mensuracao", "campanha-de-pesquisa"] as const;
  const expected = [LESSON_04_PUBLIC_PREVIEW_KEYS, LESSON_05_PUBLIC_PREVIEW_KEYS, LESSON_06_PUBLIC_PREVIEW_KEYS];
  for (const [index, slug] of slugs.entries()) {
    const page = await getPublicLesson(slug);
    assert.ok(page);
    assert.equal(page.hasPublicPreview, true);
    assert.equal(canIndexLesson(page.lesson, page.hasBody, page.hasPublicPreview), true);
    assert.deepEqual(
      page.blocks.map((block) => block.blockKey),
      [...expected[index]!],
    );
    assert.equal(page.blocks.some((block) => block.data.type === "TOOL" || block.data.type === "CHECKPOINT"), false);
    const full = await loadLessonBlocks(page.lesson.id, "full");
    assert.equal(full.some((block) => block.data.type === "TOOL"), true);
    assert.equal(full.length > page.blocks.length, true);
  }

  const free = await getPublicLesson("como-funciona-o-trafego-pago");
  assert.ok(free);
  assert.equal(canIndexLesson(free.lesson, free.hasBody, free.hasPublicPreview), true);
  assert.equal(free.blocks.length > 5, true);
  assert.equal(free.lesson.accessType, "FREE");

  for (const slug of later) {
    const page = await getPublicLesson(slug);
    assert.ok(page);
    assert.equal(page.blocks.length, 0);
    assert.equal(page.hasPublicPreview, false);
    assert.equal(canIndexLesson(page.lesson, page.hasBody, page.hasPublicPreview), false);
    assert.equal(await prisma.lessonBlock.count({ where: { lesson: { slug }, retiredAt: null } }), 0);
  }

  const entries = await sitemapLearningEntries();
  const urls = new Set(entries.lessons.filter((lesson) => lesson.indexable).map((lesson) => lesson.slug));
  assert.equal(urls.has("como-funciona-o-trafego-pago"), true);
  assert.equal(urls.has("objetivo-oferta-orcamento"), true);
  assert.equal(urls.has("destino-e-mensuracao"), true);
  assert.equal(urls.has("campanha-de-pesquisa"), true);
  for (const slug of later) assert.equal(urls.has(slug), false);

  const tool = await prisma.lessonBlock.findFirst({
    where: { lesson: { slug: "objetivo-oferta-orcamento" }, type: "TOOL", retiredAt: null },
  });
  assert.ok(tool);
  await prisma.lessonBlock.update({ where: { id: tool.id }, data: { isPublicPreview: true } });
  try {
    const leaked = await loadLessonBlocks(tool.lessonId, "preview");
    assert.equal(leaked.some((block) => block.data.type === "TOOL"), false);
  } finally {
    await prisma.lessonBlock.update({ where: { id: tool.id }, data: { isPublicPreview: false } });
  }
});
