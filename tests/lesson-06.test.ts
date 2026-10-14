import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { config as loadEnv } from "dotenv";
import { assessLesson } from "../src/lib/editorial/readiness";
import { canReadLessonBody, visibleBlocks } from "../src/lib/learning/access";
import { lessonAnalyticsPayload } from "../src/lib/learning/analytics-events";
import { parseBlockData } from "../src/lib/learning/blocks";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { LESSON_01_SLUG } from "../src/lib/learning/lesson-01";
import { LESSON_02_SLUG } from "../src/lib/learning/lesson-02";
import { LESSON_03_SLUG } from "../src/lib/learning/lesson-03";
import { LESSON_04_SLUG } from "../src/lib/learning/lesson-04";
import { LESSON_05_SLUG } from "../src/lib/learning/lesson-05";
import { LESSON_06_SLUG, lesson06Blocks, lesson06Meta } from "../src/lib/learning/lesson-06";
import { isBlockComplete, isLessonComplete, type ProgressRuleBlock } from "../src/lib/learning/progress";
import { blueprintProjectIdsFrom, blueprintReadiness, parseSearchBlueprintForm, type SearchBlueprintFormInput } from "../src/lib/learning/search-blueprint";

loadEnv({ path: ".env.local" });

const required = [
  "checkpoint-hierarquia-pesquisa",
  "checkpoint-localizacao",
  "checkpoint-foco-otimizacao",
  "checkpoint-grupos-coerentes",
  "blueprint-campanha-pesquisa",
  "checkpoint-final-blueprint",
];
const earlier = [LESSON_01_SLUG, LESSON_02_SLUG, LESSON_03_SLUG, LESSON_04_SLUG, LESSON_05_SLUG];
const laterLessons = [
  "palavras-chave-com-intencao",
  "anuncios-alinhados-a-conversao",
  "objetivo-publico-estrutura",
  "campanhas-leads-whatsapp",
  "leia-os-numeros",
  "o-que-mudar",
];

const group = { name: "Ultrassom Obstétrico", theme: "Exame de ultrassonografia obstétrica", intent: "Pessoas procurando realizar ultrassonografia obstétrica." };

function blueprintInput(projectId: string, patch: Partial<SearchBlueprintFormInput> = {}): SearchBlueprintFormInput {
  return {
    projectId,
    campaignName: "Pesquisa | Ultrassom Obstétrico | Belém",
    offer: "Ultrassonografia obstétrica",
    businessObjective: "LEADS",
    primaryConversion: "Envio concluído do formulário de orçamento.",
    destinationType: "LANDING_PAGE",
    destinationUrl: "https://clinica.example/orcamento",
    locationPlan: "Pessoas em Belém que possam ir até a clínica.",
    languagePlan: "Português",
    monthlyBudget: "600",
    optimizationFocus: "CONVERSIONS",
    brandStrategy: "UNDECIDED",
    searchPartnersDecision: "UNDECIDED",
    adGroups: [group],
    preLaunchIssue: "",
    ...patch,
  };
}

