import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPageRenderer } from "../src/components/landing-page/LandingPageRenderer";
import {
  consultoriaLandingFixture,
  createEmptyLandingPageDocument,
  landingPageActionSchema,
  landingPageDocumentSchema,
  mapLandingPageTheme,
  parseLandingPageDocument,
  resolveLandingPageAction,
  visibleLandingPageSections,
} from "../src/lib/landing-page";
import { buildPublicSitemap } from "../src/lib/seo/public-sitemap";
import { sitesCourseSeed } from "../src/lib/learning/sites-course";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { createLandingPageProject, getLandingPageProject, updateLandingPageDraft } from "../src/lib/landing-page/service";
import { createMemoryLandingPageStore } from "../src/lib/landing-page/memory-store";

function html(mode: "PREVIEW" | "PUBLIC" = "PREVIEW") {
  const document = consultoriaLandingFixture();
  assert.equal(landingPageDocumentSchema.safeParse(document).success, true);
  return renderToStaticMarkup(createElement(LandingPageRenderer, { document, mode }));
}

test("documento válido renderiza todos os tipos V1 habilitados", () => {
  const markup = html();
  for (const type of ["HERO", "BENEFITS", "PROCESS", "TRUST", "FAQ", "CTA", "FORM", "CONTACT", "FOOTER"]) {
    assert.match(markup, new RegExp(`data-section-type="${type}"`));
  }
  assert.match(markup, /Consultoria para pequenos negócios/);
  assert.match(markup, /grid-cols-1/);
  assert.match(markup, /md:grid-cols-2/);
  assert.match(markup, /sm:flex-row/);
  assert.equal(markup.includes("Oculto"), false);
  assert.equal(markup.includes("Alexandre Feio"), false);
  assert.equal(markup.includes("dangerouslySetInnerHTML"), false);
  assert.equal(markup.includes("<script"), false);
});

test("ordem determinística e seção desabilitada omitida", () => {
  const document = consultoriaLandingFixture();
  const visible = visibleLandingPageSections(document.sections);
  assert.deepEqual(
    visible.map((section) => section.id),
    ["benefits", "hero", "process", "trust", "faq", "cta", "formulario", "contact", "footer"],
  );
  const markup = html();
  const benefits = markup.indexOf('data-section-id="benefits"');
  const hero = markup.indexOf('data-section-id="hero"');
  assert.ok(benefits >= 0 && hero > benefits);
  assert.equal(markup.includes('data-section-id="off"'), false);
});

test("documento vazio não inventa seção", () => {
  const markup = renderToStaticMarkup(
    createElement(LandingPageRenderer, { document: createEmptyLandingPageDocument(), mode: "PREVIEW" }),
  );
  assert.equal(markup.includes("data-section-type"), false);
});

test("hierarquia: um h1 no hero e h2 nas seções", () => {
  const markup = html();
  assert.equal(markup.match(/<h1/g)?.length, 1);
  assert.match(markup, /<h2/);
  assert.match(markup, /<h3/);
});

test("preview não navega nem envia formulário; public resolve href", () => {
  const preview = html("PREVIEW");
  assert.equal(preview.includes("wa.me"), false);
  assert.equal(preview.includes("https://exemplo.com"), false);
  assert.match(preview, /data-preview-action="disabled"/);
  assert.match(preview, /disabled/);
  assert.equal(preview.includes("javascript:"), false);

  const published = html("PUBLIC");
  assert.match(published, /https:\/\/wa\.me\/5511999990000\?text=/);
  assert.match(published, /https:\/\/exemplo\.com\/contato/);
  assert.match(published, /href="#formulario"/);
});

test("action resolver sanitiza WhatsApp, URL, rota e âncora", () => {
  const whatsapp = resolveLandingPageAction({ type: "WHATSAPP", phone: "5511999990000", message: "Oi & lá" });
  assert.equal(whatsapp?.href, "https://wa.me/5511999990000?text=Oi%20%26%20l%C3%A1");
  assert.equal(resolveLandingPageAction({ type: "EXTERNAL_URL", url: "https://exemplo.com/a" })?.href, "https://exemplo.com/a");
  assert.equal(resolveLandingPageAction({ type: "INTERNAL_ROUTE", path: "/inicio" })?.href, "/inicio");
  assert.equal(resolveLandingPageAction({ type: "FORM_ANCHOR", sectionId: "formulario" })?.href, "#formulario");
  assert.equal(resolveLandingPageAction({ type: "FORM_ANCHOR", sectionId: "bad selector" }), null);
  assert.equal(resolveLandingPageAction({ type: "WHATSAPP", phone: "12" }), null);
});

