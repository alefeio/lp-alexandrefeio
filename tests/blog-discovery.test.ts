import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BlogDiscoveryAside } from "../src/components/blog/BlogDiscoveryAside";
import { BlogPostCard } from "../src/components/blog/BlogPostCard";
import { CourseHome } from "../src/components/home/CourseHome";
import { HomeRecentArticles } from "../src/components/home/HomeRecentArticles";
import type { PublishedBlogCard } from "../src/lib/blog/service";
import { TRAFFIC_COURSE_SLUG } from "../src/lib/learning/course-experience";
import type { CourseCatalogCard } from "../src/lib/learning/course-catalog";

const samplePost: PublishedBlogCard = {
  slug: "quando-investir-em-trafego-pago",
  title: "Quando investir em tráfego pago",
  excerpt: "Um guia prático para entender quando anunciar e o que preparar antes da campanha.",
  categorySlug: "trafego-pago",
  coverImageUrl: "https://apimg.com.br/covers/example.webp",
  coverImageAlt: "Ilustração de campanha",
  publishedAt: new Date("2026-11-01T12:00:00.000Z"),
};

function courseCard(): CourseCatalogCard {
  return {
    id: "c1",
    slug: TRAFFIC_COURSE_SLUG,
    title: "Tráfego Pago",
    summary: "Resumo",
    lessonCount: 12,
    moduleCount: 5,
    freeLessonCount: 3,
    freeLessons: [{ slug: "como-funciona-o-trafego-pago", title: "Como funciona", number: 1 }],
    href: `/cursos/${TRAFFIC_COURSE_SLUG}`,
    ctaLabel: "Conhecer o curso",
    microcopy: null,
    progress: null,
  };
}

test("card do blog mostra capa, categoria, título, resumo e link", () => {
  const html = renderToStaticMarkup(createElement(BlogPostCard, { post: samplePost }));
  assert.match(html, /apimg\.com\.br\/covers\/example\.webp/);
  assert.match(html, /Tráfego pago para pequenos negócios/);
  assert.match(html, /Quando investir em tráfego pago/);
  assert.match(html, /Um guia prático para entender quando anunciar/);
  assert.match(html, /href="\/blog\/quando-investir-em-trafego-pago"/);
  assert.match(html, /Ler artigo/);
  assert.match(html, /alt="Ilustração de campanha"/);
});

test("card sem capa usa fallback discreto sem imagem externa", () => {
  const html = renderToStaticMarkup(
    createElement(BlogPostCard, {
      post: { ...samplePost, coverImageUrl: null, coverImageAlt: null },
    }),
  );
  assert.match(html, /Alexandre Feio/);
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes("unsplash"), false);
  assert.equal(html.includes("picsum"), false);
});

test("aside do blog aponta para cursos e gestão reais", () => {
  const html = renderToStaticMarkup(createElement(BlogDiscoveryAside));
  assert.match(html, /Aprender/);
  assert.match(html, /Delegar/);
  assert.match(html, /href="\/cursos"/);
  assert.match(html, /href="\/trafego-pago"/);
  assert.match(html, /Ver as formações/);
  assert.match(html, /Conhecer a gestão/);
});

test("seção da home some sem posts e lista três com CTA para o blog", () => {
  assert.equal(renderToStaticMarkup(createElement(HomeRecentArticles, { posts: [] })), "");
  const html = renderToStaticMarkup(
    createElement(HomeRecentArticles, {
      posts: [
        samplePost,
        { ...samplePost, slug: "segundo", title: "Segundo artigo" },
        { ...samplePost, slug: "terceiro", title: "Terceiro artigo", coverImageUrl: null },
      ],
    }),
  );
  assert.match(html, /Aprenda a atrair e converter mais clientes/);
  assert.match(html, /Ver todos os artigos/);
  assert.match(html, /href="\/blog"/);
  assert.match(html, /Segundo artigo/);
  assert.match(html, /Terceiro artigo/);
});

test("home preserva UX-C e inclui artigos recentes após Sobre", () => {
  const html = renderToStaticMarkup(
    createElement(CourseHome, {
      courses: [courseCard()],
      recentPosts: [samplePost],
    }),
  );
  assert.match(html, /Transforme tráfego em oportunidades/);
  assert.match(html, /APRENDER/);
  assert.match(html, /DELEGAR/);
  assert.match(html, /Aprenda a atrair e converter mais clientes/);
  assert.ok(html.indexOf("Alexandre Feio") < html.indexOf("Aprenda a atrair e converter mais clientes"));
});

test("listagem pública não carrega markdown completo", () => {
  const service = readFileSync("src/lib/blog/service.ts", "utf8");
  assert.match(service, /listPublishedPostCards/);
  assert.match(service, /publishedCardSelect/);
  assert.equal(service.includes("contentMarkdown: true,\n  categorySlug: true,\n  coverImageUrl"), false);
  const cardBlock = service.slice(service.indexOf("publishedCardSelect"), service.indexOf("export async function listPublishedPostCards"));
  assert.equal(cardBlock.includes("contentMarkdown"), false);
});

test("blog index e home usam cards sem markdown", () => {
  const blogPage = readFileSync("src/app/(public)/blog/page.tsx", "utf8");
  const homePage = readFileSync("src/app/(public)/page.tsx", "utf8");
  assert.match(blogPage, /listPublishedPostCards/);
  assert.match(blogPage, /BlogDiscoveryAside/);
  assert.match(blogPage, /lg:grid-cols-\[minmax\(0,7fr\)_minmax\(16rem,3fr\)\]/);
  assert.match(homePage, /listPublishedPostCards\(3\)/);
  assert.match(homePage, /force-dynamic/);
});