test("aula 6 definitiva tem 34 blocos e passa na validação", () => {
  assert.equal(lesson06Blocks.length, 34);
  assert.equal(new Set(lesson06Blocks.map((block) => block.blockKey)).size, 34);
  assert.deepEqual(lesson06Blocks.map((block) => block.position), lesson06Blocks.map((_, index) => index + 1));
  for (const block of lesson06Blocks) assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  const tools = lesson06Blocks.filter((block) => block.data.type === "TOOL");
  assert.equal(tools.length, 1);
  assert.equal(tools[0]?.data.type === "TOOL" && tools[0].data.toolKey, "SEARCH_CAMPAIGN_BLUEPRINT_V1");
  assert.equal(lesson06Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 5);
  assert.equal(lesson06Blocks.filter((block) => block.data.type === "RESULT").length, 0);
  assert.equal(lesson06Blocks.some((block) => block.data.type === "CONCLUSION"), true);
  assert.equal(lesson06Blocks.filter((block) => block.data.type === "HEADING").every((block) => !block.countsForProgress), true);
  for (const key of required) assert.equal(lesson06Blocks.find((block) => block.blockKey === key)?.required, true);
  assert.equal(lesson06Meta.accessType, "PAID");
  assert.equal(lesson06Meta.priceCents, 3990);
  assert.equal(lesson06Meta.commerceStatus, "NOT_FOR_SALE");
  assert.equal(lesson06Meta.estimatedMinutes, 40);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }), false);
  assert.equal(visibleBlocks({ status: "PUBLISHED", accessType: "PAID" }, lesson06Blocks).length, 0);
  const lessons = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons);
  assert.equal(lessons.filter((lesson) => lesson.slug === LESSON_06_SLUG).length, 1);
  for (const slug of laterLessons) assert.equal(lessons.find((lesson) => lesson.slug === slug)?.blocks.length, 0);
  const moduleTwo = firstCourseSeed.modules.find((moduleRow) => moduleRow.slug === "google-ads-na-pratica");
  assert.equal(moduleTwo?.bundlePriceCents, 10390);
  assert.equal(lessons.find((lesson) => lesson.slug === "palavras-chave-com-intencao")?.priceCents, 3990);
  assert.equal(lessons.find((lesson) => lesson.slug === "anuncios-alinhados-a-conversao")?.priceCents, 3490);
  const ready = assessLesson(
    {
      title: lesson06Meta.title,
      summary: lesson06Meta.summary,
      publicPreview: lesson06Meta.publicPreview,
      estimatedMinutes: lesson06Meta.estimatedMinutes,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: 3990,
      commerceStatus: "NOT_FOR_SALE",
    },
    lesson06Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.deepEqual(ready.issues, []);
  const trafficOnly = assessLesson(
    {
      title: "Paga sem resultado",
      summary: "Resumo",
      publicPreview: "Preview",
      estimatedMinutes: 10,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: 1000,
      commerceStatus: "NOT_FOR_SALE",
    },
    [
      { blockKey: "texto", retiredAt: null, payload: { type: "TEXT", body: "Conteúdo da aula." } },
      { blockKey: "fim", retiredAt: null, payload: { type: "CONCLUSION", body: "Fim." } },
      { blockKey: "ferramenta", retiredAt: null, payload: { type: "TOOL", toolKey: "TRAFFIC_READINESS_V1", title: "Diagnóstico", description: "Abrir." } },
    ],
  );
  assert.equal(trafficOnly.ready, false);
  const pending = parseSearchBlueprintForm({ ...blueprintInput("projeto"), destinationType: "UNDEFINED", monthlyBudget: "", preLaunchIssue: "Não conferi a região.", readinessStatus: "READY_FOR_KEYWORDS" } as never);
  assert.equal(pending.ok, true);
  if (pending.ok) {
    assert.equal(pending.blueprint.readinessStatus, "NEEDS_PREPARATION");
    assert.equal(pending.blueprint.monthlyBudgetCents, undefined);
    assert.equal(blueprintReadiness(pending.blueprint).status, "NEEDS_PREPARATION");
  }
  const readyBlueprint = parseSearchBlueprintForm(blueprintInput("projeto"));
  assert.equal(readyBlueprint.ok, true);
  if (readyBlueprint.ok) {
    assert.equal(readyBlueprint.blueprint.readinessStatus, "READY_FOR_KEYWORDS");
    assert.equal(readyBlueprint.blueprint.monthlyBudgetCents, 60000);
    assert.equal(readyBlueprint.blueprint.dailyBudgetReferenceCents, 2000);
    assert.equal(readyBlueprint.blueprint.brandStrategy, "UNDECIDED");
    assert.equal(readyBlueprint.blueprint.searchPartnersDecision, "UNDECIDED");
    assert.equal(readyBlueprint.blueprint.adGroups[0]?.name, group.name);
  }
  assert.equal(parseSearchBlueprintForm(blueprintInput("projeto", { adGroups: [] })).ok, false);
  assert.equal(parseSearchBlueprintForm(blueprintInput("projeto", { adGroups: Array.from({ length: 7 }, () => group) })).ok, false);
  assert.equal(parseSearchBlueprintForm(blueprintInput("projeto", { campaignName: "a".repeat(121) })).ok, false);
  assert.equal(parseSearchBlueprintForm(blueprintInput("projeto", { locationPlan: "" })).ok, false);
  assert.equal(parseSearchBlueprintForm(blueprintInput("projeto", { destinationUrl: "http://clinica.example" })).ok, false);
  assert.equal(parseSearchBlueprintForm(blueprintInput("projeto", { monthlyBudget: "nao" })).ok, false);
  assert.equal(blueprintProjectIdsFrom([{ projectId: "projeto", payload: { offer: "x" } }]).size, 0);
  assert.equal(blueprintProjectIdsFrom([{ projectId: "projeto", payload: readyBlueprint.ok ? readyBlueprint.blueprint : {} }]).has("projeto"), true);
  const tool = lesson06Blocks.find((block) => block.blockKey === "blueprint-campanha-pesquisa");
  const rule = tool ? ({ ...tool, retiredAt: null } as ProgressRuleBlock) : null;
  assert.ok(rule);
  if (rule) {
    const answer = { viewed: true, response: { projectId: "projeto" } };
    assert.equal(isBlockComplete(rule, answer, false, new Set(["projeto"]), new Set(["projeto"]), new Set()), false);
    assert.equal(isBlockComplete(rule, answer, false, new Set(), new Set(), new Set(["projeto"])), true);
  }
  const source = readFileSync(new URL("../src/components/learning/SearchBlueprintTool.tsx", import.meta.url), "utf8");
  assert.equal(source.includes("trackEvent"), false);
  assert.equal(source.includes("dataLayer"), false);
  const payload = lessonAnalyticsPayload({ lessonSlug: LESSON_06_SLUG, courseSlug: "trafego-pago-na-pratica", accessType: "PAID" });
  assert.deepEqual(Object.keys(payload).sort(), ["access_type", "course_slug", "lesson_slug"]);
  assert.equal(isLessonComplete(lesson06Blocks.map((block) => ({ ...block, retiredAt: null })), {}, false), false);
});

