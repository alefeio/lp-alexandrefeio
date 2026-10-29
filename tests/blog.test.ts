import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BLOG_CATEGORIES, BLOG_CTA_KEYS, BLOG_EMPTY_MESSAGE, isBlogCategory, isBlogCta } from "../src/lib/blog/catalog";
import { prepareBlogWrite, readingTimeMinutes, selectRelated, isSafeHref, slugConflict, slugifyTitle, demoteMarkdownH1 } from "../src/lib/blog/rules";
import { blogPostingJsonLd } from "../src/lib/blog/seo";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";

const now = new Date("2026-10-27T12:00:00.000Z");
const coverUrl = "https://apimg.com.br/blog/pronto-para-anunciar.webp";
const fields = {
  title: "Como saber se o negócio está pronto para anunciar",
  slug: "pronto-para-anunciar",
  excerpt: "Um critério simples para decidir se o anúncio vem antes ou depois da página.",
  contentMarkdown: "# Título indevido\n\n" + "Texto prático para o pequeno negócio. ".repeat(8),
  categorySlug: "trafego-pago",
  ctaKey: "TRAFFIC_COURSE",
  seoTitle: "Pronto para anunciar",
  seoDescription: "Decida se o anúncio é o próximo passo.",
  coverImageAlt: "Pessoa analisando uma campanha de tráfego pago.",
};

test("rascunho salva incompleto e publicação exige o essencial", () => {
  const draft = prepareBlogWrite({ existing: null, fields: { ...fields, excerpt: "", contentMarkdown: "", categorySlug: "" }, intent: "save", now });
  assert.equal(draft.ok, true);
  const blocked = prepareBlogWrite({ existing: null, fields: { ...fields, excerpt: "curto", contentMarkdown: "pouco" }, intent: "publish", now, coverUrl });
  assert.equal(blocked.ok, false);
  const withoutCover = prepareBlogWrite({ existing: null, fields, intent: "publish", now });
  assert.equal(withoutCover.ok, false);
  if (!withoutCover.ok) assert.match(withoutCover.message, /imagem de capa/);
  const withoutAlt = prepareBlogWrite({ existing: null, fields: { ...fields, coverImageAlt: "" }, intent: "publish", now, coverUrl });
  assert.equal(withoutAlt.ok, false);
  if (!withoutAlt.ok) assert.match(withoutAlt.message, /texto alternativo/);
  const published = prepareBlogWrite({ existing: null, fields, intent: "publish", now, coverUrl });
  assert.equal(published.ok, true);
  if (published.ok) {
    assert.equal(published.record.status, "PUBLISHED");
    assert.equal(published.record.publishedAt?.toISOString(), now.toISOString());
    assert.equal(published.record.contentMarkdown.startsWith("# "), false);
  }
});

test("slug único fica travado e a data da primeira publicação permanece", () => {
  assert.equal(slugifyTitle("Ação de tráfego"), "acao-de-trafego");
  assert.equal(slugConflict("pronto", [{ id: "1", slug: "pronto" }], "2"), true);
  assert.equal(slugConflict("pronto", [{ id: "1", slug: "pronto" }], "1"), false);
  const first = new Date("2026-10-27T08:00:00.000Z");
  const edited = prepareBlogWrite({
    existing: { slug: "pronto-para-anunciar", publishedAt: first, status: "PUBLISHED" },
    fields: { ...fields, slug: "outro-slug" },
    intent: "save",
    now,
    coverUrl,
  });
  assert.equal(edited.ok, true);
  if (edited.ok) {
    assert.equal(edited.record.slug, "pronto-para-anunciar");
    assert.equal(edited.record.publishedAt?.toISOString(), first.toISOString());
  }
  const hidden = prepareBlogWrite({
    existing: { slug: "pronto-para-anunciar", publishedAt: first, status: "PUBLISHED" },
    fields,
    intent: "unpublish",
    now,
  });
  assert.equal(hidden.ok, true);
  if (hidden.ok) {
    assert.equal(hidden.record.status, "DRAFT");
    assert.equal(hidden.record.publishedAt?.toISOString(), first.toISOString());
  }
});

