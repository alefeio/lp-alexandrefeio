import { CampaignDataError } from "@/lib/campaign-data/errors";
import { CAMPAIGN_DATA_LIMITS } from "@/lib/campaign-data/limits";
import type { ParsedSheet } from "@/lib/campaign-data/types";

const CANDIDATES = [",", ";", "\t"] as const;

export function decodeCsv(bytes: Uint8Array): { text: string; warnings: string[] } {
  let offset = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) offset = 3;
  const slice = bytes.subarray(offset);
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(slice), warnings: [] };
  } catch {
    return {
      text: new TextDecoder("windows-1252").decode(slice),
      warnings: ["O arquivo não estava em UTF-8. A leitura usou Latin-1."],
    };
  }
}

function splitRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function scoreDelimiter(text: string, delimiter: string): { stable: boolean; width: number; total: number } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0).slice(0, 20);
  if (lines.length === 0) return { stable: false, width: 0, total: 0 };
  const widths = lines.map((line) => splitRow(line, delimiter).length);
  const width = widths[0] ?? 0;
  const stable = width > 1 && widths.every((item) => item === width);
  const total = lines.reduce((sum, line) => sum + [...line].filter((char) => char === delimiter).length, 0);
  return { stable, width, total };
}

export function detectDelimiter(text: string): string {
  const ranked = CANDIDATES.map((delimiter) => ({ delimiter, ...scoreDelimiter(text, delimiter) }))
    .filter((item) => item.stable)
    .sort((left, right) => right.total - left.total || right.width - left.width);
  return ranked[0]?.delimiter ?? ",";
}

function clip(value: string, warnings: string[]): string {
  const trimmed = value.trim();
  if (trimmed.length <= CAMPAIGN_DATA_LIMITS.maxCellText) return trimmed;
  warnings.push("Uma célula passou do limite e foi cortada.");
  return trimmed.slice(0, CAMPAIGN_DATA_LIMITS.maxCellText);
}

export function parseCsv(bytes: Uint8Array): { sheet: ParsedSheet; warnings: string[] } {
  const decoded = decodeCsv(bytes);
  const warnings = [...decoded.warnings];
  const delimiter = detectDelimiter(decoded.text);
  const lines = decoded.text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw new CampaignDataError("PARSE_FAILED");
  const headerCells = splitRow(lines[0]!, delimiter).map((cell) => clip(cell, warnings));
  if (headerCells.length > CAMPAIGN_DATA_LIMITS.maxColumns) throw new CampaignDataError("TOO_MANY_COLUMNS");
  const headers = headerCells.map((header, index) => {
    const limited = header.slice(0, CAMPAIGN_DATA_LIMITS.maxHeaderLength);
    return limited || `Coluna ${index + 1}`;
  });
  const rows: string[][] = [];
  for (const line of lines.slice(1)) {
    if (rows.length >= CAMPAIGN_DATA_LIMITS.maxRows) throw new CampaignDataError("TOO_MANY_ROWS");
    const cells = splitRow(line, delimiter).map((cell) => clip(cell, warnings));
    if (cells.length > CAMPAIGN_DATA_LIMITS.maxColumns) throw new CampaignDataError("TOO_MANY_COLUMNS");
    while (cells.length < headers.length) cells.push("");
    rows.push(cells.slice(0, headers.length));
  }
  return { sheet: { name: "CSV", headers, rows }, warnings };
}
