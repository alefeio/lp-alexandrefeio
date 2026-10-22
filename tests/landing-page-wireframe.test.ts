import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPageRenderer } from "../src/components/landing-page/LandingPageRenderer";
import {
  COMPONENT_REGISTRY_V1,
  createEmptyLandingPageDocument,
  createLandingPageProject,
  createMemoryLandingPageStore,
  generateWireframePlan,
  GUIDED_WIREFRAME_ENGINE_V1,
  LANDING_COMPONENT_REGISTRY_V1,
  landingPageDocumentSchema,
  landingPageSectionSchema,
  materializeWireframePlan,
  parseWireframeContext,
  updateLandingPageDraft,
  wireframeContextSchema,
  applyGuidedWireframe,
} from "../src/lib/landing-page";
import { WIREFRAME_PLACEHOLDERS, WIREFRAME_REASON_TEXT } from "../src/lib/landing-page/wireframe/copy";
import type { WireframeContextV1 } from "../src/lib/landing-page/wireframe/context";
import { sitesCourseSeed } from "../src/lib/learning/sites-course";
import { firstCourseSeed } from "../src/lib/learning/first-course";

function context(overrides: Partial<WireframeContextV1> = {}): WireframeContextV1 {
  return {
    version: 1,
    offer: { name: "OFFER_SECRET_TOKEN", summary: "Serviço descrito pelo aluno." },
    audience: { description: "AUDIENCE_SECRET_TOKEN" },
    primaryGoal: "GENERATE_LEAD",
    primaryAction: { type: "FORM" },
    explanationNeed: "LOW",
    trustNeed: "LOW",
    decisionComplexity: "LOW",
    objections: [],
    processNeedsExplanation: "NO",
    proofSituation: "NOT_RELEVANT",
    contactImportance: "LOW",
    contextCompleteness: "SUFFICIENT",
    ...overrides,
  };
}

function keysOf(input: WireframeContextV1) {
  const plan = generateWireframePlan(input);
  assert.equal(plan.ok, true);
  if (!plan.ok) return [];
  return plan.value.sections.map((section) => section.key);
}

function planOf(input: WireframeContextV1) {
  const plan = generateWireframePlan(input);
  assert.equal(plan.ok, true);
  if (!plan.ok) throw new Error("plano inválido");
  return plan.value;
}

const whatsappService = () =>
  context({
    primaryGoal: "START_CONVERSATION",
    primaryAction: { type: "WHATSAPP", phone: "5511999990000", message: "Olá" },
    explanationNeed: "LOW",
    trustNeed: "MEDIUM",
    decisionComplexity: "LOW",
    proofSituation: "NEEDS_PROOF",
    contactImportance: "MEDIUM",
  });

const complexService = () =>
  context({
    primaryGoal: "REQUEST_QUOTE",
    primaryAction: { type: "FORM" },
    explanationNeed: "HIGH",
    trustNeed: "HIGH",
    decisionComplexity: "HIGH",
    objections: ["OBJECTION_SECRET_TOKEN", "Prazo"],
    processNeedsExplanation: "YES",
    proofSituation: "NEEDS_PROOF",
    contactImportance: "LOW",
  });

test("o mesmo contexto gera o mesmo plano e registra a versão do motor", () => {
  const input = whatsappService();
  const first = planOf(input);
  const second = planOf(input);
  assert.deepEqual(first, second);
  assert.equal(first.engineVersion, GUIDED_WIREFRAME_ENGINE_V1);
  assert.match(first.planFingerprint, /^[a-f0-9]{64}$/);
});

test("estratégias explícitas: focused, explanatory, trust, conversational e balanced", () => {
  assert.equal(planOf(context()).strategy, "FOCUSED");
  assert.equal(
    planOf(context({ explanationNeed: "HIGH", trustNeed: "LOW", decisionComplexity: "LOW", processNeedsExplanation: "NO" })).strategy,
    "EXPLANATORY",
  );
  assert.equal(planOf(context({ trustNeed: "HIGH", explanationNeed: "LOW", primaryAction: { type: "FORM" } })).strategy, "TRUST_HEAVY");
  assert.equal(planOf(whatsappService()).strategy, "CONVERSATIONAL");
  assert.equal(
    planOf(
      context({
        explanationNeed: "MEDIUM",
        trustNeed: "LOW",
        decisionComplexity: "MEDIUM",
        processNeedsExplanation: "UNKNOWN",
        proofSituation: "UNKNOWN",
        contextCompleteness: "PARTIAL",
      }),
    ).strategy,
    "BALANCED",
  );
});

