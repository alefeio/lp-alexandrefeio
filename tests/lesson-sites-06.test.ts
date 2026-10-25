import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPageRenderer } from "../src/components/landing-page/LandingPageRenderer";
import { assessLesson } from "../src/lib/editorial/readiness";
import {
  applyReviewedWireframe,
  createLandingPageProject,
  createMemoryLandingPageStore,
  generateWireframePlan,
  getLandingPageProject,
  proposeWireframeFromDocument,
  saveConversionPageBrief,
  saveVisitorDecisionJourney,
  updateLandingPageDraft,
  updateLandingPageWireframeStructure,
  addReviewedSection,
  moveReviewedSection,
  removeReviewedSection,
  reviewedPlanFromEngine,
  validateReviewedWireframePlan,
} from "../src/lib/landing-page";
import { WIREFRAME_PLACEHOLDERS, WIREFRAME_REASON_TEXT } from "../src/lib/landing-page/wireframe/copy";
import { confidenceLabel, hasActionPath, strategyLabel } from "../src/lib/landing-page/wireframe/policy";
import { buildWireframeContextFromLandingPageProject } from "../src/lib/landing-page/wireframe/from-brief";
import { siteLesson06Blocks, siteLesson06Meta } from "../src/lib/learning/site-organize-as-secoes-da-pagina";
import { sitesCourseSeed } from "../src/lib/learning/sites-course";

function storeFor() {
  return createMemoryLandingPageStore({
    courseIdBySlug: { "sites-que-convertem": "course-sites" },
    projects: [{ id: "project-a", userId: "user-a" }],
  });
}

function brief() {
  return {
    version: 1,
    offer: { name: "Móveis planejados sob medida" },
    audience: { description: "Quem já quer um projeto e precisa orçar" },
    problemOrContext: "Precisa decidir prazo, medida e confiança antes de contratar",
    primaryBenefit: "Saber como o orçamento acontece",
    pageGoal: "REQUEST_QUOTE",
    primaryAction: { type: "FORM", label: "Solicitar análise" },
    businessOutcome: "QUOTE",
    objections: ["prazo"],
    arrivalContext: { trafficSources: ["INSTAGRAM"], whatVisitorMayAlreadyKnow: "Viu um projeto no perfil" },
  };
}

function journey(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    awarenessLevel: "KNOWS_THE_OFFER",
    explanationNeed: "HIGH",
    decisionComplexity: "HIGH",
    trustNeed: "HIGH",
    objectionAnalysis: [{ objection: "prazo", category: "TIMING", importance: "HIGH" }],
    processNeedsExplanation: "YES",
    proofSituation: "NEEDS_PROOF",
    contactImportance: "HIGH",
    preferredConversionMethod: "FORM",
    decisionStages: [
      { type: "ARRIVAL", goal: "Reconhecer o tipo de projeto" },
      { type: "BUILD_TRUST", goal: "Confiar no processo" },
      { type: "ACT", goal: "Pedir orçamento" },
    ],
    ...overrides,
  };
}

async function readyPage(overrides?: Record<string, unknown>) {
  const store = storeFor();
  const created = await createLandingPageProject(store, { userId: "user-a", title: "Página", slug: "pagina", projectId: "project-a" });
  if (!created.ok) throw new Error(created.code);
  const withBrief = await saveConversionPageBrief(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    brief: brief(),
  });
  if (!withBrief.ok) throw new Error(withBrief.code);
  const withJourney = await saveVisitorDecisionJourney(store, {
    userId: "user-a",
    landingPageProjectId: withBrief.value.id,
    expectedRevision: withBrief.value.draftRevision,
    decisionJourney: journey(overrides),
  });
  if (!withJourney.ok) throw new Error(withJourney.code);
  return { store, page: withJourney.value };
}

