import assert from "node:assert/strict";
import test from "node:test";
import { config as loadEnv } from "dotenv";

import { dailyBudgetReferenceCents } from "../../src/lib/learning/campaign-brief";

import { LESSON_01_SLUG } from "../../src/lib/learning/lesson-01";
import { LESSON_02_SLUG } from "../../src/lib/learning/lesson-02";
import { LESSON_03_SLUG } from "../../src/lib/learning/lesson-03";
import { LESSON_04_SLUG, lesson04Blocks, lesson04Meta } from "../../src/lib/learning/lesson-04";

loadEnv({ path: ".env.local" });

test("seed da aula 4 é idempotente e preserva as outras aulas", async () => {
  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { seedLesson04Content } = await import("../../src/lib/learning/seed-lesson-04");
  const prisma = getPrisma();
  const untouched = [LESSON_01_SLUG, LESSON_02_SLUG, LESSON_03_SLUG, "palavras-chave-com-intencao", "anuncios-alinhados-a-conversao"];
  const select = { slug: true, title: true, summary: true, priceCents: true, commerceStatus: true, accessType: true, publicPreview: true } as const;
  const before = (await prisma.lesson.findMany({ where: { slug: { in: untouched } }, select })).sort((a, b) => a.slug.localeCompare(b.slug));
  const first = await seedLesson04Content(prisma);
  const second = await seedLesson04Content(prisma);
  assert.equal(first.ready, true);
  assert.equal(first.issues.length, 0);
  assert.equal(second.skipped || second.applied, true);
  assert.equal(second.activeBlocks, 30);
  assert.equal(await prisma.lesson.count({ where: { slug: LESSON_04_SLUG } }), 1);
  const stored = await prisma.lesson.findUniqueOrThrow({
    where: { slug: LESSON_04_SLUG },
    select: { accessType: true, commerceStatus: true, status: true, priceCents: true, estimatedMinutes: true, title: true, publicPreview: true },
  });
  assert.equal(stored.accessType, "PAID");
  assert.equal(stored.commerceStatus, "NOT_FOR_SALE");
  assert.equal(stored.status, "PUBLISHED");
  assert.equal(stored.priceCents, 2990);
  assert.equal(stored.estimatedMinutes, 30);
  assert.equal(stored.title, lesson04Meta.title);
  assert.match(stored.publicPreview ?? "", /Brief Inicial de Campanha/);
  const active = await prisma.lessonBlock.findMany({
    where: { lesson: { slug: LESSON_04_SLUG }, retiredAt: null },
    orderBy: { position: "asc" },
    select: { blockKey: true },
  });
  assert.deepEqual(active.map((block) => block.blockKey), lesson04Blocks.map((block) => block.blockKey));
  const after = (await prisma.lesson.findMany({ where: { slug: { in: untouched } }, select })).sort((a, b) => a.slug.localeCompare(b.slug));
  assert.deepEqual(after, before);
  assert.equal(await prisma.lesson.count({ where: { slug: LESSON_04_SLUG, commerceStatus: "AVAILABLE" } }), 0);
});

