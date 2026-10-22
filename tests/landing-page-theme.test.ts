import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPageRenderer } from "../src/components/landing-page/LandingPageRenderer";
import {
  assessThemeContrast,
  calculateContrastRatio,
  consultoriaLandingFixture,
  createLandingPageProject,
  createMemoryLandingPageStore,
  defaultLandingPageTheme,
  evaluateVisualHierarchy,
  landingPageThemeSchema,
  themeFromBrandColors,
  themePreset,
  THEME_PRESET_IDS,
  updateLandingPageDraft,
  updateLandingPageSectionVisualSettings,
  updateLandingPageTheme,
} from "../src/lib/landing-page";
import { parseLandingPageDocument } from "../src/lib/landing-page/document";
import { mapLandingPageTheme } from "../src/lib/landing-page/theme";

function storeFor() {
  return createMemoryLandingPageStore({
    courseIdBySlug: { "sites-que-convertem": "course-sites" },
    projects: [{ id: "project-a", userId: "user-a" }, { id: "project-b", userId: "user-b" }],
  });
}

function readableTheme(overrides?: Record<string, unknown>) {
  return {
    ...defaultLandingPageTheme(),
    ...overrides,
    colors: { ...defaultLandingPageTheme().colors, ...(overrides?.colors as object | undefined) },
  };
}

test("schema do tema aceita tokens seguros e recusa CSS livre", () => {
  assert.equal(landingPageThemeSchema.safeParse(defaultLandingPageTheme()).success, true);
  assert.equal(defaultLandingPageTheme().version, 1);
  assert.equal(landingPageThemeSchema.safeParse(readableTheme({ colors: { primary: "red" } })).success, false);
  assert.equal(landingPageThemeSchema.safeParse(readableTheme({ colors: { primary: "rgb(0,0,0)" } })).success, false);
  assert.equal(landingPageThemeSchema.safeParse(readableTheme({ colors: { background: "var(--cta)" } })).success, false);
  assert.equal(landingPageThemeSchema.safeParse(readableTheme({ colors: { text: "color-mix(in srgb, white, black)" } })).success, false);
  assert.equal(landingPageThemeSchema.safeParse(readableTheme({ typography: { ...defaultLandingPageTheme().typography, fontFamily: "Comic Sans" } })).success, false);
  assert.equal(landingPageThemeSchema.safeParse(readableTheme({ typography: { ...defaultLandingPageTheme().typography, fontFamily: "https://fonts.example/font.css" } })).success, false);
  for (const font of ["SYSTEM_SANS", "INTER", "SERIF"] as const) {
    assert.equal(landingPageThemeSchema.safeParse(readableTheme({ typography: { ...defaultLandingPageTheme().typography, fontFamily: font } })).success, true);
  }
  for (const contentWidth of ["NARROW", "STANDARD", "WIDE"] as const) {
    assert.equal(landingPageThemeSchema.safeParse(readableTheme({ layout: { ...defaultLandingPageTheme().layout, contentWidth } })).success, true);
  }
  for (const sectionSpacing of ["COMPACT", "COMFORTABLE", "SPACIOUS"] as const) {
    assert.equal(landingPageThemeSchema.safeParse(readableTheme({ layout: { ...defaultLandingPageTheme().layout, sectionSpacing } })).success, true);
  }
  for (const buttonRadius of ["SQUARE", "SOFT", "ROUNDED"] as const) {
    assert.equal(landingPageThemeSchema.safeParse(readableTheme({ shape: { buttonRadius, cardRadius: buttonRadius } })).success, true);
  }
  for (const style of ["SOLID", "OUTLINE"] as const) {
    assert.equal(landingPageThemeSchema.safeParse(readableTheme({ buttons: { style } })).success, true);
  }
  assert.equal(landingPageThemeSchema.safeParse({ ...defaultLandingPageTheme(), css: "body{color:red}" }).success, false);
  const legacy = parseLandingPageDocument({
    ...consultoriaLandingFixture(),
    theme: {
      fontFamily: "sans",
      primaryColor: "#123456",
      backgroundColor: "#FFFFFF",
      textColor: "#111111",
      buttonRadius: "md",
      contentWidth: "wide",
    },
  });
  assert.equal(legacy.ok, true);
  if (legacy.ok) {
    assert.equal(legacy.document.theme.colors.primary, "#123456");
    assert.equal(legacy.document.theme.layout.contentWidth, "WIDE");
    assert.equal(legacy.document.theme.typography.fontFamily, "SYSTEM_SANS");
  }
});