test("seed da aula 6 é idempotente e preserva as outras aulas", async () => {
  const { assertMigrationTargetAllowed } = await import("../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../src/lib/db/prisma");
  const { seedLesson06Content } = await import("../src/lib/learning/seed-lesson-06");
  const prisma = getPrisma();
  const select = { slug: true, title: true, summary: true, priceCents: true, commerceStatus: true, accessType: true } as const;
  const before = (await prisma.lesson.findMany({ where: { slug: { in: [...earlier, ...laterLessons] } }, select })).sort((a, b) => a.slug.localeCompare(b.slug));
  const first = await seedLesson06Content(prisma);
  const second = await seedLesson06Content(prisma);
  assert.equal(first.ready, true);
  assert.equal(first.issues.length, 0);
  assert.equal(second.skipped || second.applied, true);
  assert.equal(second.activeBlocks, 34);
  assert.equal(await prisma.lesson.count({ where: { slug: LESSON_06_SLUG } }), 1);
  const stored = await prisma.lesson.findUniqueOrThrow({
    where: { slug: LESSON_06_SLUG },
    select: { accessType: true, commerceStatus: true, status: true, priceCents: true, estimatedMinutes: true, title: true },
  });
  assert.equal(stored.accessType, "PAID");
  assert.equal(stored.commerceStatus, "NOT_FOR_SALE");
  assert.equal(stored.status, "PUBLISHED");
  assert.equal(stored.priceCents, 3990);
  assert.equal(stored.estimatedMinutes, 40);
  assert.equal(stored.title, lesson06Meta.title);
  const active = await prisma.lessonBlock.findMany({
    where: { lesson: { slug: LESSON_06_SLUG }, retiredAt: null },
    orderBy: { position: "asc" },
    select: { blockKey: true },
  });
  assert.deepEqual(active.map((block) => block.blockKey), lesson06Blocks.map((block) => block.blockKey));
  const after = (await prisma.lesson.findMany({ where: { slug: { in: [...earlier, ...laterLessons] } }, select })).sort((a, b) => a.slug.localeCompare(b.slug));
  assert.deepEqual(after, before);
  for (const slug of laterLessons) {
    assert.equal(await prisma.lessonBlock.count({ where: { lesson: { slug }, retiredAt: null } }), 0);
  }
  const moduleTwo = await prisma.module.findFirstOrThrow({ where: { slug: "google-ads-na-pratica" } });
  assert.equal(moduleTwo.bundlePriceCents, 10390);
  assert.equal(moduleTwo.commerceStatus, "NOT_FOR_SALE");
  assert.equal(await prisma.lesson.count({ where: { commerceStatus: "AVAILABLE", module: { slug: "google-ads-na-pratica" } } }), 0);
});

