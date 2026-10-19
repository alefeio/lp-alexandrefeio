"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { confirmCampaignMapping, deleteCampaignImport, finalizeCampaignImport, prepareCampaignImport, selectCampaignSheet } from "@/lib/campaign-data/service";
import { SOURCE_PLATFORMS } from "@/lib/campaign-data/types";

export async function prepareCampaignImportAction(projectId: string, input: { fileName: string; sizeBytes: number; sourcePlatform: string; mimeType?: string }) {
  const session = await requireSession();
  if (!SOURCE_PLATFORMS.includes(input.sourcePlatform as (typeof SOURCE_PLATFORMS)[number])) {
    return { ok: false as const, message: "Escolha a fonte do relatório." };
  }
  return prepareCampaignImport(session.user.id, projectId, input);
}

export async function finalizeCampaignImportAction(projectId: string, importId: string) {
  const session = await requireSession();
  return finalizeCampaignImport(session.user.id, projectId, importId);
}

export async function selectCampaignSheetAction(projectId: string, importId: string, formData: FormData) {
  const session = await requireSession();
  const result = await selectCampaignSheet(session.user.id, projectId, importId, String(formData.get("sheet") ?? ""));
  if (!result.ok) redirect(`/app/projetos/${projectId}/dados/${importId}?erro=${result.code}`);
  redirect(`/app/projetos/${projectId}/dados/${importId}`);
}

export async function confirmCampaignMappingAction(projectId: string, importId: string, formData: FormData) {
  const session = await requireSession();
  const columns = [...formData.entries()]
    .filter(([key]) => key.startsWith("column-"))
    .map(([key, value]) => ({ index: Number(key.slice("column-".length)), canonical: String(value) }));
  const result = await confirmCampaignMapping(session.user.id, projectId, importId, {
    columns,
    locale: String(formData.get("locale") ?? ""),
    currency: String(formData.get("currency") ?? ""),
  });
  if (!result.ok) redirect(`/app/projetos/${projectId}/dados/${importId}?erro=${result.code}`);
  redirect(`/app/projetos/${projectId}/dados/${importId}`);
}

export async function deleteCampaignImportAction(projectId: string, importId: string) {
  const session = await requireSession();
  const result = await deleteCampaignImport(session.user.id, projectId, importId);
  if (!result.ok) redirect(`/app/projetos/${projectId}/dados?erro=${result.code}`);
  redirect(`/app/projetos/${projectId}/dados`);
}
