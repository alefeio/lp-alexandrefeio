import ExcelJS from "exceljs";
import { CampaignDataError } from "@/lib/campaign-data/errors";
import { CAMPAIGN_DATA_LIMITS } from "@/lib/campaign-data/limits";
import type { ParsedSheet, ParsedWorkbook } from "@/lib/campaign-data/types";
import { assertRealXlsx, readZipEntries } from "@/lib/campaign-data/zip-package";

function primitive(value: unknown): string | null {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return null;
}

function cellText(value: unknown, warnings: string[]): string {
  const plain = primitive(value);
  if (plain != null) return plain.slice(0, CAMPAIGN_DATA_LIMITS.maxCellText);
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if ("formula" in record || "sharedFormula" in record) {
    const cached = primitive(record.result);
    if (cached == null) warnings.push("Uma fórmula sem valor calculado ficou de fora.");
    return cached?.slice(0, CAMPAIGN_DATA_LIMITS.maxCellText) ?? "";
  }
  if (Array.isArray(record.richText)) {
    return record.richText
      .map((part) => (part && typeof part === "object" && "text" in part ? String(part.text ?? "") : ""))
      .join("")
      .slice(0, CAMPAIGN_DATA_LIMITS.maxCellText);
  }
  if (typeof record.text === "string") return record.text.slice(0, CAMPAIGN_DATA_LIMITS.maxCellText);
  return "";
}

function readSheet(sheet: ExcelJS.Worksheet, warnings: string[]): ParsedSheet {
  const rows: string[][] = [];
  let headers: string[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = (row.values as unknown[]).slice(1).map((value) => cellText(value, warnings));
    if (rowNumber === 1) {
      if (values.length > CAMPAIGN_DATA_LIMITS.maxColumns) throw new CampaignDataError("TOO_MANY_COLUMNS");
      headers = values.map((header, index) => header.trim().slice(0, CAMPAIGN_DATA_LIMITS.maxHeaderLength) || `Coluna ${index + 1}`);
      return;
    }
    if (rows.length >= CAMPAIGN_DATA_LIMITS.maxRows) throw new CampaignDataError("TOO_MANY_ROWS");
    while (values.length < headers.length) values.push("");
    rows.push(values.slice(0, headers.length));
  });
  return { name: sheet.name, headers, rows };
}

export async function parseXlsx(bytes: Uint8Array, selectedSheet?: string): Promise<ParsedWorkbook> {
  const entries = readZipEntries(bytes);
  const inspected = assertRealXlsx(entries);
  const warnings = inspected.externalLinks ? ["A planilha cita uma fonte externa. Esse link não foi consultado."] : [];
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Buffer.from(bytes) as never);
  } catch {
    throw new CampaignDataError("INVALID_XLSX");
  }
  if (workbook.worksheets.length > CAMPAIGN_DATA_LIMITS.maxSheets) throw new CampaignDataError("TOO_MANY_SHEETS");
  const multiple = workbook.worksheets.length > 1;
  const sheets = workbook.worksheets.map((sheet) => {
    if (multiple && sheet.name !== selectedSheet) return { name: sheet.name, headers: [], rows: [] };
    return readSheet(sheet, warnings);
  });
  if (selectedSheet && !sheets.some((sheet) => sheet.name === selectedSheet)) throw new CampaignDataError("PARSE_FAILED");
  return { format: "XLSX", sheets, warnings };
}