test("contraste é determinístico e bloqueia papéis essenciais", () => {
  assert.equal(calculateContrastRatio("#000000", "#ffffff"), 21);
  assert.equal(calculateContrastRatio("#ffffff", "#000000"), calculateContrastRatio("#000000", "#ffffff"));
  const low = calculateContrastRatio("#999999", "#aaaaaa");
  assert.ok(low < 3);
  const weakText = readableTheme({ colors: { text: "#999999", background: "#aaaaaa" } });
  const textReport = assessThemeContrast(landingPageThemeSchema.parse(weakText));
  assert.ok(textReport.blocked.includes("TEXT_BACKGROUND"));
  const weakButton = readableTheme({ colors: { primary: "#888888", primaryText: "#999999" } });
  const buttonReport = assessThemeContrast(landingPageThemeSchema.parse(weakButton));
  assert.ok(buttonReport.blocked.includes("PRIMARY_TEXT_PRIMARY"));
  const muted = readableTheme({ colors: { mutedText: "#8a8a8a", background: "#ffffff" } });
  const mutedReport = assessThemeContrast(landingPageThemeSchema.parse(muted));
  assert.equal(mutedReport.checks.find((check) => check.pair === "MUTED_BACKGROUND")?.level, "ATTENTION");
  assert.equal(mutedReport.blocked.includes("MUTED_BACKGROUND"), false);
  for (const id of THEME_PRESET_IDS) {
    const report = assessThemeContrast(themePreset(id));
    assert.equal(report.blocked.length, 0, id);
  }
});

test("presets são ponto de partida e não trazem a marca da plataforma", async () => {
  const branded = JSON.stringify(THEME_PRESET_IDS.map((id) => themePreset(id)));
  assert.equal(/alexandre feio|1e5eff|geist/i.test(branded), false);
  assert.equal(/alexandre feio|1e5eff|geist/i.test(JSON.stringify(defaultLandingPageTheme())), false);
  const custom = themePreset("EDITORIAL");
  custom.colors.primary = "#1c1917";
  assert.equal(landingPageThemeSchema.safeParse(custom).success, true);
  assert.notEqual(custom.typography.fontFamily, themePreset("CLARO").typography.fontFamily);
  const derived = themeFromBrandColors({ primary: "#1c1917", background: "#f7f6f3", text: "#1c1917" });
  assert.equal(derived.colors.surface.startsWith("#"), true);
  assert.equal(assessThemeContrast(derived).blocked.length, 0);
  const store = storeFor();
  const created = await createLandingPageProject(store, { userId: "user-a", title: "Página", slug: "pagina", projectId: "project-a" });
  if (!created.ok) throw new Error(created.code);
  const saved = await updateLandingPageTheme(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    theme: themePreset("CONTRASTE"),
  });
  assert.equal(saved.ok, true);
  if (saved.ok) assert.equal(saved.value.draftDocument.theme.colors.text, "#000000");
});

