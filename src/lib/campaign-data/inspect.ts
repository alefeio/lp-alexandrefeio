import { createHash } from "node:crypto";
import { parseCsv } from "@/lib/campaign-data/csv";
import { CampaignDataError } from "@/lib/campaign-data/errors";
import { assertSize, sniffFormat } from "@/lib/campaign-data/format";
import type { ParsedWorkbook } from "@/lib/campaign-data/types";
import { parseXlsx } from "@/lib/campaign-data/xlsx";

export const DUPLICATE_FILE_WARNING = "Este arquivo já foi enviado.";

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function inspectBytes(bytes: Uint8Array, selectedSheet?: string): Promise<ParsedWorkbook> {
  assertSize(bytes.byteLength);
  const format = sniffFormat(bytes);
  if (format === "CSV") {
    const parsed = parseCsv(bytes);
    return { format: "CSV", sheets: [parsed.sheet], warnings: parsed.warnings };
  }
  try {
    return await parseXlsx(bytes, selectedSheet);
  } catch (error) {
    if (error instanceof CampaignDataError) throw error;
    throw new CampaignDataError("INVALID_XLSX");
  }
}

export function activeSheet(workbook: ParsedWorkbook, selectedSheet?: string) {
  if (workbook.sheets.length > 1 && !selectedSheet) return null;
  return workbook.sheets.find((sheet) => !selectedSheet || sheet.name === selectedSheet) ?? null;
}
