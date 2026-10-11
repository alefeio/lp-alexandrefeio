import type { LessonBlockData } from "@/lib/learning/blocks";
import { parseBlockData } from "@/lib/learning/blocks";
import { getPrisma } from "@/lib/db/prisma";
import { inspectLessonDocument, type LessonDocument } from "@/lib/editorial/document";
import { slugify } from "@/lib/editorial/keys";
import { assessLesson, bundleSaleReady, lessonSaleReady, type ReadyBlock, type ReadyLesson } from "@/lib/editorial/readiness";
import { uploadToApimg } from "@/lib/storage/apimg";
import { validateEditorialImage, type EditorialImageFormat } from "@/lib/storage/image-file";

export type EditorialActor = { userId: string; role: string };

export function editorAllowed(role: string | null | undefined): boolean {
  return role === "ADMIN";
}

type Result = { ok: true; message: string; id?: string } | { ok: false; message: string };

function denied(): Result {
  return { ok: false, message: "Sem acesso." };
}

function gate(actor: EditorialActor): Result | null {
  return editorAllowed(actor.role) ? null : denied();
}

export async function saveCourse(actor: EditorialActor, courseId: string, input: CourseInput): Promise<Result> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  const prisma = getPrisma();
  const current = await prisma.course.findUnique({ where: { id: courseId } });
  if (!current) return { ok: false, message: "Curso não encontrado." };
  if (stale(current.updatedAt, input.updatedAt)) return conflict();
  const price = cents(input.bundlePriceCents);
  if (price === "invalid") return { ok: false, message: "O preço do pacote precisa ser um inteiro em centavos." };
  const status = statusOf(input.status);
  if (!status) return { ok: false, message: "Status inválido." };
  await prisma.course.update({
    where: { id: courseId },
    data: {
      title: input.title.trim(),
      subtitle: empty(input.subtitle),
      description: input.description.trim(),
      sortOrder: integer(input.sortOrder, current.sortOrder),
      bundlePriceCents: price,
      status,
      publishedAt: status === "PUBLISHED" ? (current.publishedAt ?? new Date()) : current.publishedAt,
      ...cover(input),
      updatedById: actor.userId,
    },
  });
  return { ok: true, message: "Curso salvo." };
}

export async function createModule(actor: EditorialActor, courseId: string, input: { title: string; description: string }): Promise<Result> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  const title = input.title.trim();
  const description = input.description.trim();
  if (title.length < 2 || description.length < 2) return { ok: false, message: "Informe título e descrição do módulo." };
  const prisma = getPrisma();
  const slug = await uniqueModuleSlug(courseId, title);
  const row = await prisma.module.create({
    data: { courseId, slug, title, description, status: "DRAFT", commerceStatus: "NOT_FOR_SALE", updatedById: actor.userId },
  });
  return { ok: true, message: "Módulo criado.", id: row.id };
}

export async function saveModule(actor: EditorialActor, moduleId: string, input: ModuleInput): Promise<Result> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  const prisma = getPrisma();
  const current = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!current) return { ok: false, message: "Módulo não encontrado." };
  if (stale(current.updatedAt, input.updatedAt)) return conflict();
  const price = cents(input.bundlePriceCents);
  if (price === "invalid") return { ok: false, message: "O preço do pacote precisa ser um inteiro em centavos." };
  const status = statusOf(input.status);
  if (!status) return { ok: false, message: "Status inválido." };
  await prisma.module.update({
    where: { id: moduleId },
    data: {
      title: input.title.trim(),
      description: input.description.trim(),
      sortOrder: integer(input.sortOrder, current.sortOrder),
      bundlePriceCents: price,
      status,
      ...cover(input),
      updatedById: actor.userId,
    },
  });
  if (input.lessonOrder) {
    for (const [lessonId, sortOrder] of Object.entries(input.lessonOrder)) {
      const value = Number(sortOrder);
      if (!Number.isInteger(value)) continue;
      await prisma.lesson.updateMany({ where: { id: lessonId, moduleId }, data: { sortOrder: value } });
    }
  }
  return { ok: true, message: "Módulo salvo." };
}

