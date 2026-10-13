import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { config as loadEnv } from "dotenv";
import { assessLesson } from "../src/lib/editorial/readiness";
import { canReadLessonBody, visibleBlocks } from "../src/lib/learning/access";
import { lessonAnalyticsPayload } from "../src/lib/learning/analytics-events";
import { parseBlockData } from "../src/lib/learning/blocks";
import { destinationReadiness, destinationUrlError, nextLessonSlugs, parseDestinationPlanForm, planProjectIdsFrom } from "../src/lib/learning/destination-plan";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { LESSON_01_SLUG, lesson01Blocks } from "../src/lib/learning/lesson-01";
import { LESSON_02_SLUG, lesson02Blocks } from "../src/lib/learning/lesson-02";
import { LESSON_03_SLUG, lesson03Blocks } from "../src/lib/learning/lesson-03";
import { LESSON_04_SLUG, lesson04Blocks } from "../src/lib/learning/lesson-04";
import { LESSON_05_SLUG, lesson05Blocks, lesson05Meta } from "../src/lib/learning/lesson-05";
import { isLessonComplete, type ProgressRuleBlock } from "../src/lib/learning/progress";

loadEnv({ path: ".env.local" });

const required = [
  "checkpoint-destino-coerente",
  "checkpoint-clique-vs-resultado",
  "checkpoint-tres-camadas",
  "plano-destino-mensuracao",
  "checkpoint-final-mensuracao",
];
const laterLessons = [
  "campanha-de-pesquisa",
  "palavras-chave-com-intencao",
  "anuncios-alinhados-a-conversao",
  "objetivo-publico-estrutura",
  "campanhas-leads-whatsapp",
  "leia-os-numeros",
  "o-que-mudar",
];

