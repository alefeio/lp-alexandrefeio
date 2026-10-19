import type { CampaignFileFormat } from "@/lib/campaign-data/types";

const OPAQUE = /^[a-z0-9]{8,40}$/i;

export function opaqueId(value: string): boolean {
  return OPAQUE.test(value);
}

export function rawStoragePath(projectId: string, importId: string, format: CampaignFileFormat): string {
  if (!opaqueId(projectId) || !opaqueId(importId)) {
    throw new Error("pathname opaco inválido");
  }
  const extension = format === "CSV" ? "csv" : "xlsx";
  return `campaign-data/${projectId}/${importId}/raw.${extension}`;
}

export function normalizedStoragePath(projectId: string, importId: string): string {
  if (!opaqueId(projectId) || !opaqueId(importId)) {
    throw new Error("pathname opaco inválido");
  }
  return `campaign-data/${projectId}/${importId}/normalized.json.gz`;
}

export function pathnameMatchesImport(pathname: string, projectId: string, importId: string): boolean {
  return pathname === rawStoragePath(projectId, importId, "CSV") || pathname === rawStoragePath(projectId, importId, "XLSX");
}