test("aula 6 completa com 32 blocos, 4 checkpoints, tool e transição", () => {
  assert.equal(siteLesson06Blocks.length, 32);
  assert.ok(siteLesson06Blocks.length >= 31 && siteLesson06Blocks.length <= 33);
  assert.equal(new Set(siteLesson06Blocks.map((block) => block.blockKey)).size, siteLesson06Blocks.length);
  assert.equal(siteLesson06Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 4);
  const tool = siteLesson06Blocks.find((block) => block.data.type === "TOOL");
  assert.equal(tool?.data.type === "TOOL" && tool.data.toolKey, "LANDING_PAGE_WIREFRAME_V1");
  const result = siteLesson06Blocks.find((block) => block.data.type === "RESULT");
  assert.equal(result?.data.type === "RESULT" && result.data.title, "Estrutura da minha landing page");
  const body = siteLesson06Blocks.map((block) => JSON.stringify(block.data)).join("\n");
  assert.match(body, /Agora sua landing page vai deixar de existir apenas como planejamento/);
  assert.match(body, /Escreva uma mensagem que deixa sua oferta clara/);
  assert.match(body, /É aqui que sua página começa a falar com o visitante/);
  assert.equal(body.includes("lorem ipsum"), false);
  const answers = siteLesson06Blocks.filter((block) => block.data.type === "CHECKPOINT").map((block) => block.data.type === "CHECKPOINT" ? block.data.correctOptionId : "");
  assert.deepEqual(answers, ["nao", "nao", "sim", "nao"]);
  assert.equal(siteLesson06Meta.priceCents, 3990);
  assert.equal(siteLesson06Meta.estimatedMinutes, 35);
  assert.equal(siteLesson06Meta.commerceStatus, "NOT_FOR_SALE");
  assert.equal(siteLesson06Meta.accessType, "PAID");
  const assessment = assessLesson(
    {
      title: siteLesson06Meta.title,
      summary: siteLesson06Meta.summary,
      publicPreview: siteLesson06Meta.publicPreview,
      estimatedMinutes: 35,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: 3990,
      commerceStatus: "NOT_FOR_SALE",
    },
    siteLesson06Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.equal(assessment.ready, true, assessment.issues.join(" "));
  assert.equal(sitesCourseSeed.status, "PUBLISHED");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
});

test("contexto completo gera plano sem gravar e contexto parcial avisa", async () => {
  const { store, page } = await readyPage();
  const before = page.draftRevision;
  const proposal = proposeWireframeFromDocument(page.draftDocument);
  assert.equal(proposal.ok, true);
  if (!proposal.ok) return;
  assert.equal(proposal.value.completeness, "SUFFICIENT");
  assert.equal(proposal.value.canApply, true);
  assert.ok(proposal.value.reviewed);
  assert.equal(proposal.value.reviewed?.sections.some((section) => section.purpose.length > 0), true);
  assert.equal(proposal.value.reviewed?.sections.some((section) => section.reason?.includes("HIGH_TRUST_NEED")), false);
  assert.match(proposal.value.confidenceLabel ?? "", /informações suficientes/);
  assert.equal(confidenceLabel("STRONG").includes("STRONG"), false);
  assert.equal(strategyLabel("TRUST_HEAVY").includes("TRUST_HEAVY"), false);
  assert.match(strategyLabel("TRUST_HEAVY"), /confiança/);
  const again = await getLandingPageProject(store, { userId: "user-a", landingPageProjectId: page.id });
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.value.draftRevision, before);
  assert.equal(again.value.draftDocument.sections.length, 0);
  assert.equal(again.value.status, "DRAFT");

  const partialPage = await readyPage({ explanationNeed: "UNKNOWN" });
  const partial = proposeWireframeFromDocument(partialPage.page.draftDocument);
  assert.equal(partial.ok, true);
  if (!partial.ok) return;
  assert.equal(partial.value.completeness, "PARTIAL");
  assert.equal(partial.value.canApply, true);
  assert.match(partial.value.partialWarning ?? "", /recomendação inicial/);
  assert.match(partial.value.confidenceLabel ?? "", /refinadas|inicial/);
});