test("theme mapper só emite hex e tokens internos", () => {
  const theme = mapLandingPageTheme(consultoriaLandingFixture().theme);
  const serialized = JSON.stringify(theme);
  assert.match(serialized, /#1d4ed8/);
  assert.equal(serialized.includes("url("), false);
  assert.equal(serialized.includes("@import"), false);
  assert.throws(() => mapLandingPageTheme({ ...consultoriaLandingFixture().theme, primaryColor: "red" as "#000000" }));
});

test("schema e registry inválidos não passam para o renderer", () => {
  const base = createEmptyLandingPageDocument();
  assert.equal(parseLandingPageDocument({ ...base, schemaVersion: 9 }).ok, false);
  assert.equal(parseLandingPageDocument({ ...base, registryVersion: "NOPE" }).ok, false);
  const raw = { ...base, sections: [{ id: "x", type: "HERO", variant: "default", order: 0, enabled: true, content: { headline: "A", html: "<b>x</b>" }, settings: {} }] };
  assert.equal(landingPageDocumentSchema.safeParse(raw).success, false);
  assert.equal(landingPageDocumentSchema.safeParse({ ...base, sections: [] , theme: { ...base.theme, primaryColor: "red" } }).success, false);

  const schemaMarkup = renderToStaticMarkup(
    createElement(LandingPageRenderer, { document: { ...base, schemaVersion: 9 }, mode: "PREVIEW" }),
  );
  assert.match(schemaMarkup, /data-landing-error="UNSUPPORTED_SCHEMA_VERSION"/);
  const registryMarkup = renderToStaticMarkup(
    createElement(LandingPageRenderer, { document: { ...base, registryVersion: "NOPE" }, mode: "PREVIEW" }),
  );
  assert.match(registryMarkup, /data-landing-error="UNSUPPORTED_REGISTRY_VERSION"/);
  assert.equal(landingPageActionSchema.safeParse({ type: "EXTERNAL_URL", url: "javascript:alert(1)" }).success, false);
});

test("texto longo quebra e layout responsivo está no markup", () => {
  const document = createEmptyLandingPageDocument();
  document.sections = [
    {
      id: "hero",
      type: "HERO",
      variant: "default",
      order: 0,
      enabled: true,
      content: { headline: "A".repeat(120), subheadline: "B".repeat(200) },
      settings: {},
    },
    {
      id: "benefits",
      type: "BENEFITS",
      variant: "grid",
      order: 1,
      enabled: true,
      content: { heading: "Itens", items: [{ title: "Item", description: "C".repeat(80) }] },
      settings: {},
    },
  ];
  const markup = renderToStaticMarkup(createElement(LandingPageRenderer, { document, mode: "PREVIEW" }));
  assert.match(markup, /break-words/);
  assert.match(markup, /overflow-x-hidden/);
  assert.match(markup, /A{20}/);
});

test("preview autenticado é read-only, noindex e fora do sitemap", () => {
  const page = readFileSync(
    new URL("../src/app/(app)/app/landing-pages/[landingPageProjectId]/preview/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /requireSession/);
  assert.match(page, /getLandingPageProject/);
  assert.match(page, /mode="PREVIEW"/);
  assert.match(page, /draftDocument/);
  assert.match(page, /index: false, follow: false/);
  assert.equal(page.includes("updateLandingPageDraft"), false);
  assert.equal(page.includes("publishedPublication"), false);
  assert.equal(page.includes("ViewEvent"), false);
  assert.equal(page.includes("lessonProgress"), false);
  const sitemap = buildPublicSitemap("https://alexandrefeio.com.br", {
    courses: [{ slug: firstCourseSeed.slug, updatedAt: new Date() }],
    lessons: [],
  });
  assert.equal(sitemap.some((entry) => entry.url.includes("/app/landing-pages")), false);
  assert.equal(sitemap.some((entry) => entry.url.includes("/p/")), false);
});

test("documento inválido não renderiza conteúdo parcial", () => {
  const base = createEmptyLandingPageDocument();
  const markup = renderToStaticMarkup(
    createElement(LandingPageRenderer, {
      document: { ...base, sections: [{ id: "x", type: "RAW", enabled: true, order: 0 }] },
      mode: "PREVIEW",
    }),
  );
  assert.match(markup, /data-landing-error="LANDING_PAGE_DOCUMENT_INVALID"/);
  assert.equal(markup.includes("data-section-type"), false);
  assert.equal(markup.includes("<script"), false);
});

test("preview lê o draft do dono e não altera a revisão", async () => {
  const store = createMemoryLandingPageStore({ courseIdBySlug: { "sites-que-convertem": "course-sites" } });
  const created = await createLandingPageProject(store, {
    userId: "owner",
    title: "Página do aluno",
    slug: "consultoria-exemplo",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const updated = await updateLandingPageDraft(store, {
    userId: "owner",
    landingPageProjectId: created.value.id,
    expectedRevision: 1,
    document: consultoriaLandingFixture(),
  });
  assert.equal(updated.ok, true);
  if (!updated.ok) return;

  const before = store.rows.get(created.value.id);
  const revision = before?.draftRevision;
  const updatedAt = before?.updatedAt.getTime();

  const owner = await getLandingPageProject(store, { userId: "owner", landingPageProjectId: created.value.id });
  const other = await getLandingPageProject(store, { userId: "other", landingPageProjectId: created.value.id });
  assert.equal(owner.ok, true);
  assert.equal(other.ok, false);
  if (!other.ok) assert.equal(other.code, "NOT_FOUND");
  if (owner.ok) {
    assert.equal(owner.value.draftDocument.sections.some((section) => section.id === "hero"), true);
    assert.equal(owner.value.draftRevision, revision);
  }
  const after = store.rows.get(created.value.id);
  assert.equal(after?.draftRevision, revision);
  assert.equal(after?.updatedAt.getTime(), updatedAt);
  assert.equal(after?.status, "DRAFT");
});

test("renderer não usa HTML cru e curso 1 permanece intacto", () => {
  const source = readFileSync(new URL("../src/components/landing-page/LandingPageRenderer.tsx", import.meta.url), "utf8");
  assert.equal(source.includes("dangerouslySetInnerHTML"), false);
  assert.equal(sitesCourseSeed.status, "DRAFT");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(firstCourseSeed.bundlePriceCents, 24990);
});