test("aula 5 definitiva tem 32 blocos e passa na validação", () => {
  assert.equal(lesson05Blocks.length, 32);
  assert.equal(new Set(lesson05Blocks.map((block) => block.blockKey)).size, 32);
  assert.deepEqual(
    lesson05Blocks.map((block) => block.position),
    lesson05Blocks.map((_, index) => index + 1),
  );
  for (const block of lesson05Blocks) assert.equal(parseBlockData(block.data)?.type, block.data.type, block.blockKey);
  const tools = lesson05Blocks.filter((block) => block.data.type === "TOOL");
  assert.equal(tools.length, 1);
  assert.equal(tools[0]?.data.type === "TOOL" && tools[0].data.toolKey, "DESTINATION_MEASUREMENT_PLAN_V1");
  assert.equal(lesson05Blocks.filter((block) => block.data.type === "CHECKPOINT").length, 4);
  assert.equal(lesson05Blocks.filter((block) => block.data.type === "RESULT").length, 0);
  assert.equal(lesson05Blocks.some((block) => block.data.type === "CONCLUSION"), true);
  assert.equal(lesson05Blocks.filter((block) => block.data.type === "HEADING").every((block) => !block.countsForProgress), true);
  const checklist = lesson05Blocks.find((block) => block.data.type === "CHECKLIST");
  assert.equal(checklist?.countsForProgress, false);
  assert.equal(checklist?.required, false);
  for (const key of required) assert.equal(lesson05Blocks.find((block) => block.blockKey === key)?.required, true);
  assert.equal(lesson05Meta.accessType, "PAID");
  assert.equal(lesson05Meta.priceCents, 3490);
  assert.equal(lesson05Meta.commerceStatus, "NOT_FOR_SALE");
  assert.equal(lesson05Meta.estimatedMinutes, 35);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }), false);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }, { entitled: true }), true);
  assert.equal(visibleBlocks({ status: "PUBLISHED", accessType: "PAID" }, lesson05Blocks).length, 0);
  const lessons = firstCourseSeed.modules.flatMap((moduleRow) => moduleRow.lessons);
  assert.equal(lessons.filter((lesson) => lesson.slug === LESSON_05_SLUG).length, 1);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_01_SLUG)?.blocks.length, lesson01Blocks.length);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_02_SLUG)?.blocks.length, lesson02Blocks.length);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_03_SLUG)?.blocks.length, lesson03Blocks.length);
  assert.equal(lessons.find((lesson) => lesson.slug === LESSON_04_SLUG)?.blocks.length, lesson04Blocks.length);
  for (const slug of laterLessons) assert.equal(lessons.find((lesson) => lesson.slug === slug)?.blocks.length, 0);
  const moduleOne = firstCourseSeed.modules.find((moduleRow) => moduleRow.slug === "planeje-antes-de-anunciar");
  assert.equal(moduleOne?.bundlePriceCents, 5790);
  const ready = assessLesson(
    {
      title: lesson05Meta.title,
      summary: lesson05Meta.summary,
      publicPreview: lesson05Meta.publicPreview,
      estimatedMinutes: lesson05Meta.estimatedMinutes,
      accessType: "PAID",
      status: "PUBLISHED",
      priceCents: 3490,
      commerceStatus: "NOT_FOR_SALE",
    },
    lesson05Blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data })),
  );
  assert.deepEqual(ready.issues, []);
  assert.equal(ready.ready, true);
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
  assert.equal(destinationUrlError("LANDING_PAGE", "javascript:alert(1)"), "Esse endereço não pode ser usado.");
  assert.equal(destinationUrlError("WEBSITE", "http://clinica.example"), "Use um endereço que comece com https://.");
  assert.equal(destinationUrlError("WEBSITE", ""), "Informe o endereço HTTPS do destino.");
  assert.equal(destinationUrlError("WHATSAPP", ""), null);
  assert.equal(destinationUrlError("LANDING_PAGE", "https://clinica.example/?email=a@b.com"), "Não coloque e-mail ou dados pessoais no endereço.");
  const pending = parseDestinationPlanForm({ ...planInput("projeto"), offerIsClear: false, businessOutcomeMethod: "NONE", preLaunchIssue: "Não testei o formulário.", readinessStatus: "READY_TO_CONFIGURE" } as never);
  assert.equal(pending.ok, true);
  if (pending.ok) {
    assert.equal(pending.plan.readinessStatus, "NEEDS_PREPARATION");
    assert.equal(destinationReadiness(pending.plan).issues.includes("O resultado comercial ainda não é registrado."), true);
  }
  const readyPlan = parseDestinationPlanForm(planInput("projeto"));
  assert.equal(readyPlan.ok && readyPlan.plan.readinessStatus, "READY_TO_CONFIGURE");
  assert.equal(parseDestinationPlanForm({ ...planInput("projeto"), primaryCta: "a".repeat(121) }).ok, false);
  assert.equal(parseDestinationPlanForm({ ...planInput("projeto"), primaryConversion: "a".repeat(201) }).ok, false);
  assert.equal(planProjectIdsFrom([{ projectId: "projeto", payload: { offer: "brief" } }]).size, 0);
  assert.equal(planProjectIdsFrom([{ projectId: "projeto", payload: readyPlan.ok ? readyPlan.plan : {} }]).has("projeto"), true);
  assert.deepEqual(nextLessonSlugs("google"), ["campanha-de-pesquisa"]);
  assert.deepEqual(nextLessonSlugs("meta"), ["objetivo-publico-estrutura"]);
  assert.deepEqual(nextLessonSlugs("both"), ["campanha-de-pesquisa", "objetivo-publico-estrutura"]);
  assert.deepEqual(nextLessonSlugs("none"), []);
  assert.deepEqual(nextLessonSlugs(null), []);
  const payload = lessonAnalyticsPayload({ lessonSlug: LESSON_05_SLUG, courseSlug: "trafego-pago-na-pratica", accessType: "PAID" });
  assert.deepEqual(Object.keys(payload).sort(), ["access_type", "course_slug", "lesson_slug"]);
  const source = readFileSync(new URL("../src/components/learning/DestinationPlanTool.tsx", import.meta.url), "utf8");
  assert.equal(source.includes("trackEvent"), false);
  assert.equal(source.includes("dataLayer"), false);
  const rules: ProgressRuleBlock[] = lesson05Blocks.map((block) => ({ ...block, retiredAt: null }));
  const answers = Object.fromEntries(
    lesson05Blocks.map((block) => {
      if (block.data.type === "CHECKPOINT") return [block.blockKey, { viewed: true, response: { optionId: block.data.correctOptionId } }];
      if (block.data.type === "TOOL") return [block.blockKey, { viewed: true, response: { projectId: "projeto-1" } }];
      return [block.blockKey, { viewed: true }];
    }),
  );
  assert.equal(isLessonComplete(rules, answers, false, new Set(["projeto-1"]), new Set()), false);
  assert.equal(isLessonComplete(rules, { "plano-destino-mensuracao": { viewed: true, response: { projectId: "projeto-1" } } }, false, new Set(), new Set(["projeto-1"])), false);
  assert.equal(isLessonComplete(rules, answers, false, new Set(), new Set(["projeto-1"])), true);
});