test("contexto insuficiente não aplica e a revisão protege a estrutura", async () => {
  const store = storeFor();
  const created = await createLandingPageProject(store, { userId: "user-a", title: "Vazia", slug: "vazia" });
  if (!created.ok) return;
  const proposal = proposeWireframeFromDocument(created.value.draftDocument);
  assert.equal(proposal.ok, true);
  if (!proposal.ok || proposal.value.reviewed) return;
  assert.equal(proposal.value.canApply, false);
  assert.equal(proposal.value.missingBrief, true);
  const blocked = await applyReviewedWireframe(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    reviewed: {},
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "LANDING_PAGE_CONTEXT_INSUFFICIENT");
  const untouched = await getLandingPageProject(store, { userId: "user-a", landingPageProjectId: created.value.id });
  assert.equal(untouched.ok, true);
  if (!untouched.ok) return;
  assert.equal(untouched.value.draftDocument.sections.length, 0);
  assert.equal(untouched.value.status, "DRAFT");

  const { page } = await readyPage();
  const full = proposeWireframeFromDocument(page.draftDocument);
  if (!full.ok || !full.value.reviewed) return;
  const original = full.value.reviewed;
  const moved = moveReviewedSection(original, original.sections[1]?.key ?? "hero", "up", original);
  assert.notEqual(moved.sections.map((section) => section.key).join(), original.sections.map((section) => section.key).join());
  const optional = original.sections.find((section) => section.type !== "HERO" && section.type !== "FOOTER");
  assert.ok(optional);
  if (!optional) return;
  const removed = removeReviewedSection(original, optional.key, original);
  assert.equal(removed.ok, true);
  const hero = removeReviewedSection(original, "hero", original);
  const footer = removeReviewedSection(original, "footer", original);
  assert.equal(hero.ok, false);
  assert.equal(footer.ok, false);
  const added = addReviewedSection(original, "CTA", original);
  if (added.ok) {
    const second = addReviewedSection(added.plan, "CTA", original);
    const third = second.ok ? addReviewedSection(second.plan, "CTA", original) : second;
    assert.equal(third.ok, false);
  } else {
    assert.equal(added.code, "CARDINALITY");
  }
  const duplicate = addReviewedSection(original, optional.type, original);
  assert.equal(duplicate.ok, false);
  const context = buildWireframeContextFromLandingPageProject(page.draftDocument);
  assert.ok(context);
  if (!context) return;
  const plan = generateWireframePlan(context);
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  const keys = new Set(original.sections.map((section) => section.key));
  assert.equal(keys.size, original.sections.length);
  const badVariant = { ...original, sections: original.sections.map((section) => section.type === "HERO" ? { ...section, variant: "inexistente" } : section) };
  assert.equal(validateReviewedWireframePlan(badVariant, plan.value).ok, false);
  assert.equal(hasActionPath(original.sections.map((section) => section.type)), true);
  const humanReason = original.sections.find((section) => section.type === "TRUST")?.reason ?? WIREFRAME_REASON_TEXT.HIGH_TRUST_NEED;
  assert.equal(humanReason.includes("HIGH_TRUST_NEED"), false);
  assert.equal(reviewedPlanFromEngine(plan.value).sections.map((section) => section.key).join(), original.sections.map((section) => section.key).join());
});