export async function createLesson(actor: EditorialActor, moduleId: string, input: { title: string; summary: string; accessType: string }): Promise<Result> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  const accessType = input.accessType === "PAID" ? "PAID" : input.accessType === "FREE" ? "FREE" : null;
  if (!accessType || input.title.trim().length < 2 || input.summary.trim().length < 2) {
    return { ok: false, message: "Informe título, resumo e o tipo de acesso." };
  }
  const prisma = getPrisma();
  const slug = await uniqueLessonSlug(input.title);
  const row = await prisma.lesson.create({
    data: {
      moduleId,
      slug,
      title: input.title.trim(),
      summary: input.summary.trim(),
      accessType,
      status: "DRAFT",
      commerceStatus: "NOT_FOR_SALE",
      priceCents: accessType === "PAID" ? 100 : null,
      updatedById: actor.userId,
    },
  });
  return { ok: true, message: "Aula criada.", id: row.id };
}

export async function saveLesson(actor: EditorialActor, lessonId: string, input: LessonInput): Promise<Result> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  const prisma = getPrisma();
  const current = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!current) return { ok: false, message: "Aula não encontrada." };
  if (stale(current.updatedAt, input.updatedAt)) return conflict();
  const accessType = input.accessType === "PAID" || input.accessType === "FREE" ? input.accessType : null;
  const status = statusOf(input.status);
  if (!accessType || !status) return { ok: false, message: "Revise acesso e status." };
  if (current.commerceStatus === "AVAILABLE" && (status !== "PUBLISHED" || accessType !== "PAID")) {
    return { ok: false, message: "Retire a aula da venda antes de mudar publicação ou acesso." };
  }
  const price = cents(input.priceCents);
  if (price === "invalid") return { ok: false, message: "O preço precisa ser um inteiro em centavos." };
  const minutes = integer(input.estimatedMinutes, current.estimatedMinutes ?? 0);
  const blocks = await loadReadyBlocks(lessonId);
  if (status === "PUBLISHED") {
    const assessment = assessLesson(readyFrom(current, { ...input, accessType, priceCents: price, estimatedMinutes: minutes, status }), blocks);
    if (!assessment.ready) return { ok: false, message: assessment.issues[0] ?? "A aula ainda não pode ser publicada." };
  }
  let publishedAt = current.publishedAt;
  if (input.publishedAt.trim()) {
    const parsed = new Date(input.publishedAt);
    if (Number.isNaN(parsed.getTime())) return { ok: false, message: "Data de publicação inválida." };
    publishedAt = parsed;
  } else if (status === "PUBLISHED" && !publishedAt) publishedAt = new Date();
  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      title: input.title.trim(),
      summary: input.summary.trim(),
      publicPreview: empty(input.publicPreview),
      estimatedMinutes: minutes > 0 ? minutes : null,
      sortOrder: integer(input.sortOrder, current.sortOrder),
      accessType,
      priceCents: price,
      status,
      publishedAt,
      ...cover(input),
      updatedById: actor.userId,
    },
  });
  return { ok: true, message: status === "PUBLISHED" ? "Aula publicada. Ela continua fora de venda até a ação explícita." : "Aula salva." };
}

export async function openLessonSale(actor: EditorialActor, lessonId: string): Promise<Result> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  const lesson = await loadReadyLesson(lessonId);
  if (!lesson) return { ok: false, message: "Aula não encontrada." };
  const blocks = await loadReadyBlocks(lessonId);
  const sale = lessonSaleReady(lesson, assessLesson(lesson, blocks));
  if (!sale.ready) return { ok: false, message: sale.issues[0] ?? "A aula ainda não pode ir à venda." };
  await getPrisma().lesson.update({ where: { id: lessonId }, data: { commerceStatus: "AVAILABLE", updatedById: actor.userId } });
  return { ok: true, message: "Aula marcada como disponível para venda." };
}

export async function closeLessonSale(actor: EditorialActor, lessonId: string): Promise<Result> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  await getPrisma().lesson.updateMany({ where: { id: lessonId }, data: { commerceStatus: "NOT_FOR_SALE", updatedById: actor.userId } });
  return { ok: true, message: "Aula retirada da venda." };
}

export async function openBundleSale(actor: EditorialActor, kind: "module" | "course", id: string): Promise<Result> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  const prisma = getPrisma();
  const lessons =
    kind === "module"
      ? await prisma.lesson.findMany({ where: { moduleId: id } })
      : await prisma.lesson.findMany({ where: { module: { courseId: id } } });
  const sale = bundleSaleReady(kind === "module" ? "módulo" : "curso", lessons);
  if (!sale.ready) return { ok: false, message: sale.issues[0] ?? "Ainda não dá para vender este pacote." };
  if (kind === "module") await prisma.module.update({ where: { id }, data: { commerceStatus: "AVAILABLE", updatedById: actor.userId } });
  else await prisma.course.update({ where: { id }, data: { commerceStatus: "AVAILABLE", updatedById: actor.userId } });
  return { ok: true, message: "Pacote marcado como disponível para venda." };
}

