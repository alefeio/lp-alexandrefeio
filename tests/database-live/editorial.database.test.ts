import assert from "node:assert/strict";

import { config as loadEnv } from "dotenv";
import test from "node:test";

import { type LessonBlockData } from "../../src/lib/learning/blocks";
import { firstCourseSeed } from "../../src/lib/learning/first-course";

import { type EditorialActor } from "../../src/lib/editorial/service";

loadEnv({ path: ".env.local" });

const admin: EditorialActor = { userId: "editor-test", role: "ADMIN" };
const user: EditorialActor = { userId: "user-test", role: "USER" };
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

test("admin edita aula sem abrir venda e sem vazar corpo", async () => {
  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { createBlock, createLesson, createModule, openLessonSale, closeLessonSale, removeBlock, reorderBlocks, saveLesson, storeEditorialImage, updateBlock } = await import("../../src/lib/editorial/service");
  const prisma = getPrisma();
  const stamp = Date.now();
  const course = await prisma.course.create({
    data: { slug: `editorial-${stamp}`, title: "Fixture editorial", description: "Teste", status: "DRAFT" },
  });
  try {
    assert.equal((await createLesson(user, "missing", { title: "A", summary: "B", accessType: "FREE" })).ok, false);
    const moduleRow = await createModule(admin, course.id, { title: "Módulo", description: "Descrição do módulo de teste." });
    assert.equal(moduleRow.ok, true);
    if (!moduleRow.ok || !moduleRow.id) return;
    const lesson = await createLesson(admin, moduleRow.id, { title: "Aula fixture", summary: "Resumo da aula fixture.", accessType: "PAID" });
    assert.equal(lesson.ok, true);
    if (!lesson.ok || !lesson.id) return;
    const saved = await saveLesson(admin, lesson.id, lessonInput(lesson.id, "DRAFT"));
    assert.equal(saved.ok, true);
    let stampAt = (await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).updatedAt.toISOString();
    for (const block of sampleBlocks()) {
      const created = await createBlock(admin, lesson.id, { ...block, updatedAt: stampAt });
      assert.equal(created.ok, true, created.ok ? "" : created.message);
      stampAt = (await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).updatedAt.toISOString();
    }
    const again = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    const duplicate = await createBlock(admin, lesson.id, { blockKey: "texto", data: text("Outro"), updatedAt: again.updatedAt.toISOString() });
    assert.equal(duplicate.ok, false);

    const published = await saveLesson(admin, lesson.id, lessonInput(lesson.id, "PUBLISHED"));
    assert.equal(published.ok, true, published.ok ? "" : published.message);
    const afterPublish = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    assert.equal(afterPublish.status, "PUBLISHED");
    assert.equal(afterPublish.commerceStatus, "NOT_FOR_SALE");

    const textBlock = await prisma.lessonBlock.findFirstOrThrow({ where: { lessonId: lesson.id, blockKey: "texto" } });
    const renamed = await updateBlock(admin, textBlock.id, { blockKey: "texto-novo", data: text("Texto"), updatedAt: afterPublish.updatedAt.toISOString(), confirmKeyChange: false });
    assert.equal(renamed.ok, false);
    assert.equal((await prisma.lessonBlock.findUnique({ where: { id: textBlock.id } }))?.blockKey, "texto");

    const heading = await prisma.lessonBlock.findFirstOrThrow({ where: { lessonId: lesson.id, blockKey: "secao" } });
    const fresh = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    const moved = await reorderBlocks(admin, lesson.id, { [textBlock.id]: 2, [heading.id]: 1 }, fresh.updatedAt.toISOString());
    assert.equal(moved.ok, true);
    const ordered = await prisma.lessonBlock.findMany({ where: { lessonId: lesson.id, blockKey: { in: ["texto", "secao"] } } });
    assert.deepEqual(ordered.map((block) => block.blockKey).sort(), ["secao", "texto"]);

    const retired = await removeBlock(admin, textBlock.id);
    assert.equal(retired.ok, true);
    const visible = await prisma.lessonBlock.count({ where: { lessonId: lesson.id, blockKey: "texto", retiredAt: null } });
    assert.equal(visible, 0);

    const sale = await openLessonSale(admin, lesson.id);
    assert.equal(sale.ok, true, sale.ok ? "" : sale.message);
    assert.equal((await prisma.lesson.findUnique({ where: { id: lesson.id } }))?.commerceStatus, "AVAILABLE");
    await closeLessonSale(admin, lesson.id);
    assert.equal((await prisma.lesson.findUnique({ where: { id: lesson.id } }))?.commerceStatus, "NOT_FOR_SALE");

    const draft = await createLesson(admin, moduleRow.id, { title: "Rascunho", summary: "Resumo do rascunho.", accessType: "FREE" });
    assert.equal(draft.ok, true);
    if (!draft.ok || !draft.id) return;
    const draftRow = await prisma.lesson.findUniqueOrThrow({ where: { id: draft.id } });
    const draftBlock = await createBlock(admin, draft.id, { blockKey: "nota", data: text("Nota"), updatedAt: draftRow.updatedAt.toISOString() });
    assert.equal(draftBlock.ok, true);
    const draftStored = await prisma.lessonBlock.findFirstOrThrow({ where: { lessonId: draft.id, blockKey: "nota" } });
    const removed = await removeBlock(admin, draftStored.id);
    assert.equal(removed.message, "Bloco excluído.");
    assert.equal(await prisma.lessonBlock.count({ where: { id: draftStored.id } }), 0);

    let uploads = 0;
    const denied = await storeEditorialImage(user, { bytes: png, declaredType: "image/png", size: png.byteLength, alt: "Capa", decorative: false }, async () => {
      uploads += 1;
      throw new Error("não deveria enviar");
    });
    assert.equal(denied.ok, false);
    assert.equal(uploads, 0);
    const stored = await storeEditorialImage(admin, { bytes: png, declaredType: "image/png", size: png.byteLength, alt: "Capa de teste", decorative: false }, async () => ({
      ok: true as const,
      asset: { url: "https://cdn.example/i/fixture", publicId: `fixture-${stamp}`, width: 12, height: 8, format: "png", sizeBytes: 70 },
    }));
    assert.equal(stored.ok, true);
    const asset = await prisma.mediaAsset.findUnique({ where: { publicId: `fixture-${stamp}` } });
    assert.equal(asset?.width, 12);
    assert.equal(asset?.alt, "Capa de teste");
    if (asset) await prisma.mediaAsset.delete({ where: { id: asset.id } });

    const real = await prisma.lesson.count({
      where: { accessType: "PAID", commerceStatus: "AVAILABLE", module: { course: { slug: firstCourseSeed.slug } } },
    });
    assert.equal(real, 0);
  } finally {
    await prisma.course.delete({ where: { id: course.id } });
  }
});