test("aplicar materializa placeholders e a edição estrutural preserva conteúdo", async () => {
  const { store, page } = await readyPage();
  const proposal = proposeWireframeFromDocument(page.draftDocument);
  if (!proposal.ok || !proposal.value.reviewed) return;
  const theme = page.draftDocument.theme.colors.primary;
  const applied = await applyReviewedWireframe(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: page.draftRevision,
    reviewed: proposal.value.reviewed,
    idFactory: () => crypto.randomUUID(),
  });
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.value.status, "READY_TO_PREVIEW");
  assert.notEqual(applied.value.status, "PUBLISHED");
  assert.equal(applied.value.draftRevision, page.draftRevision + 1);
  assert.ok(applied.value.draftDocument.sections.length >= 2);
  assert.ok(applied.value.draftDocument.sections.every((section) => section.contentStatus === "PLACEHOLDER"));
  assert.equal(applied.value.draftDocument.strategy?.wireframe?.planFingerprint, proposal.value.reviewed.planFingerprint);
  assert.equal(applied.value.draftDocument.strategy?.brief?.offer.name, "Móveis planejados sob medida");
  assert.equal(applied.value.draftDocument.strategy?.decisionJourney?.trustNeed, "HIGH");
  assert.equal(applied.value.draftDocument.theme.colors.primary, theme);
  const serialized = JSON.stringify(applied.value.draftDocument.sections);
  assert.equal(/lorem|ipsum|depoimento|98%|garantia|clientes atendidos/i.test(serialized), false);
  assert.equal(serialized.includes(WIREFRAME_PLACEHOLDERS.heroHeadline), true);
  assert.equal(applied.value.draftDocument.strategy?.wireframe?.userModified, false);

  const again = await applyReviewedWireframe(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: applied.value.draftRevision,
    reviewed: proposal.value.reviewed,
  });
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.code, "LANDING_PAGE_WIREFRAME_NOT_EMPTY");

  const stale = await updateLandingPageWireframeStructure(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: 1,
    orderedSectionIds: applied.value.draftDocument.sections.map((section) => section.id),
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, "LANDING_PAGE_DRAFT_CONFLICT");

  const ids = applied.value.draftDocument.sections.map((section) => section.id);
  const first = ids[0];
  const second = ids[1];
  assert.ok(first && second);
  const reordered = await updateLandingPageWireframeStructure(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: applied.value.draftRevision,
    orderedSectionIds: [second, first, ...ids.slice(2)],
  });
  assert.equal(reordered.ok, true);
  if (!reordered.ok) return;
  assert.equal(reordered.value.draftDocument.sections[0]?.id, second);
  assert.equal(reordered.value.draftDocument.sections[1]?.id, first);
  assert.equal(JSON.stringify(reordered.value.draftDocument.sections.find((section) => section.id === first)?.content), JSON.stringify(applied.value.draftDocument.sections.find((section) => section.id === first)?.content));
  assert.equal(reordered.value.status, "READY_TO_PREVIEW");

  const optional = reordered.value.draftDocument.sections.find((section) => section.type !== "HERO" && section.type !== "FOOTER");
  assert.ok(optional);
  if (!optional) return;
  const removed = await updateLandingPageWireframeStructure(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: reordered.value.draftRevision,
    orderedSectionIds: reordered.value.draftDocument.sections.filter((section) => section.id !== optional.id).map((section) => section.id),
  });
  assert.equal(removed.ok, true);
  if (!removed.ok) return;
  assert.equal(removed.value.draftDocument.sections.some((section) => section.id === optional.id), false);

  const added = await updateLandingPageWireframeStructure(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: removed.value.draftRevision,
    orderedSectionIds: removed.value.draftDocument.sections.map((section) => section.id),
    additions: [{ type: optional.type }],
    idFactory: () => crypto.randomUUID(),
  });
  assert.equal(added.ok, true);
  if (!added.ok) return;
  const createdSection = added.value.draftDocument.sections.find((section) => section.type === optional.type);
  assert.equal(createdSection?.contentStatus, "PLACEHOLDER");

  const hero = added.value.draftDocument.sections.find((section) => section.type === "HERO");
  assert.ok(hero);
  if (!hero) return;
  const withoutHero = await updateLandingPageWireframeStructure(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: added.value.draftRevision,
    orderedSectionIds: added.value.draftDocument.sections.filter((section) => section.id !== hero.id).map((section) => section.id),
  });
  assert.equal(withoutHero.ok, false);

  const marked = structuredClone(added.value.draftDocument);
  const target = marked.sections.find((section) => section.type !== "HERO" && section.type !== "FOOTER");
  assert.ok(target);
  if (!target) return;
  target.contentStatus = "APPROVED";
  const saved = await updateLandingPageDraft(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: added.value.draftRevision,
    document: marked,
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.value.status, "READY_TO_PREVIEW");
  const blockedRemove = await updateLandingPageWireframeStructure(store, {
    userId: "user-a",
    landingPageProjectId: page.id,
    expectedRevision: saved.value.draftRevision,
    orderedSectionIds: saved.value.draftDocument.sections.filter((section) => section.id !== target.id).map((section) => section.id),
  });
  assert.equal(blockedRemove.ok, false);
  if (!blockedRemove.ok) assert.equal(blockedRemove.code, "LANDING_PAGE_SECTION_HAS_CONTENT");

  const other = await getLandingPageProject(store, { userId: "user-b", landingPageProjectId: page.id });
  assert.equal(other.ok, false);
  const owner = await getLandingPageProject(store, { userId: "user-a", landingPageProjectId: page.id });
  assert.equal(owner.ok, true);
  if (!owner.ok) return;
  const preview = renderToStaticMarkup(createElement(LandingPageRenderer, { document: owner.value.draftDocument, mode: "PREVIEW" }));
  const publicMarkup = renderToStaticMarkup(createElement(LandingPageRenderer, { document: owner.value.draftDocument, mode: "PUBLIC" }));
  assert.match(preview, /data-placeholder-badge/);
  assert.match(preview, /Conteúdo provisório/);
  assert.equal(publicMarkup.includes("data-placeholder-badge"), false);
  assert.match(preview, /data-section-type="HERO"/);
  assert.match(preview, /data-preview-action="disabled"/);
  assert.match(preview, /aria-disabled="true"/);
  assert.equal(owner.value.status === "PUBLISHED", false);
});

