import assert from "node:assert/strict";

import test from "node:test";
import { config as loadEnv } from "dotenv";

import { canIndexLesson } from "../../src/lib/learning/access";

import { getPublicLesson, loadLessonBlocks, sitemapLearningEntries } from "../../src/lib/learning/catalog";
import { getPrisma } from "../../src/lib/db/prisma";

import { LESSON_04_PUBLIC_PREVIEW_KEYS, LESSON_05_PUBLIC_PREVIEW_KEYS, LESSON_06_PUBLIC_PREVIEW_KEYS } from "../../src/lib/learning/public-preview";

loadEnv({ path: ".env.local" });

const later = [
  "palavras-chave-com-intencao",
  "anuncios-alinhados-a-conversao",
  "objetivo-publico-estrutura",
  "campanhas-leads-whatsapp",
];

test("consulta pública da aula paga não devolve bloco privado", async () => {
  const prisma = getPrisma();
  const slugs = ["objetivo-oferta-orcamento", "destino-e-mensuracao", "campanha-de-pesquisa"] as const;
  const expected = [LESSON_04_PUBLIC_PREVIEW_KEYS, LESSON_05_PUBLIC_PREVIEW_KEYS, LESSON_06_PUBLIC_PREVIEW_KEYS];
  for (const [index, slug] of slugs.entries()) {
    const page = await getPublicLesson(slug);
    assert.ok(page);
    assert.equal(page.hasPublicPreview, true);
    assert.equal(canIndexLesson(page.lesson, page.hasBody, page.hasPublicPreview), true);
    assert.deepEqual(
      page.blocks.map((block) => block.blockKey),
      [...expected[index]!],
    );
    assert.equal(page.blocks.some((block) => block.data.type === "TOOL" || block.data.type === "CHECKPOINT"), false);
    const full = await loadLessonBlocks(page.lesson.id, "full");
    assert.equal(full.some((block) => block.data.type === "TOOL"), true);
    assert.equal(full.length > page.blocks.length, true);
  }

  const free = await getPublicLesson("como-funciona-o-trafego-pago");
  assert.ok(free);
  assert.equal(canIndexLesson(free.lesson, free.hasBody, free.hasPublicPreview), true);
  assert.equal(free.blocks.length > 5, true);
  assert.equal(free.lesson.accessType, "FREE");

  for (const slug of later) {
    const page = await getPublicLesson(slug);
    assert.ok(page);
    assert.equal(page.blocks.length, 0);
    assert.equal(page.hasPublicPreview, false);
    assert.equal(canIndexLesson(page.lesson, page.hasBody, page.hasPublicPreview), false);
    assert.equal(await prisma.lessonBlock.count({ where: { lesson: { slug }, retiredAt: null } }), 0);
  }

  const entries = await sitemapLearningEntries();
  const urls = new Set(entries.lessons.filter((lesson) => lesson.indexable).map((lesson) => lesson.slug));
  assert.equal(urls.has("como-funciona-o-trafego-pago"), true);
  assert.equal(urls.has("objetivo-oferta-orcamento"), true);
  assert.equal(urls.has("destino-e-mensuracao"), true);
  assert.equal(urls.has("campanha-de-pesquisa"), true);
  for (const slug of later) assert.equal(urls.has(slug), false);

  const tool = await prisma.lessonBlock.findFirst({
    where: { lesson: { slug: "objetivo-oferta-orcamento" }, type: "TOOL", retiredAt: null },
  });
  assert.ok(tool);
  await prisma.lessonBlock.update({ where: { id: tool.id }, data: { isPublicPreview: true } });
  try {
    const leaked = await loadLessonBlocks(tool.lessonId, "preview");
    assert.equal(leaked.some((block) => block.data.type === "TOOL"), false);
  } finally {
    await prisma.lessonBlock.update({ where: { id: tool.id }, data: { isPublicPreview: false } });
  }
});
