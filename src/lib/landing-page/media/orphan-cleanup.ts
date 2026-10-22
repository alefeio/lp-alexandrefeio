import { landingPageReferencesMedia } from "@/lib/landing-page/media/refs";
import type { LandingPageMediaRecord } from "@/lib/landing-page/media/record";
import type { LandingPageMediaStorage } from "@/lib/landing-page/media/storage";
import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";

/**
 * Janela técnica para upload abandonado ou arquivo que acabou de sair do rascunho.
 * Não é política de retenção do cliente.
 */
export const LANDING_PAGE_MEDIA_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

export type LandingPageMediaOrphanCleanup = {
  examined: number;
  eligible: number;
  deleted: number;
  failed: number;
};

/**
 * Órfã: não está no rascunho, em nenhum snapshot publicado, nem em upload ainda dentro da janela.
 * Mídia de publicação histórica nunca entra. A exclusão real só ocorre com dryRun false.
 * Se o armazenamento falha, o registro permanece.
 */
export async function cleanupLandingPageMediaOrphans(input: {
  records: LandingPageMediaRecord[];
  drafts: Array<{ projectId: string; document: LandingPageDocumentV1 }>;
  publicationReferencesMedia: (projectId: string, mediaId: string) => Promise<boolean> | boolean;
  storage?: Pick<LandingPageMediaStorage, "delete">;
  now?: number;
  graceMs?: number;
  dryRun?: boolean;
  save?: (record: LandingPageMediaRecord) => Promise<void>;
}): Promise<LandingPageMediaOrphanCleanup> {
  const now = input.now ?? Date.now();
  const graceMs = input.graceMs ?? LANDING_PAGE_MEDIA_ORPHAN_GRACE_MS;
  const dryRun = input.dryRun !== false;
  const result: LandingPageMediaOrphanCleanup = { examined: input.records.length, eligible: 0, deleted: 0, failed: 0 };
  for (const record of input.records) {
    if (record.status === "DELETED") continue;
    const draft = input.drafts.find((item) => item.projectId === record.landingPageProjectId);
    if (draft && landingPageReferencesMedia(draft.document, record.id)) continue;
    if (await input.publicationReferencesMedia(record.landingPageProjectId, record.id)) continue;
    const age = now - record.updatedAt.getTime();
    if (record.status === "UPLOADING" && age < graceMs) continue;
    if (age < graceMs) continue;
    result.eligible += 1;
    if (dryRun || !input.storage || !input.save) continue;
    try {
      await input.storage.delete(record.storageKey);
    } catch {
      result.failed += 1;
      continue;
    }
    record.status = "DELETED";
    record.publicUrl = null;
    record.updatedAt = new Date(now);
    await input.save(record);
    result.deleted += 1;
  }
  return result;
}
