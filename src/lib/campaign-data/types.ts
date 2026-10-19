export const SOURCE_PLATFORMS = ["GOOGLE_ADS", "META_ADS", "UNKNOWN"] as const;
export type SourcePlatform = (typeof SOURCE_PLATFORMS)[number];

export const FILE_FORMATS = ["CSV", "XLSX"] as const;
export type CampaignFileFormat = (typeof FILE_FORMATS)[number];

export const IMPORT_STATUSES = [
  "PENDING_UPLOAD",
  "UPLOADED",
  "NEEDS_SHEET_SELECTION",
  "NEEDS_MAPPING",
  "PROCESSING",
  "READY",
  "FAILED",
  "DELETED",
] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const DIMENSIONS = [
  "DATE",
  "CAMPAIGN",
  "AD_GROUP",
  "AD_SET",
  "AD",
  "KEYWORD",
  "SEARCH_TERM",
  "PLACEMENT",
  "DEVICE",
  "NETWORK",
] as const;
export type DimensionId = (typeof DIMENSIONS)[number];

export const BASE_METRICS = [
  "IMPRESSIONS",
  "CLICKS",
  "SPEND",
  "CONVERSIONS",
  "CONVERSION_VALUE",
  "LEADS",
  "QUALIFIED_LEADS",
  "SALES",
  "REVENUE",
] as const;
export type BaseMetricId = (typeof BASE_METRICS)[number];

export const DERIVED_METRICS = [
  "CTR",
  "CPC",
  "CONVERSION_RATE",
  "CPA",
  "ROAS",
  "CPL",
  "QUALIFICATION_RATE",
  "COST_PER_QUALIFIED_LEAD",
] as const;
export type DerivedMetricId = (typeof DERIVED_METRICS)[number];

export const CANONICAL_FIELDS = [...DIMENSIONS, ...BASE_METRICS] as const;
export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const NUMBER_LOCALES = ["PT_BR", "EN_US"] as const;
export type NumberLocale = (typeof NUMBER_LOCALES)[number];

export const CURRENCIES = ["BRL", "USD", "OTHER"] as const;
export type CampaignCurrency = (typeof CURRENCIES)[number];

export type ColumnSuggestion = {
  index: number;
  header: string;
  canonical: CanonicalField | null;
  ambiguous: boolean;
  sourceRatio: boolean;
};

export type ConfirmedColumn = {
  index: number;
  header: string;
  canonical: CanonicalField | null;
};

export type ParsedSheet = {
  name: string;
  headers: string[];
  rows: string[][];
};

export type ParsedWorkbook = {
  format: CampaignFileFormat;
  sheets: ParsedSheet[];
  warnings: string[];
};
