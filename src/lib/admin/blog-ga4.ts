import { createSign } from "node:crypto";
import { blogMetricRange, type BlogGa4Snapshot, type BlogMetricPeriod } from "@/lib/admin/blog-metrics";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const CACHE_MS = 10 * 60 * 1000;

export const BLOG_GA4_REPORTS = {
  pages: { dimensions: ["pagePath"], metrics: ["screenPageViews", "activeUsers"] },
  series: { dimensions: ["pagePath", "date"], metrics: ["screenPageViews"] },
  sources: { dimensions: ["pagePath", "sessionSource", "sessionMedium"], metrics: ["screenPageViews"] },
} as const;

type Ga4Env = { GA4_PROPERTY_ID?: string; GA4_CLIENT_EMAIL?: string; GA4_PRIVATE_KEY?: string };
type Ga4Config = { propertyId: string; clientEmail: string; privateKey: string };
type CacheEntry = { expiresAt: number; snapshot: BlogGa4Snapshot };

const reportCache = new Map<string, CacheEntry>();
let tokenCache: { key: string; token: string; expiresAt: number } | null = null;
let zoneCache: { key: string; zone: string | null; expiresAt: number } | null = null;

export function clearBlogGa4Cache(): void {
  reportCache.clear();
  tokenCache = null;
  zoneCache = null;
}

export function readGa4Config(env?: Ga4Env): { ok: true; config: Ga4Config } | { ok: false; message: string } {
  const source = env ?? {
    GA4_PROPERTY_ID: process.env.GA4_PROPERTY_ID,
    GA4_CLIENT_EMAIL: process.env.GA4_CLIENT_EMAIL,
    GA4_PRIVATE_KEY: process.env.GA4_PRIVATE_KEY,
  };
  const propertyId = source.GA4_PROPERTY_ID?.trim() ?? "";
  const clientEmail = source.GA4_CLIENT_EMAIL?.trim() ?? "";
  const privateKey = readPrivateKey(source.GA4_PRIVATE_KEY ?? "");
  if (!propertyId || !clientEmail || !privateKey) {
    return { ok: false, message: "A leitura do GA4 ainda não está configurada. Faltam GA4_PROPERTY_ID, GA4_CLIENT_EMAIL ou GA4_PRIVATE_KEY." };
  }
  if (!/^\d+$/.test(propertyId)) {
    return { ok: false, message: "GA4_PROPERTY_ID precisa ser o número da propriedade. O ID de medição G- fica no GTM." };
  }
  if (!clientEmail.endsWith(".gserviceaccount.com")) {
    return { ok: false, message: "GA4_CLIENT_EMAIL precisa ser o e-mail de uma conta de serviço." };
  }
  return { ok: true, config: { propertyId, clientEmail, privateKey } };
}

export async function fetchBlogGa4Snapshot(input: {
  period: BlogMetricPeriod;
  now: Date;
  env?: Ga4Env;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; snapshot: BlogGa4Snapshot } | { ok: false; status: "unconfigured" | "unavailable"; message: string }> {
  const config = readGa4Config(input.env);
  if (!config.ok) return { ok: false, status: "unconfigured", message: config.message };
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const token = await accessToken(config.config, fetchImpl);
    const propertyZone = await propertyTimeZone(config.config.propertyId, token, fetchImpl);
    const range = blogMetricRange(input.period, input.now, propertyZone);
    const cacheKey = `${config.config.propertyId}:${input.period}:${range.startDate}:${range.endDate}:${propertyZone ?? "unknown"}`;
    const cached = reportCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return { ok: true, snapshot: cached.snapshot };
    const [pages, series, sources] = await Promise.all([
      runReport(config.config.propertyId, token, range, BLOG_GA4_REPORTS.pages.dimensions, BLOG_GA4_REPORTS.pages.metrics, fetchImpl),
      runReport(config.config.propertyId, token, range, BLOG_GA4_REPORTS.series.dimensions, BLOG_GA4_REPORTS.series.metrics, fetchImpl),
      runReport(config.config.propertyId, token, range, BLOG_GA4_REPORTS.sources.dimensions, BLOG_GA4_REPORTS.sources.metrics, fetchImpl),
    ]);
    const reportedZone = pages.timeZone ?? series.timeZone ?? sources.timeZone;
    const snapshot: BlogGa4Snapshot = {
      timeZone: propertyZone ?? reportedZone,
      rangeAligned: propertyZone != null,
      range,
      pages: pages.rows.map((row) => ({ pagePath: row.dimensions[0] ?? "", views: metric(row, 0), activeUsers: metric(row, 1) })),
      filteredActiveUsers: pages.truncated || pages.totals.length < 2 ? null : metric(pages.totals, 1),
      pagesTruncated: pages.truncated,
      series: series.rows.map((row) => ({ pagePath: row.dimensions[0] ?? "", date: row.dimensions[1] ?? "", views: metric(row, 0) })),
      seriesTruncated: series.truncated,
      sources: sources.rows.map((row) => ({ pagePath: row.dimensions[0] ?? "", source: row.dimensions[1] ?? "", medium: row.dimensions[2] ?? "", views: metric(row, 0) })),
      sourcesTruncated: sources.truncated,
    };
    reportCache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, snapshot });
    return { ok: true, snapshot };
  } catch (error) {
    const message = error instanceof Ga4RequestError ? error.publicMessage : "Não foi possível consultar o GA4 agora.";
    return { ok: false, status: "unavailable", message };
  }
}