export async function createBlock(actor: EditorialActor, lessonId: string, input: { blockKey: string; data: LessonBlockData; updatedAt: string }): Promise<Result> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return { ok: false, message: "Aula não encontrada." };
  if (stale(lesson.updatedAt, input.updatedAt)) return conflict();
  const last = await prisma.lessonBlock.aggregate({ where: { lessonId }, _max: { position: true } });
  try {
    await prisma.lessonBlock.create({
      data: {
        lessonId,
        blockKey: input.blockKey,
        type: input.data.type,
        position: (last._max.position ?? 0) + 1,
        payload: input.data,
      },
    });
  } catch {
    return { ok: false, message: "Já existe um bloco com esta chave." };
  }
  await touchLesson(lessonId, actor.userId);
  return { ok: true, message: "Bloco criado." };
}

export async function updateBlock(
  actor: EditorialActor,
  blockId: string,
  input: { blockKey: string; data: LessonBlockData; updatedAt: string; confirmKeyChange: boolean },
): Promise<Result> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  const prisma = getPrisma();
  const block = await prisma.lessonBlock.findUnique({ where: { id: blockId }, include: { lesson: true } });
  if (!block || block.retiredAt) return { ok: false, message: "Bloco não encontrado." };
  if (stale(block.lesson.updatedAt, input.updatedAt)) return conflict();
  if (input.data.type !== block.type) return { ok: false, message: "Não troque o tipo de um bloco existente. Aposente e crie outro." };
  if (input.blockKey !== block.blockKey) {
    const history = await blockHasHistory(block.lessonId, block.blockKey);
    if (block.lesson.status === "PUBLISHED" && !input.confirmKeyChange) {
      return { ok: false, message: "A chave publicada não muda. Confirme para aposentar esta e criar outra." };
    }
    if (history && !input.confirmKeyChange) {
      return { ok: false, message: "Esta chave já tem progresso. Aposente o bloco e crie outro." };
    }
    if (block.lesson.status === "DRAFT" && !history) {
      try {
        await prisma.lessonBlock.update({ where: { id: block.id }, data: { blockKey: input.blockKey, payload: input.data } });
      } catch {
        return { ok: false, message: "Já existe um bloco com esta chave." };
      }
      await touchLesson(block.lessonId, actor.userId);
      return { ok: true, message: "Chave atualizada antes da publicação." };
    }
    try {
      await prisma.lessonBlock.create({
        data: { lessonId: block.lessonId, blockKey: input.blockKey, type: input.data.type, position: block.position, payload: input.data },
      });
    } catch {
      return { ok: false, message: "Já existe um bloco com esta chave." };
    }
    await prisma.lessonBlock.update({ where: { id: block.id }, data: { retiredAt: new Date() } });
    await touchLesson(block.lessonId, actor.userId);
    return { ok: true, message: "Bloco antigo aposentado. A chave nova não herda o progresso." };
  }
  await prisma.lessonBlock.update({ where: { id: block.id }, data: { payload: input.data } });
  await touchLesson(block.lessonId, actor.userId);
  return { ok: true, message: "Bloco salvo." };
}

export async function reorderBlocks(actor: EditorialActor, lessonId: string, positions: Record<string, number>, updatedAt: string): Promise<Result> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return { ok: false, message: "Aula não encontrada." };
  if (stale(lesson.updatedAt, updatedAt)) return conflict();
  const blocks = await prisma.lessonBlock.findMany({ where: { lessonId, retiredAt: null } });
  for (const block of blocks) {
    const next = positions[block.id];
    if (!Number.isInteger(next)) continue;
    await prisma.lessonBlock.update({ where: { id: block.id }, data: { position: next } });
  }
  await touchLesson(lessonId, actor.userId);
  return { ok: true, message: "Ordem salva. As chaves não mudaram." };
}

