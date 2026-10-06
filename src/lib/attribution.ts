export const ATTRIBUTION_STORAGE_KEY = "af_attribution";

const MAX = {
  utm: 100,
  clickId: 200,
  landingPage: 200,
  referrer: 500,
} as const;

export interface LeadAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  landing_page?: string;
  referrer?: string;
  lead_source?: string;
  lead_medium?: string;
}

export type AttributionInput = Partial<Record<keyof LeadAttribution, string | undefined>>;

const SEARCH_ENGINES = ["google.", "bing.", "yahoo.", "duckduckgo.", "baidu.", "yandex."];

function trimField(value: string | undefined, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/[\r\n]+/g, " ").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function readParam(url: URL, key: string, max: number): string | undefined {
  return trimField(url.searchParams.get(key) ?? undefined, max);
}

function inferLeadSource(referrerHost: string | undefined, hasUtm: boolean): { lead_source?: string; lead_medium?: string } {
  if (hasUtm) return {};
  if (!referrerHost) return { lead_source: "direct", lead_medium: "none" };

  const lower = referrerHost.toLowerCase();
  if (SEARCH_ENGINES.some((engine) => lower.includes(engine))) {
    return { lead_source: "organic", lead_medium: "search" };
  }

  return { lead_source: "referral", lead_medium: "referral" };
}

export function buildAttributionFromUrl(href: string, referrer: string): LeadAttribution {
  const url = new URL(href);
  const utm_source = readParam(url, "utm_source", MAX.utm);
  const utm_medium = readParam(url, "utm_medium", MAX.utm);
  const utm_campaign = readParam(url, "utm_campaign", MAX.utm);
  const utm_content = readParam(url, "utm_content", MAX.utm);
  const utm_term = readParam(url, "utm_term", MAX.utm);
  const gclid = readParam(url, "gclid", MAX.clickId);
  const fbclid = readParam(url, "fbclid", MAX.clickId);

  let referrerHost: string | undefined;
  const trimmedReferrer = trimField(referrer, MAX.referrer);
  if (trimmedReferrer) {
    try {
      referrerHost = new URL(trimmedReferrer).host;
    } catch {
      referrerHost = trimmedReferrer.slice(0, MAX.referrer);
    }
  }

  const hasUtm = Boolean(utm_source || utm_medium || utm_campaign || utm_content || utm_term || gclid || fbclid);
  const inferred = inferLeadSource(referrerHost, hasUtm);

  return {
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    gclid,
    fbclid,
    landing_page: trimField(`${url.pathname}${url.search}`, MAX.landingPage),
    referrer: referrerHost,
    ...inferred,
  };
}

export function sanitizeAttributionInput(input: AttributionInput | undefined): LeadAttribution {
  if (!input) return {};

  return {
    utm_source: trimField(input.utm_source, MAX.utm),
    utm_medium: trimField(input.utm_medium, MAX.utm),
    utm_campaign: trimField(input.utm_campaign, MAX.utm),
    utm_content: trimField(input.utm_content, MAX.utm),
    utm_term: trimField(input.utm_term, MAX.utm),
    gclid: trimField(input.gclid, MAX.clickId),
    fbclid: trimField(input.fbclid, MAX.clickId),
    landing_page: trimField(input.landing_page, MAX.landingPage),
    referrer: trimField(input.referrer, MAX.referrer),
    lead_source: trimField(input.lead_source, MAX.utm),
    lead_medium: trimField(input.lead_medium, MAX.utm),
  };
}

export function hasAttributionData(attribution: LeadAttribution): boolean {
  return Object.values(attribution).some(Boolean);
}

export function readStoredAttribution(raw: string | null): LeadAttribution {
  if (!raw) return {};

  try {
    return sanitizeAttributionInput(JSON.parse(raw) as AttributionInput);
  } catch {
    return {};
  }
}

export function attributionRows(attribution: LeadAttribution): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const labels: Record<keyof LeadAttribution, string> = {
    utm_source: "Origem",
    utm_medium: "Mídia",
    utm_campaign: "Campanha",
    utm_content: "Conteúdo",
    utm_term: "Termo",
    gclid: "GCLID",
    fbclid: "FBCLID",
    landing_page: "Landing page",
    referrer: "Referrer",
    lead_source: "Origem inferida",
    lead_medium: "Mídia inferida",
  };

  for (const key of Object.keys(labels) as Array<keyof LeadAttribution>) {
    const value = attribution[key];
    if (value) rows.push([labels[key], value]);
  }

  return rows;
}