test("seed da aula 5 é idempotente e preserva as outras aulas", async () => {
  const { assertMigrationTargetAllowed } = await import("../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../src/lib/db/prisma");
  const { seedLesson05Content } = await import("../src/lib/learning/seed-lesson-05");
  const prisma = getPrisma();
  const untouched = [LESSON_01_SLUG, LESSON_02_SLUG, LESSON_03_SLUG, LESSON_04_SLUG, ...laterLessons];
  const select = { slug: true, title: true, summary: true, priceCents: true, commerceStatus: true, accessType: true, publicPreview: true } as const;
  const before = (await prisma.lesson.findMany({ where: { slug: { in: untouched } }, select })).sort((a, b) => a.slug.localeCompare(b.slug));
  const first = await seedLesson05Content(prisma);
  const second = await seedLesson05Content(prisma);
  assert.equal(first.ready, true);
  assert.equal(first.issues.length, 0);
  assert.equal(second.skipped || second.applied, true);
  assert.equal(second.activeBlocks, 32);
  assert.equal(await prisma.lesson.count({ where: { slug: LESSON_05_SLUG } }), 1);
  const stored = await prisma.lesson.findUniqueOrThrow({
    where: { slug: LESSON_05_SLUG },
    select: { accessType: true, commerceStatus: true, status: true, priceCents: true, estimatedMinutes: true, title: true },
  });
  assert.equal(stored.accessType, "PAID");
  assert.equal(stored.commerceStatus, "NOT_FOR_SALE");
  assert.equal(stored.status, "PUBLISHED");
  assert.equal(stored.priceCents, 3490);
  assert.equal(stored.estimatedMinutes, 35);
  assert.equal(stored.title, lesson05Meta.title);
  const active = await prisma.lessonBlock.findMany({
    where: { lesson: { slug: LESSON_05_SLUG }, retiredAt: null },
    orderBy: { position: "asc" },
    select: { blockKey: true },
  });
  assert.deepEqual(active.map((block) => block.blockKey), lesson05Blocks.map((block) => block.blockKey));
  const after = (await prisma.lesson.findMany({ where: { slug: { in: untouched } }, select })).sort((a, b) => a.slug.localeCompare(b.slug));
  assert.deepEqual(after, before);
  for (const slug of laterLessons) {
    assert.equal(await prisma.lessonBlock.count({ where: { lesson: { slug }, retiredAt: null } }), 0);
  }
  const moduleOne = await prisma.module.findFirstOrThrow({ where: { slug: "planeje-antes-de-anunciar" } });
  assert.equal(moduleOne.bundlePriceCents, 5790);
  assert.equal(moduleOne.commerceStatus, "NOT_FOR_SALE");
  const lessonFour = await prisma.lesson.findUniqueOrThrow({ where: { slug: LESSON_04_SLUG }, select: { priceCents: true, commerceStatus: true } });
  assert.equal(lessonFour.priceCents, 2990);
  assert.equal(lessonFour.commerceStatus, "NOT_FOR_SALE");
  assert.equal(await prisma.lesson.count({ where: { commerceStatus: "AVAILABLE", module: { slug: "planeje-antes-de-anunciar" } } }), 0);
});