test("artigo público, sitemap e json-ld só consideram o que está publicado", () => {
  const page = readFileSync(new URL("../src/app/(public)/blog/[slug]/page.tsx", import.meta.url), "utf8");
  const index = readFileSync(new URL("../src/app/(public)/blog/page.tsx", import.meta.url), "utf8");
  assert.match(page, /getPublishedPost/);
  assert.match(page, /notFound/);
  assert.match(index, /BLOG_EMPTY_MESSAGE|primeiros conteúdos estão em preparação/);
  assert.equal(BLOG_EMPTY_MESSAGE.includes("preparação"), true);
  const sitemap = buildPublicSitemap("https://alexandrefeio.com.br", {
    courses: [],
    lessons: [],
    posts: [{ slug: "pronto-para-anunciar", updatedAt: now }],
  });
  assert.equal(sitemap.some((entry) => entry.url.endsWith("/blog/pronto-para-anunciar")), true);
  assert.equal(buildPublicSitemap("https://alexandrefeio.com.br", { courses: [], lessons: [], posts: [] }).some((entry) => entry.url.endsWith("/blog")), false);
  const json = blogPostingJsonLd({ title: "Pronto", description: "Resumo", path: "/blog/pronto", publishedAt: now, updatedAt: now, image: "https://apimg.com.br/capa.jpg" });
  assert.equal(json["@type"], "BlogPosting");
  assert.equal(json.headline, "Pronto");
  assert.equal(json.mainEntityOfPage, "https://alexandrefeio.com.br/blog/pronto");
  assert.equal((json.author as { name: string }).name, "Alexandre Feio");
});

test("markdown, categorias, CTA, capa e relacionados seguem a allowlist", () => {
  assert.equal(isSafeHref("javascript:alert(1)"), false);
  assert.equal(isSafeHref("data:text/html,hi"), false);
  assert.equal(isSafeHref("/blog/pronto"), true);
  assert.equal(isSafeHref("https://developers.google.com/google-ads"), true);
  assert.equal(demoteMarkdownH1("# Titulo\n\n## Seção").startsWith("## "), true);
  assert.equal(readingTimeMinutes("palavra ".repeat(400)), 2);
  assert.equal(isBlogCategory("trafego-pago"), true);
  assert.equal(isBlogCategory("tag-livre"), false);
  assert.equal(isBlogCta("TRAFFIC_COURSE"), true);
  assert.equal(isBlogCta("https://evil.example"), false);
  assert.equal(BLOG_CATEGORIES.length, 3);
  assert.equal(BLOG_CTA_KEYS.includes("NONE"), true);
  const related = selectRelated([
    { slug: "a", categorySlug: "trafego-pago", publishedAt: new Date("2026-10-01") },
    { slug: "b", categorySlug: "trafego-pago", publishedAt: new Date("2026-10-02") },
    { slug: "c", categorySlug: "sites-landing-pages", publishedAt: new Date("2026-10-03") },
    { slug: "d", categorySlug: "trafego-pago", publishedAt: new Date("2026-10-04") },
    { slug: "e", categorySlug: "trafego-pago", publishedAt: new Date("2026-10-05") },
  ], "a", "trafego-pago");
  assert.deepEqual(related.map((item) => item.slug), ["e", "d", "b"]);
  const service = readFileSync(new URL("../src/lib/blog/service.ts", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../src/lib/blog/actions.ts", import.meta.url), "utf8");
  assert.match(service, /BLOG_COVER_FOLDER/);
  assert.match(readFileSync(new URL("../src/lib/blog/catalog.ts", import.meta.url), "utf8"), /alexandre-feio\/blog\/covers/);
  assert.match(service, /validateEditorialImage/);
  assert.match(service, /uploadToApimg/);
  assert.equal(service.includes(".delete("), false);
  assert.match(actions, /requireAdmin/);
  assert.match(actions, /revalidatePath\("\/blog"\)/);
  for (const file of ["page.tsx", "novo/page.tsx", "[id]/page.tsx", "[id]/preview/page.tsx", "planejamento/page.tsx"]) {
    const source = readFileSync(new URL(`../src/app/(admin)/admin/blog/${file}`, import.meta.url), "utf8");
    assert.match(source, /requireAdmin/);
    assert.match(source, /if \(!session\) return null/);
  }
});
