import { gzipSync } from "node:zlib";
import { availableFromColumns, isDimension, metricField } from "@/lib/campaign-data/metrics";
import { parseLocalizedNumber } from "@/lib/campaign-data/numbers";
import type { BaseMetricId, ConfirmedColumn, DimensionId, NumberLocale, ParsedSheet } from "@/lib/campaign-data/types";

const MONEY = new Set<BaseMetricId>(["SPEND", "CONVERSION_VALUE", "REVENUE"]);

export type NormalizedDataset = {
  body: Buffer;
  rowCount: number;
  warnings: string[];
  dimensions: DimensionId[];
  metrics: Array<BaseMetricId | ReturnType<typeof availableFromColumns>[number]>;
};

function cellText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeSheet(sheet: ParsedSheet, columns: ConfirmedColumn[], locale: NumberLocale): NormalizedDataset {
  const warnings: string[] = [];
  const lines: string[] = [];
  const dimensions = new Set<DimensionId>();
  const bases = new Set<BaseMetricId>();
  for (const column of columns) {
    if (!column.canonical) continue;
    if (isDimension(column.canonical)) dimensions.add(column.canonical);
    else bases.add(column.canonical);
  }
  for (const row of sheet.rows) {
    const record: Record<string, string | number> = {};
    for (const column of columns) {
      if (!column.canonical) continue;
      const raw = row[column.index] ?? "";
      if (isDimension(column.canonical)) {
        const text = cellText(raw);
        if (text) record[column.canonical] = text;
        continue;
      }
      const parsed = parseLocalizedNumber(raw, locale);
      if (!parsed.ok) {
        if (parsed.reason === "AMBIGUOUS" || parsed.reason === "PERCENT") warnings.push("Um valor numérico ambíguo ficou de fora.");
        continue;
      }
      bases.add(column.canonical);
      record[metricField(column.canonical)] = MONEY.has(column.canonical) ? Math.round(parsed.value * 100) : parsed.value;
    }
    if (Object.keys(record).length > 0) lines.push(JSON.stringify(record));
  }
  return {
    body: gzipSync(Buffer.from(`${lines.join("\n")}\n`, "utf8")),
    rowCount: lines.length,
    warnings: [...new Set(warnings)],
    dimensions: [...dimensions],
    metrics: availableFromColumns([...bases]),
  };
}
