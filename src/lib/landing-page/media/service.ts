import { randomBytes, randomUUID } from "node:crypto";
import { parseLandingPageDocument, type LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { fail, ok, type LandingPageResult } from "@/lib/landing-page/errors";
import type { LandingPageProjectRecord, LandingPageStore } from "@/lib/landing-page/types";
import { inspectLandingPageImage } from "@/lib/landing-page/media/bytes";
import {
  LANDING_PAGE_MEDIA_CONTENT_TYPES,
  LANDING_PAGE_MEDIA_LIMITS,
  LANDING_PAGE_MEDIA_TYPES,
  maxBytesForMediaType,
  type LandingPageMediaContentType,
  type LandingPageMediaType,
} from "@/lib/landing-page/media/limits";
import { landingPageMediaPlacementSchema, type LandingPageMediaPlacement } from "@/lib/landing-page/media/placement";
import { consumeLandingPageMediaRateLimit } from "@/lib/landing-page/media/rate-limit";
import type { LandingPageMediaRecord, LandingPageMediaStore } from "@/lib/landing-page/media/record";
import { landingPageContentReferencesMedia, landingPageReferencesMedia } from "@/lib/landing-page/media/refs";
import type { LandingPageMediaStorage } from "@/lib/landing-page/media/storage";

function opaquePath(): string {
  return `landing-media/${randomBytes(16).toString("hex")}`;
}

async function ownedProject(
  store: LandingPageStore,
  landingPageProjectId: string,
  userId: string,
): Promise<LandingPageProjectRecord | null> {
  return store.findByIdForUser(landingPageProjectId, userId);
}

async function commit(
  store: LandingPageStore,
  input: { id: string; userId: string; expectedRevision: number; document: LandingPageDocumentV1 },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  const parsed = parseLandingPageDocument(input.document);
  if (!parsed.ok) return fail("INVALID_DOCUMENT");
  const updated = await store.updateDraftAtomic({
    id: input.id,
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    document: parsed.document,
  });
  if (!updated.ok) return fail(updated.reason === "CONFLICT" ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  return ok(updated.record);
}

function upsertRef(document: LandingPageDocumentV1, placement: LandingPageMediaPlacement) {
  const index = document.mediaRefs.findIndex((ref) => ref.mediaId === placement.mediaId && ref.usage === placement.usage);
  if (index >= 0) document.mediaRefs[index] = placement;
  else document.mediaRefs.push(placement);
}

export async function beginLandingPageMediaUpload(
  store: LandingPageStore,
  mediaStore: LandingPageMediaStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    type: string;
    mimeType: string;
    fileSize: number;
    clientUserId?: string;
    now?: number;
  },
): Promise<LandingPageResult<LandingPageMediaRecord>> {
  const project = await ownedProject(store, input.landingPageProjectId, input.userId);
  if (!project) return fail("NOT_FOUND");
  if (!LANDING_PAGE_MEDIA_TYPES.includes(input.type as LandingPageMediaType)) return fail("LANDING_PAGE_MEDIA_REJECTED");
  if (!LANDING_PAGE_MEDIA_CONTENT_TYPES.includes(input.mimeType as LandingPageMediaContentType)) return fail("LANDING_PAGE_MEDIA_REJECTED");
  const type = input.type as LandingPageMediaType;
  if (!Number.isInteger(input.fileSize) || input.fileSize < 1 || input.fileSize > maxBytesForMediaType(type)) {
    return fail("LANDING_PAGE_MEDIA_TOO_LARGE");
  }
  const now = input.now ?? Date.now();
  if ((await mediaStore.countActive(project.id)) >= LANDING_PAGE_MEDIA_LIMITS.maxAssetsPerProject) {
    return fail("LANDING_PAGE_MEDIA_LIMIT");
  }
  if (!(await consumeLandingPageMediaRateLimit(input.userId, now))) return fail("LANDING_PAGE_MEDIA_RATE_LIMITED");
  const record: LandingPageMediaRecord = {
    id: randomUUID(),
    landingPageProjectId: project.id,
    userId: input.userId,
    type,
    status: "UPLOADING",
    storageKey: opaquePath(),
    publicUrl: null,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    width: null,
    height: null,
    altText: null,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
  await mediaStore.insert(record);
  return ok(record);
}

export async function completeLandingPageMediaUpload(
  store: LandingPageStore,
  mediaStore: LandingPageMediaStore,
  storage: LandingPageMediaStorage,
  input: { userId: string; mediaId: string; bytes: Uint8Array },
): Promise<LandingPageResult<LandingPageMediaRecord>> {
  const current = await mediaStore.findById(input.mediaId);
  if (!current || current.userId !== input.userId) return fail("NOT_FOUND");
  const project = await ownedProject(store, current.landingPageProjectId, input.userId);
  if (!project) return fail("NOT_FOUND");
  if (current.status === "READY") return ok(current);
  if (current.status !== "UPLOADING") return fail("LANDING_PAGE_MEDIA_REJECTED");
  const limit = maxBytesForMediaType(current.type);
  if (input.bytes.byteLength < 1 || input.bytes.byteLength > limit) {
    current.status = "FAILED";
    current.updatedAt = new Date();
    await mediaStore.save(current);
    return fail("LANDING_PAGE_MEDIA_TOO_LARGE");
  }
  const inspected = inspectLandingPageImage(input.bytes, current.mimeType);
  if (!inspected) {
    current.status = "FAILED";
    current.updatedAt = new Date();
    await mediaStore.save(current);
    return fail("LANDING_PAGE_MEDIA_REJECTED");
  }
  try {
    const stored = await storage.put(current.storageKey, inspected.bytes, inspected.mimeType);
    current.status = "READY";
    current.publicUrl = stored.url;
    current.mimeType = inspected.mimeType;
    current.fileSize = inspected.bytes.byteLength;
    current.width = inspected.width;
    current.height = inspected.height;
    current.updatedAt = new Date();
    await mediaStore.save(current);
    return ok(current);
  } catch {
    current.status = "FAILED";
    current.publicUrl = null;
    current.updatedAt = new Date();
    await mediaStore.save(current);
    return fail("LANDING_PAGE_MEDIA_STORAGE");
  }
}

export async function finalizeLandingPageMediaUpload(
  store: LandingPageStore,
  mediaStore: LandingPageMediaStore,
  storage: LandingPageMediaStorage,
  input: { userId: string; mediaId: string },
): Promise<LandingPageResult<LandingPageMediaRecord>> {
  const current = await mediaStore.findById(input.mediaId);
  if (!current || current.userId !== input.userId) return fail("NOT_FOUND");
  const project = await ownedProject(store, current.landingPageProjectId, input.userId);
  if (!project) return fail("NOT_FOUND");
  if (current.status === "READY") return ok(current);
  if (current.status !== "UPLOADING") return fail("LANDING_PAGE_MEDIA_REJECTED");
  let object: { bytes: Uint8Array; url: string } | null = null;
  try {
    object = await storage.get(current.storageKey);
  } catch {
    return fail("LANDING_PAGE_MEDIA_STORAGE");
  }
  if (!object?.url) return fail("LANDING_PAGE_MEDIA_STORAGE");
  const inspected = inspectLandingPageImage(object.bytes, current.mimeType);
  if (!inspected) {
    try {
      await storage.delete(current.storageKey);
    } catch {
      return fail("LANDING_PAGE_MEDIA_STORAGE");
    }
    current.status = "FAILED";
    current.updatedAt = new Date();
    await mediaStore.save(current);
    return fail("LANDING_PAGE_MEDIA_REJECTED");
  }
  current.status = "READY";
  current.publicUrl = object.url;
  current.fileSize = inspected.bytes.byteLength;
  current.width = inspected.width;
  current.height = inspected.height;
  current.updatedAt = new Date();
  await mediaStore.save(current);
  return ok(current);
}

export async function listLandingPageMedia(
  store: LandingPageStore,
  mediaStore: LandingPageMediaStore,
  input: { userId: string; landingPageProjectId: string },
): Promise<LandingPageResult<LandingPageMediaRecord[]>> {
  const project = await ownedProject(store, input.landingPageProjectId, input.userId);
  if (!project) return fail("NOT_FOUND");
  return ok(await mediaStore.listForProjectOwner(project.id, input.userId));
}

export async function resolveLandingPageMedia(
  store: LandingPageStore,
  mediaStore: LandingPageMediaStore,
  input: { userId: string; mediaId: string },
): Promise<LandingPageResult<LandingPageMediaRecord>> {
  const current = await mediaStore.findById(input.mediaId);
  if (!current || current.userId !== input.userId || current.status !== "READY" || !current.publicUrl) return fail("NOT_FOUND");
  const project = await ownedProject(store, current.landingPageProjectId, input.userId);
  if (!project) return fail("NOT_FOUND");
  return ok(current);
}

export async function deleteLandingPageMedia(
  store: LandingPageStore,
  mediaStore: LandingPageMediaStore,
  storage: LandingPageMediaStorage,
  input: { userId: string; mediaId: string },
  publications?: { referencesMedia(projectId: string, mediaId: string): Promise<boolean> },
): Promise<LandingPageResult<LandingPageMediaRecord>> {
  const current = await mediaStore.findById(input.mediaId);
  if (!current || current.userId !== input.userId || current.status === "DELETED") return fail("NOT_FOUND");
  const project = await ownedProject(store, current.landingPageProjectId, input.userId);
  if (!project) return fail("NOT_FOUND");
  if (landingPageReferencesMedia(project.draftDocument, current.id)) return fail("LANDING_PAGE_MEDIA_IN_USE");
  if (await publications?.referencesMedia(project.id, current.id)) return fail("LANDING_PAGE_MEDIA_IN_USE");
  try {
    await storage.delete(current.storageKey);
  } catch {
    return fail("LANDING_PAGE_MEDIA_STORAGE");
  }
  current.status = "DELETED";
  current.publicUrl = null;
  current.updatedAt = new Date();
  await mediaStore.save(current);
  return ok(current);
}

async function requireReadyMedia(
  store: LandingPageStore,
  mediaStore: LandingPageMediaStore,
  userId: string,
  landingPageProjectId: string,
  mediaId: string,
): Promise<LandingPageResult<LandingPageMediaRecord>> {
  const media = await mediaStore.findById(mediaId);
  if (!media || media.userId !== userId) return fail("NOT_FOUND");
  if (media.landingPageProjectId !== landingPageProjectId || media.status !== "READY") return fail("LANDING_PAGE_MEDIA_REJECTED");
  const project = await ownedProject(store, landingPageProjectId, userId);
  if (!project) return fail("NOT_FOUND");
  return ok(media);
}

export async function attachLandingPageMedia(
  store: LandingPageStore,
  mediaStore: LandingPageMediaStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    sectionId: string;
    placement: unknown;
  },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  const placement = landingPageMediaPlacementSchema.safeParse(input.placement);
  if (!placement.success) return fail("INVALID_INPUT");
  if (!placement.data.decorative && !placement.data.altText) return fail("INVALID_INPUT");
  const project = await ownedProject(store, input.landingPageProjectId, input.userId);
  if (!project || project.draftRevision !== input.expectedRevision) {
    return fail(project ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  }
  const media = await requireReadyMedia(store, mediaStore, input.userId, project.id, placement.data.mediaId);
  if (!media.ok) return media;
  const document = structuredClone(project.draftDocument);
  const section = document.sections.find((item) => item.id === input.sectionId);
  if (!section || (section.type !== "HERO" && section.type !== "FOOTER")) return fail("INVALID_INPUT");
  section.content = { ...section.content, mediaRef: placement.data };
  upsertRef(document, placement.data);
  if (document.mediaRefs.length > 40) return fail("LANDING_PAGE_MEDIA_LIMIT");
  return commit(store, { id: project.id, userId: input.userId, expectedRevision: input.expectedRevision, document });
}

export async function detachLandingPageMedia(
  store: LandingPageStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    sectionId: string;
    mediaId: string;
  },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  const project = await ownedProject(store, input.landingPageProjectId, input.userId);
  if (!project || project.draftRevision !== input.expectedRevision) {
    return fail(project ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  }
  const document = structuredClone(project.draftDocument);
  const section = document.sections.find((item) => item.id === input.sectionId);
  if (!section) return fail("NOT_FOUND");
  if ((section.type === "HERO" || section.type === "FOOTER") && section.content.mediaRef?.mediaId === input.mediaId) {
    const content = { ...section.content };
    delete content.mediaRef;
    section.content = content;
  } else if (section.type === "PORTFOLIO") {
    section.content = { ...section.content, items: section.content.items.filter((item) => item.mediaRef.mediaId !== input.mediaId) };
  } else {
    return fail("INVALID_INPUT");
  }
  document.mediaRefs = document.mediaRefs.filter(
    (ref) => ref.mediaId !== input.mediaId || landingPageContentReferencesMedia(document, input.mediaId),
  );
  return commit(store, { id: project.id, userId: input.userId, expectedRevision: input.expectedRevision, document });
}

export async function setLandingPagePortfolioItems(
  store: LandingPageStore,
  mediaStore: LandingPageMediaStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    sectionId: string;
    heading?: string;
    description?: string;
    items: unknown[];
  },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  if (input.items.length > LANDING_PAGE_MEDIA_LIMITS.maxPortfolioItems) return fail("LANDING_PAGE_MEDIA_LIMIT");
  const project = await ownedProject(store, input.landingPageProjectId, input.userId);
  if (!project || project.draftRevision !== input.expectedRevision) {
    return fail(project ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  }
  const items: Array<{ mediaRef: LandingPageMediaPlacement; title?: string; description?: string }> = [];
  for (const item of input.items) {
    if (!item || typeof item !== "object") return fail("INVALID_INPUT");
    const source = item as { mediaRef?: unknown; title?: string; description?: string };
    const placement = landingPageMediaPlacementSchema.safeParse(source.mediaRef);
    if (!placement.success || placement.data.usage !== "PORTFOLIO") return fail("INVALID_INPUT");
    if (!placement.data.decorative && !placement.data.altText) return fail("INVALID_INPUT");
    const media = await requireReadyMedia(store, mediaStore, input.userId, project.id, placement.data.mediaId);
    if (!media.ok) return media;
    items.push({
      mediaRef: placement.data,
      ...(source.title ? { title: source.title } : {}),
      ...(source.description ? { description: source.description } : {}),
    });
  }
  const document = structuredClone(project.draftDocument);
  const section = document.sections.find((entry) => entry.id === input.sectionId);
  if (!section || section.type !== "PORTFOLIO") return fail("INVALID_INPUT");
  section.content = {
    ...section.content,
    ...(input.heading ? { heading: input.heading } : {}),
    ...(input.description ? { description: input.description } : {}),
    items,
  };
  for (const item of items) upsertRef(document, item.mediaRef);
  return commit(store, { id: project.id, userId: input.userId, expectedRevision: input.expectedRevision, document });
}

export async function expireAbandonedLandingPageUploads(mediaStore: LandingPageMediaStore, now = Date.now()): Promise<number> {
  const cutoff = new Date(now - LANDING_PAGE_MEDIA_LIMITS.abandonedUploadMs);
  const stale = await mediaStore.listUploadingBefore(cutoff);
  for (const row of stale) {
    row.status = "FAILED";
    row.updatedAt = new Date(now);
    await mediaStore.save(row);
  }
  return stale.length;
}