export async function removeBlock(actor: EditorialActor, blockId: string): Promise<Result> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  const prisma = getPrisma();
  const block = await prisma.lessonBlock.findUnique({ where: { id: blockId }, include: { lesson: true } });
  if (!block || block.retiredAt) return { ok: false, message: "Bloco não encontrado." };
  const history = await blockHasHistory(block.lessonId, block.blockKey);
  if (block.lesson.status === "DRAFT" && !history) {
    await prisma.lessonBlock.delete({ where: { id: block.id } });
    await touchLesson(block.lessonId, actor.userId);
    return { ok: true, message: "Bloco excluído." };
  }
  await prisma.lessonBlock.update({ where: { id: block.id }, data: { retiredAt: new Date() } });
  await touchLesson(block.lessonId, actor.userId);
  return { ok: true, message: "Bloco aposentado. O progresso antigo deixa de entrar no cálculo." };
}

export async function applyLessonDocument(actor: EditorialActor, lessonId: string, raw: unknown, updatedAt: string): Promise<Result> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return { ok: false, message: "Aula não encontrada." };
  if (stale(lesson.updatedAt, updatedAt)) return conflict();
  const current = await prisma.lessonBlock.findMany({ where: { lessonId } });
  const inspected = inspectLessonDocument(raw, lessonId, current);
  if (!inspected.ok || !inspected.document) return { ok: false, message: inspected.message };
  await writeDocument(lessonId, inspected.document, current);
  await touchLesson(lessonId, actor.userId);
  return { ok: true, message: "Importação aplicada. Blocos ausentes no arquivo permaneceram." };
}

export async function storeEditorialImage(
  actor: EditorialActor,
  input: { bytes: Uint8Array; declaredType: string; size: number; alt: string; decorative: boolean },
  upload: typeof uploadToApimg = uploadToApimg,
): Promise<Result & { assetId?: string }> {
  const blocked = gate(actor);
  if (blocked) return blocked;
  const checked = validateEditorialImage(input.bytes, input.declaredType, input.size);
  if (!checked.ok) return checked;
  if (!input.decorative && input.alt.trim().length === 0) return { ok: false, message: "Informe o texto alternativo ou marque a imagem como decorativa." };
  const uploaded = await upload(checked.bytes, checked.format as EditorialImageFormat);
  if (!uploaded.ok) return uploaded;
  const asset = await getPrisma().mediaAsset.create({
    data: {
      url: uploaded.asset.url,
      publicId: uploaded.asset.publicId,
      width: uploaded.asset.width,
      height: uploaded.asset.height,
      format: uploaded.asset.format,
      sizeBytes: uploaded.asset.sizeBytes,
      alt: input.decorative ? "" : input.alt.trim(),
      decorative: input.decorative,
      createdById: actor.userId,
    },
  });
  return { ok: true, message: "Imagem enviada.", assetId: asset.id };
}

export async function lessonReadiness(lessonId: string) {
  const lesson = await loadReadyLesson(lessonId);
  if (!lesson) return null;
  const blocks = await loadReadyBlocks(lessonId);
  const content = assessLesson(lesson, blocks);
  return { content, sale: lessonSaleReady(lesson, content) };
}

export function previewBlocksFor(role: string | null | undefined, blocks: unknown[]): unknown[] {
  return editorAllowed(role) ? blocks : [];
}

async function writeDocument(lessonId: string, document: LessonDocument, current: { id: string; blockKey: string; type: string; retiredAt: Date | null }[]) {
  const prisma = getPrisma();
  const active = new Map(current.filter((block) => !block.retiredAt).map((block) => [block.blockKey, block]));
  for (const block of document.blocks) {
    const existing = active.get(block.blockKey);
    if (existing) {
      if (existing.type === block.data.type) {
        await prisma.lessonBlock.update({
          where: { id: existing.id },
          data: { payload: block.data, position: block.position, countsForProgress: block.countsForProgress ?? true, required: block.required ?? false },
        });
      }
      continue;
    }
    await prisma.lessonBlock.create({
      data: {
        lessonId,
        blockKey: block.blockKey,
        type: block.data.type,
        position: block.position,
        payload: block.data,
        countsForProgress: block.countsForProgress ?? true,
        required: block.required ?? false,
      },
    });
  }
}

async function loadReadyLesson(lessonId: string): Promise<ReadyLesson | null> {
  const lesson = await getPrisma().lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return null;
  return {
    title: lesson.title,
    summary: lesson.summary,
    publicPreview: lesson.publicPreview,
    estimatedMinutes: lesson.estimatedMinutes,
    accessType: lesson.accessType,
    status: lesson.status,
    priceCents: lesson.priceCents,
    commerceStatus: lesson.commerceStatus,
  };
}