test("a ferramenta explica a estrutura e o preview continua privado", () => {
  const tool = readFileSync("src/components/learning/LandingPageWireframeTool.tsx", "utf8");
  assert.match(tool, /data-wireframe-tool/);
  assert.match(tool, /w-full/);
  assert.match(tool, /min-w-0/);
  assert.match(tool, /sm:flex-row/);
  assert.match(tool, /flex-col/);
  assert.match(tool, /Ver minha página/);
  assert.match(tool, /\/app\/landing-pages\//);
  assert.match(tool, /Preparar estratégia na Aula 4/);
  assert.match(tool, /Planejar jornada na Aula 5/);
  assert.match(tool, /Mover para cima/);
  assert.match(tool, /Mover para baixo/);
  assert.match(tool, /Adicionar seção/);
  assert.match(tool, /Restaurar recomendação original/);
  assert.match(tool, /Aplicar esta estrutura à minha página/);
  assert.equal(/HIGH_TRUST_NEED|FOCUSED|TRUST_HEAVY/.test(tool), false);
  const preview = readFileSync("src/app/(app)/app/landing-pages/[landingPageProjectId]/preview/page.tsx", "utf8");
  assert.match(preview, /requireSession/);
  assert.match(preview, /userId: session\.user\.id/);
  assert.match(preview, /mode="PREVIEW"/);
  assert.equal(preview.includes("ViewEvent"), false);
  assert.equal(preview.includes("track("), false);
  assert.equal(sitesCourseSeed.status, "PUBLISHED");
  const sources = readFileSync("src/lib/landing-page/wireframe/structure.ts", "utf8");
  assert.equal(/openai|anthropic|generateText/i.test(sources), false);
  assert.equal(sources.includes("PUBLISHED"), true);
});