test("contexto insuficiente limita a estrutura e a confiança", () => {
  const plan = planOf(
    context({
      contextCompleteness: "INSUFFICIENT",
      explanationNeed: "HIGH",
      trustNeed: "HIGH",
      decisionComplexity: "HIGH",
      objections: ["OBJECTION_SECRET_TOKEN"],
    }),
  );
  assert.equal(plan.confidence, "LIMITED");
  assert.deepEqual(keysOf(context({ contextCompleteness: "INSUFFICIENT" })), ["hero", "primary-cta", "footer"]);
  assert.equal(plan.warnings.some((warning) => warning.code === "NEEDS_MORE_CONTEXT"), true);
  assert.match(plan.warnings.map((warning) => warning.text).join(" "), /mais contexto/);
});

test("confiança forte, moderada e limitada", () => {
  assert.equal(planOf(context()).confidence, "STRONG");
  assert.equal(planOf(context({ contextCompleteness: "PARTIAL", proofSituation: "UNKNOWN" })).confidence, "MODERATE");
  assert.equal(planOf(context({ contextCompleteness: "INSUFFICIENT" })).confidence, "LIMITED");
});

test("cada seção tem propósito e reason code, sem justificativa genérica", () => {
  const plan = planOf(complexService());
  for (const section of plan.sections) {
    assert.ok(section.purpose.length > 10);
    assert.equal(section.reason, WIREFRAME_REASON_TEXT[section.reasonCode]);
    assert.equal(/boa prática/i.test(section.reason), false);
  }
  assert.equal(plan.sections.find((section) => section.key === "trust")?.reasonCode, "HIGH_TRUST_NEED");
  assert.equal(plan.sections.find((section) => section.key === "faq")?.reasonCode, "HAS_OBJECTIONS");
  assert.equal(plan.warnings.some((warning) => warning.code === "ADD_REAL_PROOF"), true);
});

test("cenário simples de WhatsApp não infla a página nem cria formulário", () => {
  assert.deepEqual(keysOf(whatsappService()), ["hero", "benefits", "trust", "primary-cta", "contact", "footer"]);
});

test("cenário complexo pede problema, solução, processo, confiança, faq e formulário", () => {
  assert.deepEqual(keysOf(complexService()), [
    "hero",
    "problem",
    "solution",
    "benefits",
    "process",
    "trust",
    "faq",
    "primary-form",
    "primary-cta",
    "footer",
  ]);
});

test("oferta simples com formulário fica curta", () => {
  assert.deepEqual(keysOf(context()), ["hero", "benefits", "primary-form", "footer"]);
});

test("objeções adicionam FAQ sem inventar o restante", () => {
  assert.deepEqual(keysOf(context({ objections: ["OBJECTION_SECRET_TOKEN"] })), ["hero", "benefits", "faq", "primary-form", "footer"]);
});

test("alta explicação com baixa confiança inclui problema e não inclui prova", () => {
  const keys = keysOf(context({ explanationNeed: "HIGH", trustNeed: "LOW", decisionComplexity: "LOW", proofSituation: "NOT_RELEVANT" }));
  assert.equal(keys.includes("problem"), true);
  assert.equal(keys.includes("solution"), true);
  assert.equal(keys.includes("trust"), false);
  assert.equal(keys.includes("faq"), true);
});

test("alta confiança com baixa explicação inclui prova e não inclui problema", () => {
  const keys = keysOf(
    context({
      trustNeed: "HIGH",
      explanationNeed: "LOW",
      decisionComplexity: "LOW",
      processNeedsExplanation: "NO",
      primaryAction: { type: "WHATSAPP", phone: "5511999990000" },
      proofSituation: "HAS_PROOF",
    }),
  );
  assert.equal(keys[0], "hero");
  assert.equal(keys.includes("trust"), true);
  assert.equal(keys.includes("problem"), false);
  assert.equal(keys.includes("process"), false);
  assert.equal(keys.includes("primary-form"), false);
  assert.equal(keys.includes("contact"), true);
});

test("ordem, chaves e obrigatoriedade são estáveis", () => {
  const plan = planOf(complexService());
  const priorities = plan.sections.map((section) => section.priority);
  assert.deepEqual(priorities, priorities.map((_, index) => index + 1));
  assert.equal(new Set(plan.sections.map((section) => section.key)).size, plan.sections.length);
  assert.equal(plan.sections[0]?.required, true);
  assert.equal(plan.sections.at(-1)?.key, "footer");
  assert.equal(plan.sections.at(-1)?.required, true);
  const trust = plan.sections.findIndex((section) => section.key === "trust");
  const cta = plan.sections.findIndex((section) => section.key === "primary-cta");
  assert.ok(trust >= 0 && trust < cta);
});