async function loadReadyBlocks(lessonId: string): Promise<ReadyBlock[]> {
  const rows = await getPrisma().lessonBlock.findMany({ where: { lessonId } });
  return rows.map((row) => ({ blockKey: row.blockKey, retiredAt: row.retiredAt, payload: row.payload }));
}

function readyFrom(current: ReadyLesson, input: { title: string; summary: string; publicPreview: string; estimatedMinutes: number; accessType: "FREE" | "PAID"; priceCents: number | null; status: "DRAFT" | "PUBLISHED" }): ReadyLesson {
  return {
    title: input.title,
    summary: input.summary,
    publicPreview: input.publicPreview.trim() || null,
    estimatedMinutes: input.estimatedMinutes,
    accessType: input.accessType,
    status: input.status,
    priceCents: input.priceCents,
    commerceStatus: current.commerceStatus,
  };
}

async function blockHasHistory(lessonId: string, blockKey: string): Promise<boolean> {
  const prisma = getPrisma();
  const [progress, responses, notes, bookmarks] = await Promise.all([
    prisma.lessonBlockProgress.count({ where: { lessonId, blockKey } }),
    prisma.lessonResponse.count({ where: { lessonId, blockKey } }),
    prisma.lessonNote.count({ where: { lessonId, blockKey } }),
    prisma.lessonBookmark.count({ where: { lessonId, blockKey } }),
  ]);
  return progress + responses + notes + bookmarks > 0;
}

async function touchLesson(lessonId: string, userId: string) {
  await getPrisma().lesson.update({ where: { id: lessonId }, data: { updatedById: userId } });
}

async function uniqueLessonSlug(title: string): Promise<string> {
  const prisma = getPrisma();
  const base = slugify(title);
  let slug = base;
  let n = 2;
  while (await prisma.lesson.findUnique({ where: { slug } })) slug = `${base.slice(0, 70)}-${n++}`;
  return slug;
}

async function uniqueModuleSlug(courseId: string, title: string): Promise<string> {
  const prisma = getPrisma();
  const base = slugify(title);
  let slug = base;
  let n = 2;
  while (await prisma.module.findUnique({ where: { courseId_slug: { courseId, slug } } })) slug = `${base.slice(0, 70)}-${n++}`;
  return slug;
}

function stale(updatedAt: Date, expected: string): boolean {
  return expected.trim().length > 0 && updatedAt.toISOString() !== expected;
}

function conflict(): Result {
  return { ok: false, message: "Este conteúdo foi atualizado em outra aba. Recarregue antes de salvar." };
}

function cents(value: string): number | null | "invalid" {
  const raw = value.trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return "invalid";
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : "invalid";
}

function integer(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function empty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function statusOf(value: string): "DRAFT" | "PUBLISHED" | null {
  if (value === "DRAFT" || value === "PUBLISHED") return value;
  return null;
}

function cover(input: { coverImageUrl?: string; coverImagePublicId?: string }): { coverImageUrl?: string | null; coverImagePublicId?: string | null } {
  if (input.coverImageUrl === undefined && input.coverImagePublicId === undefined) return {};
  return {
    coverImageUrl: empty(input.coverImageUrl ?? ""),
    coverImagePublicId: empty(input.coverImagePublicId ?? ""),
  };
}

export function exportLessonDocument(lessonId: string, blocks: { blockKey: string; position: number; countsForProgress: boolean; required: boolean; retiredAt: Date | null; payload: unknown }[]) {
  return {
    schemaVersion: 1 as const,
    lessonId,
    blocks: blocks
      .filter((block) => !block.retiredAt)
      .map((block) => ({
        blockKey: block.blockKey,
        position: block.position,
        countsForProgress: block.countsForProgress,
        required: block.required,
        data: parseBlockData(block.payload),
      }))
      .filter((block) => block.data),
  };
}

export type CourseInput = {
  title: string;
  subtitle: string;
  description: string;
  sortOrder: string;
  bundlePriceCents: string;
  status: string;
  updatedAt: string;
  coverImageUrl?: string;
  coverImagePublicId?: string;
};

export type ModuleInput = CourseInput & { lessonOrder?: Record<string, number> };

export type LessonInput = {
  title: string;
  summary: string;
  publicPreview: string;
  estimatedMinutes: string;
  accessType: string;
  priceCents: string;
  sortOrder: string;
  status: string;
  publishedAt: string;
  updatedAt: string;
  coverImageUrl?: string;
  coverImagePublicId?: string;
};