test("tema e ajuste visual preservam copy, estratégia e revisão", async () => {
  const store = storeFor();
  const created = await createLandingPageProject(store, { userId: "user-a", title: "Página", slug: "pagina", projectId: "project-a" });
  if (!created.ok) throw new Error(created.code);
  const fixture = consultoriaLandingFixture();
  fixture.sections = fixture.sections.map((section) => section.id === "hero" ? { ...section, contentStatus: "APPROVED" as const, copyMeta: { origin: "MANUAL" as const, unresolvedFacts: [] } } : section);
  const drafted = await updateLandingPageDraft(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    document: fixture,
  });
  assert.equal(drafted.ok, true);
  if (!drafted.ok) return;
  const ready = await store.updateDraftAtomic({
    id: drafted.value.id,
    userId: "user-a",
    expectedRevision: drafted.value.draftRevision,
    document: drafted.value.draftDocument,
    status: "READY_TO_PREVIEW",
  });
  assert.equal(ready.ok, true);
  if (!ready.ok) return;
  const denied = await updateLandingPageTheme(store, {
    userId: "user-b",
    landingPageProjectId: ready.record.id,
    expectedRevision: ready.record.draftRevision,
    theme: themePreset("SOBRIO"),
  });
  assert.equal(denied.ok, false);
  const stale = await updateLandingPageTheme(store, {
    userId: "user-a",
    landingPageProjectId: ready.record.id,
    expectedRevision: ready.record.draftRevision - 1,
    theme: themePreset("SOBRIO"),
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, "LANDING_PAGE_DRAFT_CONFLICT");
  const blocked = await updateLandingPageTheme(store, {
    userId: "user-a",
    landingPageProjectId: ready.record.id,
    expectedRevision: ready.record.draftRevision,
    theme: readableTheme({ colors: { text: "#bbbbbb", background: "#cccccc" } }),
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "LANDING_PAGE_THEME_CONTRAST");
  const sectionsBefore = JSON.stringify(ready.record.draftDocument.sections);
  const saved = await updateLandingPageTheme(store, {
    userId: "user-a",
    landingPageProjectId: ready.record.id,
    expectedRevision: ready.record.draftRevision,
    theme: themePreset("SOBRIO"),
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.value.draftRevision, ready.record.draftRevision + 1);
  assert.equal(saved.value.status, "READY_TO_PREVIEW");
  assert.equal(JSON.stringify(saved.value.draftDocument.sections), sectionsBefore);
  assert.equal(JSON.stringify(saved.value.draftDocument.conversion), JSON.stringify(ready.record.draftDocument.conversion));
  assert.equal(JSON.stringify(saved.value.draftDocument.measurement), JSON.stringify(ready.record.draftDocument.measurement));
  assert.equal(JSON.stringify(saved.value.draftDocument.strategy ?? null), JSON.stringify(ready.record.draftDocument.strategy ?? null));
  const hero = saved.value.draftDocument.sections.find((section) => section.id === "hero");
  assert.equal(hero?.contentStatus, "APPROVED");
  assert.equal(hero?.copyMeta?.origin, "MANUAL");
  const visual = await updateLandingPageSectionVisualSettings(store, {
    userId: "user-a",
    landingPageProjectId: saved.value.id,
    sectionId: "hero",
    expectedRevision: saved.value.draftRevision,
    visualSettings: { backgroundRole: "SURFACE", alignment: "CENTER", emphasis: "FEATURED" },
    variant: "centered",
  });
  assert.equal(visual.ok, true);
  if (!visual.ok) return;
  const next = visual.value.draftDocument.sections.find((section) => section.id === "hero");
  assert.equal(next?.settings.alignment, "CENTER");
  assert.equal(next?.settings.backgroundRole, "SURFACE");
  assert.equal(next?.settings.emphasis, "FEATURED");
  assert.equal(next?.variant, "centered");
  assert.equal(next?.order, hero?.order);
  assert.equal(JSON.stringify(next?.content), JSON.stringify(hero?.content));
  assert.equal(next?.contentStatus, "APPROVED");
  const invalid = await updateLandingPageSectionVisualSettings(store, {
    userId: "user-a",
    landingPageProjectId: saved.value.id,
    sectionId: "hero",
    expectedRevision: visual.value.draftRevision,
    visualSettings: { backgroundRole: "PURPLE", alignment: "RIGHT", css: "position:absolute" },
  });
  assert.equal(invalid.ok, false);
  const missingAccent = await updateLandingPageSectionVisualSettings(store, {
    userId: "user-a",
    landingPageProjectId: saved.value.id,
    sectionId: "benefits",
    expectedRevision: visual.value.draftRevision,
    visualSettings: { backgroundRole: "ACCENT", alignment: "LEFT", emphasis: "NORMAL" },
    variant: "grid",
  });
  assert.equal(missingAccent.ok, false);
  const conflict = await updateLandingPageSectionVisualSettings(store, {
    userId: "user-a",
    landingPageProjectId: saved.value.id,
    sectionId: "hero",
    expectedRevision: saved.value.draftRevision,
    visualSettings: { alignment: "LEFT" },
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.code, "LANDING_PAGE_DRAFT_CONFLICT");
});

test("renderer aplica tokens, variantes e não recebe CSS cru", () => {
  const document = consultoriaLandingFixture();
  const hero = document.sections.find((section) => section.id === "hero");
  if (hero?.type === "HERO") hero.content.headline = "Uma headline longa precisa permanecer na largura da coluna mesmo em uma tela estreita de trezentos e vinte pixels";
  const faq = document.sections.find((section) => section.id === "faq");
  if (faq && faq.type === "FAQ") faq.content.items.push({ question: "Pergunta longa", answer: "Resposta longa ".repeat(30) });
  document.sections = document.sections.map((section) => section.id === "hero" ? { ...section, settings: { ...section.settings, alignment: "CENTER", emphasis: "FEATURED", backgroundRole: "SURFACE" } } : section);
  const markup = renderToStaticMarkup(createElement(LandingPageRenderer, { document, mode: "PREVIEW" }));
  assert.match(markup, /overflow-x-hidden/);
  assert.match(markup, /break-words/);
  assert.match(markup, /min\(100%, var\(--lp-content-width\)\)/);
  assert.match(markup, /grid-cols-1/);
  assert.match(markup, /@min-\[720px\]:grid-cols-2/);
  assert.match(markup, /@min-\[640px\]:px-6/);
  assert.match(markup, /@min-\[640px\]:grid-cols-2/);
  assert.match(markup, /focus-visible:outline/);
  assert.match(markup, /data-alignment="CENTER"/);
  assert.match(markup, /data-background-role="SURFACE"/);
  assert.match(markup, /data-emphasis="FEATURED"/);
  assert.match(markup, /data-section-variant="grid"/);
  assert.match(markup, /data-section-variant="numbered"/);
  assert.match(markup, /clamp\(1\.75rem, 5vw, 2\.75rem\)/);
  assert.equal(markup.includes("url("), false);
  assert.equal(markup.includes("position:absolute"), false);
  assert.equal(markup.includes("@import"), false);
  assert.equal(markup.includes("outline-none"), false);
  assert.match(markup, /<h1/);
  const outline = { ...document, theme: { ...document.theme, buttons: { style: "OUTLINE" as const } } };
  const outlineMarkup = renderToStaticMarkup(createElement(LandingPageRenderer, { document: outline, mode: "PREVIEW" }));
  assert.match(outlineMarkup, /1px solid #1d4ed8/);
  const mapped = JSON.stringify(mapLandingPageTheme(document.theme));
  assert.match(mapped, /48rem|40rem|64rem/);
  assert.equal(mapped.includes("url("), false);
  const globals = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(globals, /:focus-visible/);
  const themeSource = readFileSync(new URL("../src/lib/landing-page/theme/service.ts", import.meta.url), "utf8");
  assert.equal(/openai|generateText/i.test(themeSource), false);
});

test("avisos de hierarquia não alteram o documento", () => {
  const document = consultoriaLandingFixture();
  const before = JSON.stringify(document);
  assert.deepEqual(evaluateVisualHierarchy(defaultLandingPageTheme(), []), []);
  const featured = document.sections.slice(0, 4).map((section) => ({ ...section, settings: { ...section.settings, emphasis: "FEATURED" as const } }));
  assert.ok(evaluateVisualHierarchy(document.theme, featured).includes("TOO_MANY_FEATURED_SECTIONS"));
  const primary = document.sections.slice(0, 3).map((section) => ({ ...section, enabled: true, settings: { ...section.settings, backgroundRole: "PRIMARY" as const } }));
  assert.ok(evaluateVisualHierarchy(document.theme, primary).includes("PRIMARY_USED_AS_BACKGROUND_TOO_OFTEN"));
  const centered = document.sections.slice(0, 3).map((section) => ({ ...section, enabled: true, settings: { ...section.settings, alignment: "CENTER" as const } }));
  assert.ok(evaluateVisualHierarchy(document.theme, centered).includes("EXCESSIVE_CENTER_ALIGNMENT"));
  const pale = readableTheme({ colors: { primary: "#8a8a8a", primaryText: "#ffffff" } });
  const parsed = landingPageThemeSchema.parse(pale);
  if (assessThemeContrast(parsed).checks.some((check) => check.pair === "PRIMARY_TEXT_PRIMARY" && check.level !== "GOOD")) {
    assert.ok(evaluateVisualHierarchy(parsed, []).includes("NO_PRIMARY_CONTRAST"));
  }
  assert.equal(JSON.stringify(document), before);
});