function sampleBlocks(): { blockKey: string; data: LessonBlockData }[] {
  return [
    { blockKey: "texto", data: text("Um parágrafo real da aula.") },
    { blockKey: "secao", data: { type: "HEADING", text: "Seção", level: 2 } },
    { blockKey: "aviso", data: { type: "CALLOUT", body: "Um aviso útil.", tone: "tip" } },
    { blockKey: "exemplo", data: { type: "EXAMPLE", body: "Um exemplo concreto." } },
    { blockKey: "check", data: { type: "CHECKPOINT", question: "Qual caminho?", options: [{ id: "a", label: "Caminho A" }, { id: "b", label: "Caminho B" }], correctOptionId: "a", explanation: "Porque o destino existe." } },
    { blockKey: "atividade", data: { type: "ACTIVITY", prompt: "Escreva o objetivo.", inputType: "short_text" } },
    { blockKey: "lista", data: { type: "CHECKLIST", items: [{ id: "item", label: "Revisar a oferta" }] } },
    { blockKey: "resultado", data: { type: "RESULT", title: "Entrega", prompt: "Registre a decisão.", fields: [{ key: "decisao", label: "Decisão" }] } },
    { blockKey: "fim", data: { type: "CONCLUSION", body: "A aula termina com uma decisão." } },
    { blockKey: "figura", data: { type: "IMAGE", url: "https://cdn.example/i/figura.png", alt: "Diagrama da oferta", publicId: "figura" } },
  ];
}

function text(body: string): LessonBlockData {
  return { type: "TEXT", body };
}

function lessonInput(lessonId: string, status: "DRAFT" | "PUBLISHED") {
  void lessonId;
  return {
    title: "Aula fixture",
    summary: "Resumo da aula fixture.",
    publicPreview: "Preview público da fixture.",
    estimatedMinutes: "8",
    accessType: "PAID",
    priceCents: "1000",
    sortOrder: "1",
    status,
    publishedAt: "",
    updatedAt: "",
  };
}
