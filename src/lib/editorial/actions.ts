"use server";

import { requireAdmin } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { inspectLessonDocument } from "@/lib/editorial/document";
import { blockFromForm } from "@/lib/editorial/form-blocks";
import {
  applyLessonDocument,
  closeLessonSale,
  createBlock,
  createLesson,
  createModule,
  openBundleSale,
  openLessonSale,
  removeBlock,
  reorderBlocks,
  saveCourse,
  saveLesson,
  saveModule,
  storeEditorialImage,
  updateBlock,
  type EditorialActor,
} from "@/lib/editorial/service";

async function actor(): Promise<EditorialActor | null> {
  const session = await requireAdmin();
  if (!session) return null;
  return { userId: session.user.id, role: session.user.role ?? "" };
}

export async function saveCourseAction(courseId: string, form: FormData) {
  const current = await actor();
  if (!current) return { ok: false as const, message: "Sem acesso." };
  return saveCourse(current, courseId, { ...textFields(form, ["title", "subtitle", "description", "sortOrder", "bundlePriceCents", "status", "updatedAt"]), ...(await coverFrom(form)) });
}

export async function createModuleAction(courseId: string, form: FormData) {
  const current = await actor();
  if (!current) return { ok: false as const, message: "Sem acesso." };
  return createModule(current, courseId, { title: String(form.get("title") ?? ""), description: String(form.get("description") ?? "") });
}

export async function saveModuleAction(moduleId: string, form: FormData) {
  const current = await actor();
  if (!current) return { ok: false as const, message: "Sem acesso." };
  const lessonOrder: Record<string, number> = {};
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("lessonOrder:")) continue;
    const parsed = Number(value);
    if (Number.isInteger(parsed)) lessonOrder[key.slice("lessonOrder:".length)] = parsed;
  }
  return saveModule(current, moduleId, {
    ...textFields(form, ["title", "subtitle", "description", "sortOrder", "bundlePriceCents", "status", "updatedAt"]),
    lessonOrder,
    ...(await coverFrom(form)),
  });
}

export async function createLessonAction(moduleId: string, form: FormData) {
  const current = await actor();
  if (!current) return { ok: false as const, message: "Sem acesso." };
  return createLesson(current, moduleId, {
    title: String(form.get("title") ?? ""),
    summary: String(form.get("summary") ?? ""),
    accessType: String(form.get("accessType") ?? ""),
  });
}

export async function saveLessonAction(lessonId: string, form: FormData) {
  const current = await actor();
  if (!current) return { ok: false as const, message: "Sem acesso." };
  return saveLesson(current, lessonId, {
    title: String(form.get("title") ?? ""),
    summary: String(form.get("summary") ?? ""),
    publicPreview: String(form.get("publicPreview") ?? ""),
    estimatedMinutes: String(form.get("estimatedMinutes") ?? ""),
    accessType: String(form.get("accessType") ?? ""),
    priceCents: String(form.get("priceCents") ?? ""),
    sortOrder: String(form.get("sortOrder") ?? ""),
    status: String(form.get("status") ?? ""),
    publishedAt: String(form.get("publishedAt") ?? ""),
    updatedAt: String(form.get("updatedAt") ?? ""),
    ...(await coverFrom(form)),
  });
}

export async function openLessonSaleAction(lessonId: string) {
  const current = await actor();
  if (!current) return { ok: false as const, message: "Sem acesso." };
  return openLessonSale(current, lessonId);
}

export async function closeLessonSaleAction(lessonId: string) {
  const current = await actor();
  if (!current) return { ok: false as const, message: "Sem acesso." };
  return closeLessonSale(current, lessonId);
}

export async function openBundleSaleAction(kind: "module" | "course", id: string) {
  const current = await actor();
  if (!current) return { ok: false as const, message: "Sem acesso." };
  return openBundleSale(current, kind, id);
}

export async function createBlockAction(lessonId: string, form: FormData) {
  const current = await actor();
  if (!current) return { ok: false as const, message: "Sem acesso." };
  const parsed = blockFromForm(form);
  if (!parsed.ok) return parsed;
  return createBlock(current, lessonId, {
    blockKey: parsed.blockKey,
    data: parsed.data,
    updatedAt: String(form.get("updatedAt") ?? ""),
    publicPreview: form.get("publicPreview") === "on",
  });
}

export async function updateBlockAction(blockId: string, form: FormData) {
  const current = await actor();
  if (!current) return { ok: false as const, message: "Sem acesso." };
  const parsed = blockFromForm(form);
  if (!parsed.ok) return parsed;
  return updateBlock(current, blockId, {
    blockKey: parsed.blockKey,
    data: parsed.data,
    updatedAt: String(form.get("updatedAt") ?? ""),
    confirmKeyChange: form.get("confirmKeyChange") === "on",
    publicPreview: form.get("publicPreview") === "on",
  });
}

export async function reorderBlocksAction(lessonId: string, form: FormData) {
  const current = await actor();
  if (!current) return { ok: false as const, message: "Sem acesso." };
  const positions: Record<string, number> = {};
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("position:")) continue;
    const parsed = Number(value);
    if (Number.isInteger(parsed)) positions[key.slice("position:".length)] = parsed;
  }
  return reorderBlocks(current, lessonId, positions, String(form.get("updatedAt") ?? ""));
}

export async function removeBlockAction(blockId: string) {
  const current = await actor();
  if (!current) return { ok: false as const, message: "Sem acesso." };
  return removeBlock(current, blockId);
}

export async function previewImportAction(lessonId: string, form: FormData) {
  const current = await actor();
  if (!current) return { ok: false as const, message: "Sem acesso.", issues: [] as string[] };
  const raw = parseJson(String(form.get("document") ?? ""));
  if (!raw.ok) return { ok: false as const, message: raw.message, issues: [] as string[] };
  const blocks = await getPrisma().lessonBlock.findMany({ where: { lessonId } });
  const inspected = inspectLessonDocument(raw.value, lessonId, blocks);
  const message = inspected.issues.length > 0 ? inspected.issues.join(" ") : inspected.message;
  return { ok: inspected.ok, message, issues: inspected.issues };
}

export async function applyImportAction(lessonId: string, form: FormData) {
  const current = await actor();
  if (!current) return { ok: false as const, message: "Sem acesso." };
  const raw = parseJson(String(form.get("document") ?? ""));
  if (!raw.ok) return raw;
  return applyLessonDocument(current, lessonId, raw.value, String(form.get("updatedAt") ?? ""));
}

export async function uploadEditorialImageAction(form: FormData) {
  const current = await actor();
  if (!current) return { ok: false as const, message: "Sem acesso." };
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false as const, message: "Escolha uma imagem." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  return storeEditorialImage(current, {
    bytes,
    declaredType: file.type,
    size: file.size,
    alt: String(form.get("alt") ?? ""),
    decorative: form.get("decorative") === "on",
  });
}

function textFields<T extends string>(form: FormData, names: T[]): Record<T, string> {
  return Object.fromEntries(names.map((name) => [name, String(form.get(name) ?? "")])) as Record<T, string>;
}

async function coverFrom(form: FormData): Promise<{ coverImageUrl?: string; coverImagePublicId?: string }> {
  if (!form.has("coverAssetId")) return {};
  const assetId = String(form.get("coverAssetId") ?? "");
  if (!assetId || assetId === "none") return { coverImageUrl: "", coverImagePublicId: "" };
  const asset = await getPrisma().mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset) return {};
  return { coverImageUrl: asset.url, coverImagePublicId: asset.publicId };
}

function parseJson(raw: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, message: "O JSON não pôde ser lido." };
  }
}