test("plano fica no LessonResult do projeto e pendência ainda conclui a ferramenta", async () => {
  const { assertMigrationTargetAllowed } = await import("../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../src/lib/db/prisma");
  const { destinationPlanPreviewState, loadDestinationPlanPanel, saveDestinationPlanForUser, syncDestinationPlanProject, addDestinationPreparationTask } = await import("../src/lib/learning/measurement");
  const { loadRuleBlocks, loadSnapshot } = await import("../src/lib/learning/state");
  const { DIAGNOSTIC_VERSION } = await import("../src/lib/diagnostic/definition");
  const prisma = getPrisma();
  const stamp = Date.now();
  const owner = await prisma.user.create({
    data: { id: `lesson05-a-${stamp}`, name: "Dono", email: `lesson05-a-${stamp}@example.com`, emailVerified: true, role: "USER", createdAt: new Date(), updatedAt: new Date() },
  });
  const other = await prisma.user.create({
    data: { id: `lesson05-b-${stamp}`, name: "Outro", email: `lesson05-b-${stamp}@example.com`, emailVerified: true, role: "USER", createdAt: new Date(), updatedAt: new Date() },
  });
  try {
    const lesson = await prisma.lesson.findUniqueOrThrow({ where: { slug: LESSON_05_SLUG }, select: { id: true } });
    const lessonFour = await prisma.lesson.findUniqueOrThrow({ where: { slug: LESSON_04_SLUG }, select: { id: true } });
    const order = await prisma.order.create({
      data: { userId: owner.id, status: "PAID", subtotalCents: 3490, creditCents: 0, totalCents: 3490 },
    });
    const item = await prisma.orderItem.create({
      data: { orderId: order.id, productType: "LESSON", lessonId: lesson.id, titleSnapshot: "Aula 5", listPriceCents: 3490, creditAppliedCents: 0, finalPriceCents: 3490 },
    });
    await prisma.entitlement.create({ data: { userId: owner.id, lessonId: lesson.id, orderItemId: item.id, status: "ACTIVE" } });
    const clinic = await prisma.project.create({
      data: {
        userId: owner.id,
        name: "Clínica",
        status: "ACTIVE",
        destinationType: "WHATSAPP",
        websiteUrl: "https://clinica.example",
      },
    });
    const store = await prisma.project.create({ data: { userId: owner.id, name: "Loja", status: "ACTIVE" } });
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
          primaryConversion: "Envio concluído do formulário de orçamento.",
          destination: "LANDING_PAGE",
          monthlyBudgetCents: 60000,
          dailyBudgetReferenceCents: 2000,
          initialObservationDays: 14,
          validationBeforeLaunch: "Conferir o formulário.",
        },
      },
    });
    await prisma.diagnostic.create({
      data: {
        projectId: clinic.id,
        userId: owner.id,
        version: DIAGNOSTIC_VERSION,
        status: "COMPLETED",
        answers: {},
        completedAt: new Date(),
        resultSnapshot: {
          version: DIAGNOSTIC_VERSION,
          overallScore: 70,
          band: "base",
          bandLabel: "Base",
          dimensionScores: { OBJECTIVE: 70, OFFER: 70, AUDIENCE: 70, DESTINATION: 70, MEASUREMENT: 70, OPERATIONS: 70 },
          primaryBottleneck: null,
          strengths: [],
          attention: [],
          channelHint: "google",
          channelExplanation: "Indicação inicial: Pesquisa.",
          nextStepTitle: "Pesquisa",
          nextStepDescription: "Seguir para a campanha de Pesquisa.",
          recommendationType: "LEARN",
          recommendationPriority: "MEDIUM",
          lessonSlug: "campanha-de-pesquisa",
        },
      },
    });
    const rules = await loadRuleBlocks(lesson.id);
    assert.equal(destinationPlanPreviewState().mode, "preview");
    assert.equal(await prisma.lessonResult.count({ where: { userId: owner.id, lessonId: lesson.id } }), 0);
    const locked = await saveDestinationPlanForUser(other.id, LESSON_05_SLUG, "plano-destino-mensuracao", planInput(clinic.id));
    assert.equal(locked.ok, false);
    const panel = await loadDestinationPlanPanel({ userId: owner.id, blocks: rules });
    assert.equal(panel?.mode, "live");
    if (panel?.mode !== "live") return;
    assert.equal(panel.chooseProject, true);
    assert.deepEqual(panel.projects.map((item) => item.name), ["Clínica", "Loja"]);
    const clinicChoice = panel.projects.find((item) => item.id === clinic.id);
    const storeChoice = panel.projects.find((item) => item.id === store.id);
    assert.equal(clinicChoice?.prefill.destinationType, "LANDING_PAGE");
    assert.equal(clinicChoice?.prefill.destinationUrl, "https://clinica.example");
    assert.equal(clinicChoice?.prefill.primaryConversion, "Envio concluído do formulário de orçamento.");
    assert.equal(clinicChoice?.brief?.monthlyBudgetCents, 60000);
    assert.equal(clinicChoice?.channelHint, "google");
    assert.equal(storeChoice?.brief, null);
    assert.equal(panel.nextLessons.some((item) => item.slug === "campanha-de-pesquisa"), true);

    assert.equal((await saveDestinationPlanForUser(owner.id, LESSON_05_SLUG, "plano-destino-mensuracao", planInput(foreign.id))).ok, false);
    assert.equal((await saveDestinationPlanForUser(owner.id, LESSON_05_SLUG, "plano-destino-mensuracao", planInput(archived.id))).ok, false);
    assert.equal((await saveDestinationPlanForUser(owner.id, LESSON_05_SLUG, "plano-destino-mensuracao", { ...planInput(clinic.id), destinationUrl: "http://clinica.example" })).ok, false);

    const whatsapp = await saveDestinationPlanForUser(owner.id, LESSON_05_SLUG, "plano-destino-mensuracao", {
      ...planInput(store.id),
      destinationType: "WHATSAPP",
      destinationUrl: "",
      offerIsClear: false,
      businessOutcomeMethod: "NONE",
    });
    assert.equal(whatsapp.ok, true);
    const storeBefore = await prisma.project.findUniqueOrThrow({ where: { id: store.id } });
    assert.equal(storeBefore.destinationType, null);
    const syncedStore = await syncDestinationPlanProject(owner.id, LESSON_05_SLUG, store.id);
    assert.equal(syncedStore.ok, true);
    const storeAfter = await prisma.project.findUniqueOrThrow({ where: { id: store.id } });
    assert.equal(storeAfter.destinationType, "WHATSAPP");
    assert.equal(storeAfter.websiteUrl, null);

    const pending = await saveDestinationPlanForUser(owner.id, LESSON_05_SLUG, "plano-destino-mensuracao", {
      ...planInput(clinic.id),
      offerIsClear: false,
      ctaIsVisible: false,
      mobileChecked: false,
      conversionPathTested: false,
      businessOutcomeMethod: "NONE",
      preLaunchIssue: "Não testei o formulário.",
      platformConversionStatus: "NOT_CONFIGURED",
      analyticsStatus: "NOT_CONFIGURED",
    });
    assert.equal(pending.ok, true);
    const clinicProject = await prisma.project.findUniqueOrThrow({ where: { id: clinic.id } });
    assert.equal(clinicProject.destinationType, "WHATSAPP");
    assert.equal(clinicProject.websiteUrl, "https://clinica.example");
    const clinicResult = await prisma.lessonResult.findFirstOrThrow({ where: { userId: owner.id, lessonId: lesson.id, projectId: clinic.id } });
    const pendingPayload = clinicResult.payload as { readinessStatus: string };
    assert.equal(pendingPayload.readinessStatus, "NEEDS_PREPARATION");
    const task = await addDestinationPreparationTask(owner.id, LESSON_05_SLUG, clinic.id);
    assert.equal(task.ok, true);
    const again = await addDestinationPreparationTask(owner.id, LESSON_05_SLUG, clinic.id);
    assert.equal(again.ok && again.already, true);
    assert.equal(await prisma.task.count({ where: { projectId: clinic.id, sourceType: "LESSON", title: "Corrigir destino e mensuração antes da campanha" } }), 1);

    const ready = await saveDestinationPlanForUser(owner.id, LESSON_05_SLUG, "plano-destino-mensuracao", {
      ...planInput(clinic.id),
      destinationUrl: "https://clinica.example/orcamento",
      platformConversionStatus: "NOT_CONFIGURED",
      analyticsStatus: "NOT_CONFIGURED",
    });
    assert.equal(ready.ok, true);
    assert.equal(await prisma.lessonResult.count({ where: { userId: owner.id, lessonId: lesson.id, projectId: clinic.id } }), 1);
    assert.equal(await prisma.lessonResult.count({ where: { userId: owner.id, lessonId: lesson.id } }), 2);
    const readyRow = await prisma.lessonResult.findFirstOrThrow({ where: { userId: owner.id, lessonId: lesson.id, projectId: clinic.id } });
    const readyPayload = readyRow.payload as { readinessStatus: string; destinationUrl: string; primaryCta: string };
    assert.equal(readyPayload.readinessStatus, "READY_TO_CONFIGURE");
    assert.equal(readyPayload.destinationUrl, "https://clinica.example/orcamento");
    assert.equal(readyPayload.primaryCta, "Solicitar orçamento");
    const stillOld = await prisma.project.findUniqueOrThrow({ where: { id: clinic.id } });
    assert.equal(stillOld.destinationType, "WHATSAPP");
    const synced = await syncDestinationPlanProject(owner.id, LESSON_05_SLUG, clinic.id);
    assert.equal(synced.ok, true);
    const updated = await prisma.project.findUniqueOrThrow({ where: { id: clinic.id } });
    assert.equal(updated.destinationType, "LANDING_PAGE");
    assert.equal(updated.websiteUrl, "https://clinica.example/orcamento");
    const refused = await addDestinationPreparationTask(owner.id, LESSON_05_SLUG, clinic.id);
    assert.equal(refused.ok, false);

    const snapshot = await loadSnapshot(owner.id, lesson.id, rules);
    assert.equal(snapshot.completedBlockKeys.includes("plano-destino-mensuracao"), true);
    const reloaded = await loadDestinationPlanPanel({ userId: owner.id, blocks: rules });
    const reloadedPlan = reloaded?.mode === "live" ? reloaded.projects.find((item) => item.id === clinic.id)?.plan : null;
    assert.equal(reloadedPlan?.primaryConversion, "Envio concluído do formulário de orçamento.");
    assert.equal(reloaded?.mode === "live" && reloaded.linkedProjectId, clinic.id);
    const response = await prisma.lessonResponse.findUniqueOrThrow({
      where: { userId_lessonId_blockKey: { userId: owner.id, lessonId: lesson.id, blockKey: "plano-destino-mensuracao" } },
    });
    assert.deepEqual(response.payload, { projectId: clinic.id });
  } finally {
    await prisma.user.delete({ where: { id: owner.id } });
    await prisma.user.delete({ where: { id: other.id } });
  }
});

function planInput(projectId: string) {
  return {
    projectId,
    destinationType: "LANDING_PAGE",
    destinationUrl: "https://clinica.example",
    primaryCta: "Solicitar orçamento",
    primaryConversion: "Envio concluído do formulário de orçamento.",
    offerIsClear: true,
    ctaIsVisible: true,
    mobileChecked: true,
    conversionPathTested: true,
    trafficSourceMethod: "UTM",
    platformConversionStatus: "NOT_APPLICABLE",
    analyticsStatus: "NOT_APPLICABLE",
    businessOutcomeMethod: "CRM",
    preLaunchIssue: "",
  };
}
