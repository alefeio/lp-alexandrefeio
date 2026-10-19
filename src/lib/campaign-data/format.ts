import { CampaignDataError } from "@/lib/campaign-data/errors";
import { CAMPAIGN_DATA_LIMITS } from "@/lib/campaign-data/limits";
import type { CampaignFileFormat } from "@/lib/campaign-data/types";

const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export function declaredFormat(fileName: string): CampaignFileFormat | null {
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith(".csv")) return "CSV";
  if (lower.endsWith(".xlsx")) return "XLSX";
  return null;
}

export function rejectDeclaredName(fileName: string): void {
  const lower = fileName.trim().toLowerCase();
  if (declaredFormat(fileName)) return;
  if (lower.endsWith(".xls") || lower.endsWith(".xlsm") || lower.endsWith(".xlsb") || lower.endsWith(".ods")) {
    throw new CampaignDataError("UNSUPPORTED_FORMAT");
  }
  throw new CampaignDataError("UNSUPPORTED_FORMAT");
}

export function assertSize(sizeBytes: number): void {
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > CAMPAIGN_DATA_LIMITS.maxFileBytes) {
    throw new CampaignDataError("FILE_TOO_LARGE");
  }
}

export function sniffFormat(bytes: Uint8Array): CampaignFileFormat {
  if (bytes.length >= OLE.length && OLE.every((byte, index) => bytes[index] === byte)) {
    throw new CampaignDataError("UNSUPPORTED_FORMAT");
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return "XLSX";
  }
  return "CSV";
}
