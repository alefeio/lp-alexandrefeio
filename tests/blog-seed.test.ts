import assert from "node:assert/strict";
import test from "node:test";
import {
  BLOG_CONTENT_ROLES,
  BLOG_IDEA_STATUSES,
  BLOG_SEARCH_INTENTS,
  isBlogCategory,
  isBlogCta,
} from "../src/lib/blog/catalog";
import { INITIAL_BLOG_IDEAS, INITIAL_BLOG_POSTS } from "../src/lib/blog/seed-catalog";

test("seed inicial cria somente rascunhos editoriais válidos", () => {
  assert.equal(INITIAL_BLOG_POSTS.length, 6);
  assert.equal(new Set(INITIAL_BLOG_POSTS.map((post) => post.id)).size, INITIAL_BLOG_POSTS.length);
  assert.equal(new Set(INITIAL_BLOG_POSTS.map((post) => post.slug)).size, INITIAL_BLOG_POSTS.length);

  for (const post of INITIAL_BLOG_POSTS) {
    assert.equal(post.status, "DRAFT");
    assert.equal(isBlogCategory(post.categorySlug), true);
    assert.equal(isBlogCta(post.ctaKey), true);
    assert.ok(post.excerpt.length >= 40);
    assert.ok(post.contentMarkdown.length >= 80);
    assert.ok(post.seoTitle.length <= 70);
    assert.ok(post.seoDescription.length <= 160);
    assert.equal(/^# /m.test(post.contentMarkdown), false);
  }
});

test("seed distribui os primeiros artigos pelos três pilares", () => {
  const count = (category: string) => INITIAL_BLOG_POSTS.filter((post) => post.categorySlug === category).length;
  assert.equal(count("trafego-pago"), 2);
  assert.equal(count("sites-landing-pages"), 2);
  assert.equal(count("aquisicao-conversao"), 2);
});

test("pautas seguintes são planejadas, válidas e apontam para rascunhos existentes", () => {
  assert.equal(INITIAL_BLOG_IDEAS.length, 6);
  assert.equal(new Set(INITIAL_BLOG_IDEAS.map((idea) => idea.id)).size, INITIAL_BLOG_IDEAS.length);
  assert.equal(new Set(INITIAL_BLOG_IDEAS.map((idea) => idea.title)).size, INITIAL_BLOG_IDEAS.length);

  const seededSlugs = new Set(INITIAL_BLOG_POSTS.map((post) => post.slug));
  for (const idea of INITIAL_BLOG_IDEAS) {
    assert.equal((BLOG_IDEA_STATUSES as readonly string[]).includes(idea.status), true);
    assert.equal(idea.status, "PLANNED");
    assert.equal(isBlogCategory(idea.categorySlug), true);
    assert.equal(isBlogCta(idea.ctaKey), true);
    assert.equal((BLOG_CONTENT_ROLES as readonly string[]).includes(idea.contentRole), true);
    assert.equal((BLOG_SEARCH_INTENTS as readonly string[]).includes(idea.searchIntent), true);
    assert.equal(seededSlugs.has(idea.relatedPostSlug), true);
  }
});

test("script de seed é explícito sobre segurança e não publica nem cria capa fictícia", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../scripts/seed-blog.ts", import.meta.url), "utf8");
  assert.match(source, /BLOG_SEED_CONFIRM/);
  assert.match(source, /status: "DRAFT"/);
  assert.match(source, /publishedAt: null/);
  assert.match(source, /coverImageUrl: null/);
  assert.match(source, /coverImagePublicId: null/);
  assert.equal(source.includes("PUBLISHED"), false);
  assert.equal(source.includes("uploadToApimg"), false);
});