test("brief fica no LessonResult do projeto e não altera o Project sozinho", async () => {
  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { campaignBriefPreviewState, loadCampaignBriefPanel, saveCampaignBriefForUser, syncCampaignBriefProject, addCampaignPreparationTask } = await import("../../src/lib/learning/brief");
  const { loadRuleBlocks, loadSnapshot } = await import("../../src/lib/learning/state");
  const prisma = getPrisma();
  const stamp = Date.now();
  const owner = await prisma.user.create({
    data: { id: `lesson04-a-${stamp}`, name: "Dono", email: `lesson04-a-${stamp}@example.com`, emailVerified: true, role: "USER", createdAt: new Date(), updatedAt: new Date() },
  });
  const other = await prisma.user.create({
    data: { id: `lesson04-b-${stamp}`, name: "Outro", email: `lesson04-b-${stamp}@example.com`, emailVerified: true, role: "USER", createdAt: new Date(), updatedAt: new Date() },
  });
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { slug: LESSON_04_SLUG }, select: { id: true } });
  const order = await prisma.order.create({
    data: { userId: owner.id, status: "PAID", subtotalCents: 2990, creditCents: 0, totalCents: 2990 },
  });
  const item = await prisma.orderItem.create({
    data: { orderId: order.id, productType: "LESSON", lessonId: lesson.id, titleSnapshot: "Aula 4", listPriceCents: 2990, creditAppliedCents: 0, finalPriceCents: 2990 },
  });
  await prisma.entitlement.create({ data: { userId: owner.id, lessonId: lesson.id, orderItemId: item.id, status: "ACTIVE" } });
  const clinic = await prisma.project.create({
    data: {
      userId: owner.id,
      name: "Clínica",
      status: "ACTIVE",
      primaryOffer: "Ultrassom",
      objective: "LEADS",
      destinationType: "WHATSAPP",
      monthlyMediaBudgetCents: 60000,
      averageTicketCents: 18000,
      websiteUrl: "https://clinica.example",
      serviceArea: "Centro",
      usesGoogleAds: true,
      usesMetaAds: false,
    },
  });
  const store = await prisma.project.create({ data: { userId: owner.id, name: "Loja", status: "ACTIVE" } });
  const archived = await prisma.project.create({ data: { userId: owner.id, name: "Antiga", status: "ARCHIVED", archivedAt: new Date() } });
  const foreign = await prisma.project.create({ data: { userId: other.id, name: "Outra empresa", status: "ACTIVE" } });
  const rules = await loadRuleBlocks(lesson.id);
  assert.equal(await prisma.lessonResult.count({ where: { userId: owner.id } }), 0);
  assert.equal(campaignBriefPreviewState().mode, "preview");
  assert.equal(await prisma.lessonResult.count({ where: { userId: owner.id } }), 0);

  const locked = await saveCampaignBriefForUser(other.id, LESSON_04_SLUG, "brief-inicial-campanha", briefInput(clinic.id, "600"));
  assert.equal(locked.ok, false);
  const panel = await loadCampaignBriefPanel({ userId: owner.id, blocks: rules });
  assert.equal(panel?.mode, "live");
  if (panel?.mode === "live") {
    assert.equal(panel.chooseProject, true);
    assert.deepEqual(panel.projects.map((item) => item.name), ["Clínica", "Loja"]);
    const prefill = panel.projects.find((item) => item.id === clinic.id)?.prefill;
    assert.equal(prefill?.offer, "Ultrassom");
    assert.equal(prefill?.objective, "LEADS");
    assert.equal(prefill?.destination, "WHATSAPP");
    assert.equal(prefill?.monthlyBudget, "600");
    assert.equal(prefill?.websiteUrl, "https://clinica.example");
    assert.equal(prefill?.averageTicketCents, 18000);
  }

  assert.equal((await saveCampaignBriefForUser(owner.id, LESSON_04_SLUG, "brief-inicial-campanha", briefInput(clinic.id, "0"))).ok, false);
  assert.equal((await saveCampaignBriefForUser(owner.id, LESSON_04_SLUG, "brief-inicial-campanha", briefInput(clinic.id, "-10"))).ok, false);
  assert.equal((await saveCampaignBriefForUser(owner.id, LESSON_04_SLUG, "brief-inicial-campanha", briefInput(foreign.id, "600"))).ok, false);
  assert.equal((await saveCampaignBriefForUser(owner.id, LESSON_04_SLUG, "brief-inicial-campanha", briefInput(archived.id, "600"))).ok, false);

  const saved = await saveCampaignBriefForUser(owner.id, LESSON_04_SLUG, "brief-inicial-campanha", briefInput(clinic.id, "600"));
  assert.equal(saved.ok, true);
  const edited = await saveCampaignBriefForUser(owner.id, LESSON_04_SLUG, "brief-inicial-campanha", briefInput(clinic.id, "600,50", "Envio do formulário revisado."));
  assert.equal(edited.ok, true);
  assert.equal(await prisma.lessonResult.count({ where: { userId: owner.id, lessonId: lesson.id, projectId: clinic.id } }), 1);
  const clinicResult = await prisma.lessonResult.findFirstOrThrow({ where: { userId: owner.id, lessonId: lesson.id, projectId: clinic.id } });
  const payload = clinicResult.payload as { monthlyBudgetCents: number; dailyBudgetReferenceCents: number; primaryConversion: string };
  assert.equal(payload.monthlyBudgetCents, 60050);
  assert.equal(payload.dailyBudgetReferenceCents, dailyBudgetReferenceCents(60050));
  assert.equal(payload.primaryConversion, "Envio do formulário revisado.");
  assert.equal(await prisma.task.count({ where: { lessonResultId: clinicResult.id } }), 0);
  const untouchedProject = await prisma.project.findUniqueOrThrow({ where: { id: clinic.id } });
  assert.equal(untouchedProject.primaryOffer, "Ultrassom");
  assert.equal(untouchedProject.monthlyMediaBudgetCents, 60000);

  const second = await saveCampaignBriefForUser(owner.id, LESSON_04_SLUG, "brief-inicial-campanha", briefInput(store.id, "300"));
  assert.equal(second.ok, true);
  assert.equal(await prisma.lessonResult.count({ where: { userId: owner.id, lessonId: lesson.id } }), 2);
  assert.equal(await prisma.lessonResult.count({ where: { userId: other.id, lessonId: lesson.id } }), 0);

  const synced = await syncCampaignBriefProject(owner.id, LESSON_04_SLUG, clinic.id);
  assert.equal(synced.ok, true);
  const updated = await prisma.project.findUniqueOrThrow({ where: { id: clinic.id } });
  assert.equal(updated.primaryOffer, "Ultrassonografia obstétrica");
  assert.equal(updated.objective, "WHATSAPP");
  assert.equal(updated.destinationType, "LANDING_PAGE");
  assert.equal(updated.monthlyMediaBudgetCents, 60050);
  assert.equal(updated.websiteUrl, "https://clinica.example");
  assert.equal(updated.averageTicketCents, 18000);

  const task = await addCampaignPreparationTask(owner.id, LESSON_04_SLUG, clinic.id);
  assert.equal(task.ok, true);
  const again = await addCampaignPreparationTask(owner.id, LESSON_04_SLUG, clinic.id);
  assert.equal(again.ok && again.already, true);
  assert.equal(await prisma.task.count({ where: { projectId: clinic.id, sourceType: "LESSON" } }), 1);

  const snapshot = await loadSnapshot(owner.id, lesson.id, rules);
  assert.equal(snapshot.completedBlockKeys.includes("brief-inicial-campanha"), true);
  assert.equal(snapshot.completedBlockKeys.includes("antes-de-abrir-plataforma"), false);
  const reloaded = await loadCampaignBriefPanel({ userId: owner.id, blocks: rules });
  const reloadedBrief = reloaded?.mode === "live" ? reloaded.projects.find((item) => item.id === clinic.id)?.brief : null;
  assert.equal(reloadedBrief?.monthlyBudgetCents, 60050);
  assert.equal(reloaded?.mode === "live" && reloaded.linkedProjectId, store.id);

  await prisma.user.delete({ where: { id: owner.id } });
  await prisma.user.delete({ where: { id: other.id } });
});

function briefInput(projectId: string, monthlyBudget: string, primaryConversion = "Envio do formulário de orçamento.") {
  return {
    projectId,
    offer: "Ultrassonografia obstétrica",
    objective: "WHATSAPP",
    primaryConversion,
    destination: "LANDING_PAGE",
    monthlyBudget,
    initialObservationDays: 14 as const,
    validationBeforeLaunch: "Confirmar se o formulário dispara o evento de conversão.",
  };
}
