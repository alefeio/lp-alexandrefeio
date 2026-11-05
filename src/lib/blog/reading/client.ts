import { readStoredAttribution } from "@/lib/attribution";
import { BLOG_READING_SCHEMA_VERSION } from "@/lib/blog/reading/constants";
import {
  BLOG_READING_INDEX_KEY,
  isBlogReaderUuid,
  readOrCreateBlogReaderId,
  readOrCreateBlogSessionId,
  type BlogReadingStorage,
} from "@/lib/blog/reading/identity";
import { journeyPath } from "@/lib/product-journey/paths";

export type BlogReadingSendBody = {
  schemaVersion: number;
  clientReadingId: string;
  blogPostId: string;
  anonymousId: string;
  sessionId: string;
  activeTimeMs: number;
  maxScrollPercent: number;
  reachedEnd: boolean;
  ended: boolean;
  analyticsConsent: true;
  consentUpdatedAt: number;
  attribution?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    referrer?: string;
  };
  click?: {
    eventId: string;
    ctaName: string;
    destinationType: "course" | "service";
    targetPath?: string;
  };
};

export type BlogReadingSendResult =
  | { kind: "ok"; status: 200 | 202 }
  | { kind: "closed"; status: 409 }
  | { kind: "reject"; status: 400 | 404 }
  | { kind: "limited"; status: 429 }
  | { kind: "disabled"; status: 404 | 503 }
  | { kind: "network" }
  | { kind: "other"; status: number };

type IndexMap = Record<string, { clientReadingId: string }>;

function readIndex(storage: { getItem(key: string): string | null }): IndexMap {
  const raw = storage.getItem(BLOG_READING_INDEX_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as IndexMap;
    if (!parsed || typeof parsed !== "object") return {};
    const out: IndexMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value.clientReadingId === "string" && isBlogReaderUuid(value.clientReadingId)) {
        out[key] = { clientReadingId: value.clientReadingId };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function readBlogReadingClientId(storage: { getItem(key: string): string | null }, blogPostId: string): string | null {
  return readIndex(storage)[blogPostId]?.clientReadingId ?? null;
}

export function rememberBlogReadingClientId(
  storage: { getItem(key: string): string | null; setItem(key: string, value: string): void },
  blogPostId: string,
  clientReadingId: string,
): void {
  const index = readIndex(storage);
  index[blogPostId] = { clientReadingId };
  storage.setItem(BLOG_READING_INDEX_KEY, JSON.stringify(index));
}

export function clearBlogReadingClientId(
  storage: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void },
  blogPostId: string,
): void {
  const index = readIndex(storage);
  delete index[blogPostId];
  if (Object.keys(index).length === 0) storage.removeItem(BLOG_READING_INDEX_KEY);
  else storage.setItem(BLOG_READING_INDEX_KEY, JSON.stringify(index));
}

export function resolveBlogReadingIdentities(input: {
  local: BlogReadingStorage;
  session: BlogReadingStorage;
  blogPostId: string;
  now: number;
  randomUUID: () => string;
  renew?: boolean;
}): { anonymousId: string; sessionId: string; clientReadingId: string } {
  const anonymousId = readOrCreateBlogReaderId(input.local, input.now, input.randomUUID);
  const sessionId = readOrCreateBlogSessionId(input.session, input.randomUUID);
  const existing = input.renew ? null : readBlogReadingClientId(input.session, input.blogPostId);
  const clientReadingId = existing ?? input.randomUUID();
  if (!existing) rememberBlogReadingClientId(input.session, input.blogPostId, clientReadingId);
  return { anonymousId, sessionId, clientReadingId };
}

export function buildBlogReadingPayload(input: {
  clientReadingId: string;
  blogPostId: string;
  anonymousId: string;
  sessionId: string;
  activeTimeMs: number;
  maxScrollPercent: number;
  reachedEnd: boolean;
  ended: boolean;
  consentUpdatedAt: number;
  attributionRaw?: string | null;
  click?: { eventId: string; ctaName: string; destinationType: "course" | "service"; targetPath?: string | null };
}): BlogReadingSendBody {
  const attribution = readStoredAttribution(input.attributionRaw ?? null);
  const body: BlogReadingSendBody = {
    schemaVersion: BLOG_READING_SCHEMA_VERSION,
    clientReadingId: input.clientReadingId,
    blogPostId: input.blogPostId,
    anonymousId: input.anonymousId,
    sessionId: input.sessionId,
    activeTimeMs: input.activeTimeMs,
    maxScrollPercent: input.maxScrollPercent,
    reachedEnd: input.reachedEnd,
    ended: input.ended,
    analyticsConsent: true,
    consentUpdatedAt: input.consentUpdatedAt,
  };
  const attr: NonNullable<BlogReadingSendBody["attribution"]> = {};
  if (attribution.utm_source) attr.utm_source = attribution.utm_source;
  if (attribution.utm_medium) attr.utm_medium = attribution.utm_medium;
  if (attribution.utm_campaign) attr.utm_campaign = attribution.utm_campaign;
  if (attribution.referrer) attr.referrer = attribution.referrer;
  if (Object.keys(attr).length > 0) body.attribution = attr;
  if (input.click) {
    const targetPath = input.click.targetPath ? journeyPath(input.click.targetPath) : null;
    body.click = {
      eventId: input.click.eventId,
      ctaName: input.click.ctaName,
      destinationType: input.click.destinationType,
      ...(targetPath ? { targetPath } : {}),
    };
  }
  return body;
}

export async function sendBlogReadingUpdate(
  body: BlogReadingSendBody,
  options?: { fetchImpl?: typeof fetch; keepalive?: boolean },
): Promise<BlogReadingSendResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl("/api/analytics/blog-reading", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: options?.keepalive === true,
    });
    if (response.status === 200 || response.status === 202) return { kind: "ok", status: response.status };
    if (response.status === 409) return { kind: "closed", status: 409 };
    if (response.status === 400 || response.status === 404) {
      if (response.status === 404) return { kind: "disabled", status: 404 };
      return { kind: "reject", status: response.status };
    }
    if (response.status === 429) return { kind: "limited", status: 429 };
    if (response.status === 503) return { kind: "disabled", status: 503 };
    return { kind: "other", status: response.status };
  } catch {
    return { kind: "network" };
  }
}

/** Best effort no abandono. Prefere fetch keepalive; sendBeacon como reserva. */
export function sendBlogReadingBeacon(body: BlogReadingSendBody): void {
  try {
    const payload = JSON.stringify(body);
    void fetch("/api/analytics/blog-reading", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      try {
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          navigator.sendBeacon("/api/analytics/blog-reading", new Blob([payload], { type: "application/json" }));
        }
      } catch {
        // Abandono nunca bloqueia a navegação.
      }
    });
  } catch {
    // Abandono nunca bloqueia a navegação.
  }
}