test("materialização valida o registry, marca placeholder e não inventa prova", () => {
  const input = complexService();
  const plan = planOf(input);
  let n = 0;
  const materialized = materializeWireframePlan(plan, input, { idFactory: () => `sec-${++n}` });
  assert.equal(materialized.ok, true);
  if (!materialized.ok) return;
  assert.equal(new Set(materialized.value.map((section) => section.id)).size, materialized.value.length);
  const serialized = JSON.stringify(materialized.value);
  assert.equal(serialized.includes("OFFER_SECRET_TOKEN"), false);
  assert.equal(serialized.includes("AUDIENCE_SECRET_TOKEN"), false);
  assert.equal(serialized.includes("OBJECTION_SECRET_TOKEN"), false);
  assert.equal(/lorem|ipsum|depoimento|98%|clientes atendidos/i.test(serialized), false);
  assert.equal(serialized.includes("<b>"), false);
  assert.equal(serialized.includes("html"), false);
  for (const section of materialized.value) {
    assert.equal(landingPageSectionSchema.safeParse(section).success, true);
    assert.equal(section.contentStatus, "PLACEHOLDER");
    assert.ok(COMPONENT_REGISTRY_V1[section.type].variants.includes(section.variant as never));
  }
  const trust = materialized.value.find((section) => section.type === "TRUST");
  assert.ok(trust && trust.type === "TRUST");
  if (trust?.type === "TRUST") assert.deepEqual(trust.content.items, []);
  const benefits = materialized.value.find((section) => section.type === "BENEFITS");
  assert.ok(benefits && benefits.type === "BENEFITS");
  if (benefits?.type === "BENEFITS") assert.equal(benefits.content.heading, WIREFRAME_PLACEHOLDERS.benefitsHeading);
});

test("renderer cobre PROBLEM e SOLUTION sem HTML cru", () => {
  const input = complexService();
  const plan = planOf(input);
  const materialized = materializeWireframePlan(plan, input, { idFactory: () => crypto.randomUUID() });
  assert.equal(materialized.ok, true);
  if (!materialized.ok) return;
  const document = createEmptyLandingPageDocument();
  document.sections = materialized.value;
  assert.equal(landingPageDocumentSchema.safeParse(document).success, true);
  const markup = renderToStaticMarkup(createElement(LandingPageRenderer, { document, mode: "PREVIEW" }));
  assert.match(markup, /data-section-type="PROBLEM"/);
  assert.match(markup, /data-section-type="SOLUTION"/);
  assert.match(markup, /<h2/);
  assert.match(markup, /break-words/);
  assert.match(markup, /overflow-x-hidden/);
  assert.match(markup, /grid-cols-1/);
  assert.equal(markup.includes("<script"), false);
  assert.equal(markup.includes("OFFER_SECRET_TOKEN"), false);
});

test("seções antigas continuam válidas e HTML cru segue rejeitado", () => {
  const legacy = {
    id: "hero",
    type: "HERO",
    variant: "default",
    order: 0,
    enabled: true,
    content: { headline: "Oferta" },
    settings: {},
  };
  assert.equal(landingPageSectionSchema.safeParse(legacy).success, true);
  assert.equal(
    landingPageSectionSchema.safeParse({
      id: "problem",
      type: "PROBLEM",
      variant: "default",
      order: 1,
      enabled: true,
      content: { heading: "Problema", html: "<b>x</b>" },
      settings: {},
      contentStatus: "PLACEHOLDER",
    }).success,
    false,
  );
  assert.equal(LANDING_COMPONENT_REGISTRY_V1, "LANDING_COMPONENT_REGISTRY_V1");
  assert.equal(wireframeContextSchema.safeParse(context({ primaryAction: { type: "EXTERNAL_URL", url: "javascript:alert(1)" } })).success, false);
});