test("blueprint fica no LessonResult do projeto e pendência ainda conclui a ferramenta", async () => {
  const { assertMigrationTargetAllowed } = await import("../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../src/lib/db/prisma");
  const { searchBlueprintPreviewState, loadSearchBlueprintPanel, saveSearchBlueprintForUser, syncSearchBlueprintProject } = await import("../src/lib/learning/search-campaign");
  const { loadRuleBlocks, loadSnapshot } = await import("../src/lib/learning/state");
  const { DIAGNOSTIC_VERSION } = await import("../src/lib/diagnostic/definition");
  const prisma = getPrisma();
  const stamp = Date.now();
  const owner = await prisma.user.create({
    data: { id: `lesson06-a-${stamp}`, name: "Dono", email: `lesson06-a-${stamp}@example.com`, emailVerified: true, role: "USER", createdAt: new Date(), updatedAt: new Date() },
  });
  const other = await prisma.user.create({
    data: { id: `lesson06-b-${stamp}`, name: "Outro", email: `lesson06-b-${stamp}@example.com`, emailVerified: true, role: "USER", createdAt: new Date(), updatedAt: new Date() },
  });
  try {
    const lesson = await prisma.lesson.findUniqueOrThrow({ where: { slug: LESSON_06_SLUG }, select: { id: true } });
    const lessonFour = await prisma.lesson.findUniqueOrThrow({ where: { slug: LESSON_04_SLUG }, select: { id: true } });
    const lessonFive = await prisma.lesson.findUniqueOrThrow({ where: { slug: LESSON_05_SLUG }, select: { id: true } });
    const order = await prisma.order.create({
      data: { userId: owner.id, status: "PAID", subtotalCents: 3990, creditCents: 0, totalCents: 3990 },
    });
    const item = await prisma.orderItem.create({
      data: { orderId: order.id, productType: "LESSON", lessonId: lesson.id, titleSnapshot: "Aula 6", listPriceCents: 3990, creditAppliedCents: 0, finalPriceCents: 3990 },
    });
    await prisma.entitlement.create({ data: { userId: owner.id, lessonId: lesson.id, orderItemId: item.id, status: "ACTIVE" } });
    const clinic = await prisma.project.create({
      data: { userId: owner.id, name: "Clínica", status: "ACTIVE", destinationType: "WHATSAPP", websiteUrl: "https://clinica.example", serviceArea: "Belém" },
    });
    const store = await prisma.project.create({ data: { userId: owner.id, name: "Loja", status: "ACTIVE" } });
    const remote = await prisma.project.create({ data: { userId: owner.id, name: "Remoto", status: "ACTIVE" } });
    const archived = await prisma.project.create({ data: { userId: owner.id, name: "Antiga", status: "ARCHIVED", archivedAt: new Date() } });
    const foreign = await prisma.project.create({ data: { userId: other.id, name: "Outra empresa", status: "ACTIVE" } });
    await prisma.lessonResult.create({
      data: {
        userId: owner.id,
        lessonId: lessonFour.id,
        projectId: clinic.id,
        payload: {
          offer: "Ultrassonografia obstétrica",
          objective: "LEADS",
          primaryConversion: "Formulário do brief.",
          destination: "WEBSITE",
          monthlyBudgetCents: 60000,
          dailyBudgetReferenceCents: 2000,
          initialObservationDays: 14,
          validationBeforeLaunch: "Conferir o formulário.",
        },
      },
    });
    await prisma.lessonResult.create({
      data: {
        userId: owner.id,
        lessonId: lessonFive.id,
        projectId: clinic.id,
        payload: {
          destinationType: "LANDING_PAGE",
          destinationUrl: "https://clinica.example/orcamento",
          primaryCta: "Solicitar orçamento",
          primaryConversion: "Envio concluído do formulário de orçamento.",
          destinationChecks: { offerIsClear: true, ctaIsVisible: true, mobileChecked: true, conversionPathTested: true },
          trafficSourceMethod: "PLATFORM",
          platformConversionStatus: "CONFIGURED",
          analyticsStatus: "NOT_CONFIGURED",
          businessOutcomeMethod: "SPREADSHEET",
          readinessStatus: "READY_TO_CONFIGURE",
        },
      },
    });
    await prisma.lessonResult.create({
      data: {
        userId: owner.id,
        lessonId: lessonFive.id,
        projectId: remote.id,
        payload: {
          destinationType: "WHATSAPP",
          primaryCta: "Agendar",
          primaryConversion: "Conversa iniciada.",
          destinationChecks: { offerIsClear: false, ctaIsVisible: true, mobileChecked: false, conversionPathTested: false },
          trafficSourceMethod: "ASK_AT_SERVICE",
          platformConversionStatus: "NOT_CONFIGURED",
          analyticsStatus: "NOT_APPLICABLE",
          businessOutcomeMethod: "NONE",
          readinessStatus: "NEEDS_PREPARATION",
        },
      },
    });
    const snapshot = {
      version: DIAGNOSTIC_VERSION,
      overallScore: 70,
      band: "base",
      bandLabel: "Base",
      dimensionScores: { OBJECTIVE: 70, OFFER: 70, AUDIENCE: 70, DESTINATION: 70, MEASUREMENT: 70, OPERATIONS: 70 },
      primaryBottleneck: null,
      strengths: [],
      attention: [],
      channelExplanation: "Indicação inicial.",
      nextStepTitle: "Canal",
      nextStepDescription: "Seguir.",
      recommendationType: "LEARN",
      recommendationPriority: "MEDIUM",
      lessonSlug: null,
    };
    await prisma.diagnostic.create({
      data: { projectId: clinic.id, userId: owner.id, version: DIAGNOSTIC_VERSION, status: "COMPLETED", answers: {}, completedAt: new Date(), resultSnapshot: { ...snapshot, channelHint: "google" } },
    });
    await prisma.diagnostic.create({
      data: { projectId: remote.id, userId: owner.id, version: DIAGNOSTIC_VERSION, status: "COMPLETED", answers: {}, completedAt: new Date(), resultSnapshot: { ...snapshot, channelHint: "meta" } },
    });
    const rules = await loadRuleBlocks(lesson.id);
    assert.equal(searchBlueprintPreviewState().mode, "preview");
    assert.equal(await prisma.lessonResult.count({ where: { userId: owner.id, lessonId: lesson.id } }), 0);
    const locked = await saveSearchBlueprintForUser(other.id, LESSON_06_SLUG, "blueprint-campanha-pesquisa", blueprintInput(clinic.id));
    assert.equal(locked.ok, false);
    assert.equal(await prisma.lessonResult.count({ where: { userId: owner.id, lessonId: lesson.id } }), 0);
    const panel = await loadSearchBlueprintPanel({ userId: owner.id, blocks: rules });
    assert.equal(panel?.mode, "live");
    if (panel?.mode !== "live") return;
    assert.equal(panel.chooseProject, true);
    const clinicChoice = panel.projects.find((item) => item.id === clinic.id);
    const storeChoice = panel.projects.find((item) => item.id === store.id);
    const remoteChoice = panel.projects.find((item) => item.id === remote.id);
    assert.equal(clinicChoice?.hasBrief, true);
    assert.equal(clinicChoice?.hasDestinationPlan, true);
    assert.equal(clinicChoice?.prefill.offer, "Ultrassonografia obstétrica");
    assert.equal(clinicChoice?.prefill.primaryConversion, "Envio concluído do formulário de orçamento.");
    assert.equal(clinicChoice?.prefill.destinationType, "LANDING_PAGE");
    assert.equal(clinicChoice?.prefill.destinationUrl, "https://clinica.example/orcamento");
    assert.equal(clinicChoice?.prefill.monthlyBudget, "600");
    assert.equal(clinicChoice?.prefill.locationPlan, "Belém");
    assert.equal(clinicChoice?.conversionSignalReady, true);
    assert.equal(clinicChoice?.channelHint, "google");
    assert.equal(storeChoice?.hasBrief, false);
    assert.equal(storeChoice?.hasDestinationPlan, false);
    assert.equal(storeChoice?.channelHint, null);
    assert.equal(remoteChoice?.destinationNeedsPreparation, true);
    assert.equal(remoteChoice?.channelHint, "meta");
    assert.equal((await saveSearchBlueprintForUser(owner.id, LESSON_06_SLUG, "blueprint-campanha-pesquisa", blueprintInput(foreign.id))).ok, false);
    assert.equal((await saveSearchBlueprintForUser(owner.id, LESSON_06_SLUG, "blueprint-campanha-pesquisa", blueprintInput(archived.id))).ok, false);

    const meta = await saveSearchBlueprintForUser(owner.id, LESSON_06_SLUG, "blueprint-campanha-pesquisa", {
      ...blueprintInput(remote.id),
      destinationType: "WHATSAPP",
      destinationUrl: "",
      preLaunchIssue: "Ainda não testei o caminho.",
    });
    assert.equal(meta.ok, true);
    const remoteResult = await prisma.lessonResult.findFirstOrThrow({ where: { userId: owner.id, lessonId: lesson.id, projectId: remote.id } });
    assert.equal((remoteResult.payload as { readinessStatus: string }).readinessStatus, "NEEDS_PREPARATION");
    const remoteProject = await prisma.project.findUniqueOrThrow({ where: { id: remote.id } });
    assert.equal(remoteProject.destinationType, null);
    const syncedRemote = await syncSearchBlueprintProject(owner.id, LESSON_06_SLUG, remote.id);
    assert.equal(syncedRemote.ok, true);
    const remoteAfter = await prisma.project.findUniqueOrThrow({ where: { id: remote.id } });
    assert.equal(remoteAfter.destinationType, "WHATSAPP");
    assert.equal(remoteAfter.websiteUrl, null);

    const saved = await saveSearchBlueprintForUser(owner.id, LESSON_06_SLUG, "blueprint-campanha-pesquisa", blueprintInput(clinic.id));
    assert.equal(saved.ok, true);
    const clinicBefore = await prisma.project.findUniqueOrThrow({ where: { id: clinic.id } });
    assert.equal(clinicBefore.destinationType, "WHATSAPP");
    assert.equal(clinicBefore.primaryOffer, null);
    const edited = await saveSearchBlueprintForUser(owner.id, LESSON_06_SLUG, "blueprint-campanha-pesquisa", {
      ...blueprintInput(clinic.id),
      adGroups: [group, { name: "Morfológico", theme: "Ultrassonografia morfológica", intent: "Pessoas procurando especificamente exame morfológico." }],
    });
    assert.equal(edited.ok, true);
    assert.equal(await prisma.lessonResult.count({ where: { userId: owner.id, lessonId: lesson.id, projectId: clinic.id } }), 1);
    const clinicResult = await prisma.lessonResult.findFirstOrThrow({ where: { userId: owner.id, lessonId: lesson.id, projectId: clinic.id } });
    const payload = clinicResult.payload as { readinessStatus: string; adGroups: unknown[]; monthlyBudgetCents: number };
    assert.equal(payload.readinessStatus, "READY_FOR_KEYWORDS");
    assert.equal(payload.adGroups.length, 2);
    assert.equal(payload.monthlyBudgetCents, 60000);
    const synced = await syncSearchBlueprintProject(owner.id, LESSON_06_SLUG, clinic.id);
    assert.equal(synced.ok, true);
    const clinicAfter = await prisma.project.findUniqueOrThrow({ where: { id: clinic.id } });
    assert.equal(clinicAfter.destinationType, "LANDING_PAGE");
    assert.equal(clinicAfter.websiteUrl, "https://clinica.example/orcamento");
    assert.equal(clinicAfter.primaryOffer, "Ultrassonografia obstétrica");
    assert.equal(clinicAfter.objective, "LEADS");
    assert.equal(clinicAfter.monthlyMediaBudgetCents, 60000);
    assert.equal(clinicAfter.serviceArea, "Pessoas em Belém que possam ir até a clínica.");
    const response = await prisma.lessonResponse.findUniqueOrThrow({
      where: { userId_lessonId_blockKey: { userId: owner.id, lessonId: lesson.id, blockKey: "blueprint-campanha-pesquisa" } },
    });
    assert.deepEqual(response.payload, { projectId: clinic.id });
    const reloaded = await loadSearchBlueprintPanel({ userId: owner.id, blocks: rules });
    const reloadedClinic = reloaded?.mode === "live" ? reloaded.projects.find((item) => item.id === clinic.id) : null;
    assert.equal(reloadedClinic?.blueprint?.adGroups.length, 2);
    const snapshotAfter = await loadSnapshot(owner.id, lesson.id, rules);
    assert.equal(snapshotAfter.completedBlockKeys.includes("blueprint-campanha-pesquisa"), true);
    assert.equal(await prisma.lesson.count({ where: { commerceStatus: "AVAILABLE" } }), 0);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
  }
});
