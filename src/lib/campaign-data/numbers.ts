import type { CampaignCurrency, NumberLocale } from "@/lib/campaign-data/types";

export type ParsedNumber =
  | { ok: true; value: number }
  | { ok: false; reason: "EMPTY" | "PERCENT" | "AMBIGUOUS" | "INVALID" };

function cleaned(raw: string): string {
  return raw.replace(/\s/g, "").replace(/r\$/i, "").replace(/us\$/i, "").replace(/^\$/, "");
}

export function detectNumberLocale(samples: string[]): NumberLocale | "AMBIGUOUS" | "UNKNOWN" {
  let pt = false;
  let en = false;
  for (const sample of samples) {
    const value = cleaned(sample);
    if (!value || value.endsWith("%")) continue;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(value) || /^\d+,\d+$/.test(value)) pt = true;
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(value) || /^\d+\.\d+$/.test(value)) en = true;
  }
  if (pt && en) return "AMBIGUOUS";
  if (pt) return "PT_BR";
  if (en) return "EN_US";
  return "UNKNOWN";
}

export function detectCurrency(samples: string[]): CampaignCurrency {
  const joined = samples.join(" ");
  const brl = /r\$/i.test(joined);
  const dollar = /\$/.test(joined.replace(/r\$/gi, ""));
  if (brl && dollar) return "OTHER";
  if (brl) return "BRL";
  if (dollar) return "USD";
  return "OTHER";
}

export function parseLocalizedNumber(raw: string, locale: NumberLocale): ParsedNumber {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "EMPTY" };
  if (trimmed.includes("%")) return { ok: false, reason: "PERCENT" };
  const value = cleaned(trimmed);
  if (!value) return { ok: false, reason: "EMPTY" };
  if (locale === "PT_BR") {
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(value) || /^\d+(,\d+)?$/.test(value)) {
      const parsed = Number(value.replaceAll(".", "").replace(",", "."));
      return Number.isFinite(parsed) ? { ok: true, value: parsed } : { ok: false, reason: "INVALID" };
    }
    return { ok: false, reason: "AMBIGUOUS" };
  }
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(value) || /^\d+(\.\d+)?$/.test(value)) {
    const parsed = Number(value.replaceAll(",", ""));
    return Number.isFinite(parsed) ? { ok: true, value: parsed } : { ok: false, reason: "INVALID" };
  }
  return { ok: false, reason: "AMBIGUOUS" };
}
