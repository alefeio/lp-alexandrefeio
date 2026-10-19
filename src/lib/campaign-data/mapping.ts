import type { CanonicalField, ColumnSuggestion, SourcePlatform } from "@/lib/campaign-data/types";

const RATIO_HEADERS = new Set([
  "ctr",
  "cpc",
  "cpa",
  "roas",
  "taxa de conversao",
  "conversion rate",
  "custo por conversao",
  "cost / conv",
  "cost per conversion",
]);

const AMBIGUOUS = new Set(["results", "result", "resultados", "resultado"]);

const ALIASES: Record<string, CanonicalField> = {
  date: "DATE",
  day: "DATE",
  data: "DATE",
  dia: "DATE",
  campaign: "CAMPAIGN",
  "campaign name": "CAMPAIGN",
  campanha: "CAMPAIGN",
  "nome da campanha": "CAMPAIGN",
  "ad group": "AD_GROUP",
  "ad group name": "AD_GROUP",
  "grupo de anuncios": "AD_GROUP",
  "conjunto de anuncios": "AD_SET",
  "nome do conjunto de anuncios": "AD_SET",
  "ad set": "AD_SET",
  "ad set name": "AD_SET",
  ad: "AD",
  "ad name": "AD",
  anuncio: "AD",
  "nome do anuncio": "AD",
  keyword: "KEYWORD",
  "keyword text": "KEYWORD",
  "palavra chave": "KEYWORD",
  "palavra-chave": "KEYWORD",
  "search term": "SEARCH_TERM",
  "termo de pesquisa": "SEARCH_TERM",
  placement: "PLACEMENT",
  posicionamento: "PLACEMENT",
  device: "DEVICE",
  dispositivo: "DEVICE",
  network: "NETWORK",
  rede: "NETWORK",
  impressions: "IMPRESSIONS",
  impressoes: "IMPRESSIONS",
  clicks: "CLICKS",
  cliques: "CLICKS",
  cost: "SPEND",
  custo: "SPEND",
  "amount spent": "SPEND",
  "valor gasto": "SPEND",
  "valor usado": "SPEND",
  conversions: "CONVERSIONS",
  conversoes: "CONVERSIONS",
  "conversion value": "CONVERSION_VALUE",
  "valor da conversao": "CONVERSION_VALUE",
  "conv value": "CONVERSION_VALUE",
  leads: "LEADS",
  "qualified leads": "QUALIFIED_LEADS",
  "leads qualificados": "QUALIFIED_LEADS",
  sales: "SALES",
  vendas: "SALES",
  compras: "SALES",
  purchases: "SALES",
  revenue: "REVENUE",
  receita: "REVENUE",
  "purchase conversion value": "REVENUE",
};

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function suggestColumns(headers: string[], platform: SourcePlatform = "UNKNOWN"): ColumnSuggestion[] {
  void platform;
  const used = new Set<CanonicalField>();
  return headers.map((header, index) => {
    const key = fold(header);
    if (AMBIGUOUS.has(key)) {
      return { index, header, canonical: null, ambiguous: true, sourceRatio: false };
    }
    if (RATIO_HEADERS.has(key)) {
      return { index, header, canonical: null, ambiguous: false, sourceRatio: true };
    }
    const canonical = ALIASES[key] ?? null;
    if (!canonical || used.has(canonical)) {
      return { index, header, canonical: null, ambiguous: false, sourceRatio: false };
    }
    used.add(canonical);
    return { index, header, canonical, ambiguous: false, sourceRatio: false };
  });
}

export function platformLabel(platform: SourcePlatform): string {
  if (platform === "GOOGLE_ADS") return "Google Ads";
  if (platform === "META_ADS") return "Meta Ads";
  return "Não sei / Outro";
}