class Ga4RequestError extends Error {
  constructor(readonly publicMessage: string) {
    super(publicMessage);
  }
}

async function accessToken(config: Ga4Config, fetchImpl: typeof fetch): Promise<string> {
  const cacheKey = `${config.clientEmail}:${config.propertyId}`;
  if (tokenCache && tokenCache.key === cacheKey && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const assertion = signServiceJwt(config.clientEmail, config.privateKey, Math.floor(Date.now() / 1000));
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Ga4RequestError(statusMessage(response.status, "token"));
  const body = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof body.access_token !== "string" || !body.access_token) throw new Ga4RequestError("A credencial do GA4 não autorizou a consulta.");
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
  tokenCache = { key: cacheKey, token: body.access_token, expiresAt: Date.now() + Math.max(30, expiresIn - 60) * 1000 };
  return body.access_token;
}

async function runReport(
  propertyId: string,
  token: string,
  range: { startDate: string; endDate: string },
  dimensions: readonly string[],
  metrics: readonly string[],
  fetchImpl: typeof fetch,
): Promise<{ rows: Array<{ dimensions: string[]; metrics: number[] }>; totals: number[]; truncated: boolean; timeZone: string | null }> {
  const response = await fetchImpl(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      dateRanges: [range],
      dimensions: dimensions.map((name) => ({ name })),
      metrics: metrics.map((name) => ({ name })),
      dimensionFilter: {
        filter: {
          fieldName: "pagePath",
          stringFilter: { matchType: "BEGINS_WITH", value: "/blog", caseSensitive: false },
        },
      },
      metricAggregations: ["TOTAL"],
      limit: "10000",
      keepEmptyRows: false,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Ga4RequestError(statusMessage(response.status, "report"));
  const body = (await response.json()) as {
    rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
    totals?: Array<{ metricValues?: Array<{ value?: string }> }>;
    rowCount?: number;
    metadata?: { timeZone?: string };
  };
  const rows = (body.rows ?? []).map((row) => ({
    dimensions: (row.dimensionValues ?? []).map((item) => item.value ?? ""),
    metrics: (row.metricValues ?? []).map((item) => numberValue(item.value)),
  }));
  const totals = (body.totals?.[0]?.metricValues ?? []).map((item) => numberValue(item.value));
  const timeZone = typeof body.metadata?.timeZone === "string" ? body.metadata.timeZone : null;
  return { rows, totals, truncated: (body.rowCount ?? rows.length) > rows.length, timeZone };
}

async function propertyTimeZone(propertyId: string, token: string, fetchImpl: typeof fetch): Promise<string | null> {
  if (zoneCache && zoneCache.key === propertyId && zoneCache.expiresAt > Date.now()) return zoneCache.zone;
  let zone: string | null = null;
  try {
    const response = await fetchImpl(`https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) {
      const body = (await response.json()) as { timeZone?: unknown };
      zone = typeof body.timeZone === "string" && isTimeZone(body.timeZone) ? body.timeZone : null;
    }
  } catch {
    zone = null;
  }
  zoneCache = { key: propertyId, zone, expiresAt: Date.now() + CACHE_MS };
  return zone;
}

function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function statusMessage(status: number, stage: "token" | "report"): string {
  if (status === 429) return quotaMessage();
  if (status === 401) return "A credencial do GA4 não autorizou a consulta.";
  if (status === 403) return stage === "token" ? "A credencial do GA4 não autorizou a consulta." : "A conta de serviço não tem permissão de leitura nesta propriedade.";
  return "O GA4 recusou ou não respondeu a consulta.";
}

function signServiceJwt(email: string, privateKey: string, nowSec: number): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600 }));
  const unsigned = `${header}.${claim}`;
  try {
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    return `${unsigned}.${signer.sign(privateKey).toString("base64url")}`;
  } catch {
    throw new Ga4RequestError("A credencial do GA4 não pôde ser usada.");
  }
}

function readPrivateKey(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
  return key.replace(/\\n/g, "\n").trim();
}

function numberValue(value: string | undefined): number {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function metric(row: { metrics: number[] } | number[] | undefined, index: number): number {
  if (!row) return 0;
  if (Array.isArray(row)) return row[index] ?? 0;
  return row.metrics[index] ?? 0;
}

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function quotaMessage(): string {
  return "A cota do GA4 limitou esta consulta. Tente de novo em alguns minutos.";
}