test("aplicar no rascunho vazio preserva o documento e respeita revisão e dono", async () => {
  const store = createMemoryLandingPageStore({ courseIdBySlug: { "sites-que-convertem": "course-sites" } });
  const created = await createLandingPageProject(store, { userId: "owner", title: "Página", slug: "pagina-guiada" });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const empty = createEmptyLandingPageDocument();
  empty.theme = { ...empty.theme, colors: { ...empty.theme.colors, primary: "#123456" } };
  empty.conversion = { ...empty.conversion, businessOutcome: "pedido de contato" };
  empty.measurement = { version: 1, primaryConversionEvent: null, enabledEvents: ["PAGE_VIEW"] };
  empty.mediaRefs = [{ mediaId: "media-1", usage: "GENERAL" }];
  const seeded = await updateLandingPageDraft(store, {
    userId: "owner",
    landingPageProjectId: created.value.id,
    expectedRevision: 1,
    document: empty,
  });
  assert.equal(seeded.ok, true);
  if (!seeded.ok) return;

  const applied = await applyGuidedWireframe(store, {
    userId: "owner",
    landingPageProjectId: created.value.id,
    expectedRevision: seeded.value.draftRevision,
    context: context(),
    idFactory: () => crypto.randomUUID(),
  });
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.value.project.draftRevision, seeded.value.draftRevision + 1);
  assert.equal(applied.value.project.draftDocument.theme.colors.primary, "#123456");
  assert.equal(applied.value.project.draftDocument.conversion.businessOutcome, "pedido de contato");
  assert.deepEqual(applied.value.project.draftDocument.measurement.enabledEvents, ["PAGE_VIEW"]);
  assert.equal(applied.value.project.draftDocument.mediaRefs[0]?.mediaId, "media-1");
  assert.equal(applied.value.project.draftDocument.schemaVersion, 1);
  assert.equal(applied.value.project.draftDocument.registryVersion, LANDING_COMPONENT_REGISTRY_V1);
  assert.ok(applied.value.project.draftDocument.sections.length > 0);
  assert.equal(applied.value.project.draftDocument.guidedWireframe?.engineVersion, GUIDED_WIREFRAME_ENGINE_V1);

  const revision = applied.value.project.draftRevision;
  const again = await applyGuidedWireframe(store, {
    userId: "owner",
    landingPageProjectId: created.value.id,
    expectedRevision: revision,
    context: whatsappService(),
  });
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.code, "LANDING_PAGE_WIREFRAME_NOT_EMPTY");
  assert.equal(store.rows.get(created.value.id)?.draftRevision, revision);

  const stale = await applyGuidedWireframe(store, {
    userId: "owner",
    landingPageProjectId: created.value.id,
    expectedRevision: 1,
    context: context(),
  });
  assert.equal(stale.ok, false);

  const other = await applyGuidedWireframe(store, {
    userId: "other",
    landingPageProjectId: created.value.id,
    expectedRevision: revision,
    context: context(),
  });
  assert.equal(other.ok, false);
  if (!other.ok) assert.equal(other.code, "NOT_FOUND");

  const replace = await applyGuidedWireframe(store, {
    userId: "owner",
    landingPageProjectId: created.value.id,
    expectedRevision: revision,
    context: context(),
    mode: "REPLACE_ALL",
  });
  assert.equal(replace.ok, false);
  if (!replace.ok) assert.equal(replace.code, "LANDING_PAGE_WIREFRAME_REPLACE_DISABLED");

  const before = store.rows.get(created.value.id)?.draftRevision;
  generateWireframePlan(whatsappService());
  assert.equal(store.rows.get(created.value.id)?.draftRevision, before);
});

test("conflito de revisão não grava seções e o motor não registra contexto", async () => {
  const store = createMemoryLandingPageStore({ courseIdBySlug: { "sites-que-convertem": "course-sites" } });
  const created = await createLandingPageProject(store, { userId: "owner", title: "Página", slug: "pagina-stale" });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const stale = await applyGuidedWireframe(store, {
    userId: "owner",
    landingPageProjectId: created.value.id,
    expectedRevision: 9,
    context: context(),
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, "LANDING_PAGE_DRAFT_CONFLICT");
  assert.equal(store.rows.get(created.value.id)?.draftDocument.sections.length, 0);

  const sources = readdirSync("src/lib/landing-page/wireframe").map((name) =>
    readFileSync(`src/lib/landing-page/wireframe/${name}`, "utf8"),
  );
  const joined = sources.join("\n");
  assert.equal(joined.includes("console."), false);
  assert.equal(/openai|anthropic|generateText|ai-sdk/i.test(joined), false);
  assert.equal(joined.includes("LessonResult"), false);
  assert.equal(joined.includes("@/lib/learning"), false);
  assert.equal(joined.includes("OFFER_SECRET_TOKEN"), false);
  const preview = readFileSync("src/app/(app)/app/landing-pages/[landingPageProjectId]/preview/page.tsx", "utf8");
  assert.equal(preview.includes("ViewEvent"), false);
  assert.equal(sitesCourseSeed.status, "DRAFT");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  assert.equal(firstCourseSeed.bundlePriceCents, 24990);
  assert.equal(parseWireframeContext({ version: 1 }).ok, false);
});
