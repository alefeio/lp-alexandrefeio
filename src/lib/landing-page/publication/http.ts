import { z } from "zod";
import type { LandingPageLeadStore } from "@/lib/landing-page/leads/store";
import {
  landingPageClickEvents,
  landingPageMetricDate,
  recordLandingPageMeasurementEvents,
  type LandingPageMetricStore,
} from "@/lib/landing-page/measurement/metrics";
import { LANDING_PAGE_MEASUREMENT_EVENTS } from "@/lib/landing-page/measurement/schema";
import { submitLandingPageForm } from "@/lib/landing-page/forms/submit";
import { documentFromPublicationSnapshot, snapshotHasWhatsAppAction } from "@/lib/landing-page/publication/snapshot";
import type { LandingPagePublicationStore } from "@/lib/landing-page/publication/store";
import { publicationLogEvent, type PublicationLogEvent } from "@/lib/landing-page/publication/service";

export const PUBLIC_FORM_RATE_LIMIT_MESSAGE = "Muitas tentativas foram feitas em pouco tempo. Tente novamente em alguns minutos.";
const PUBLIC_FORM_INVALID_MESSAGE = "Confira os campos e tente novamente.";
const MAX_BODY_BYTES = 8000;

const formBodySchema = z
  .object({
    values: z.record(z.string().max(40), z.string().max(2000)).optional(),
    submissionId: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
    website: z.string().max(200).optional(),
    company_website: z.string().max(200).optional(),
  })
  .strict();

const eventBodySchema = z
  .object({
    eventType: z.enum(LANDING_PAGE_MEASUREMENT_EVENTS),
    sectionId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export function publicRequestOriginAllowed(request: { headers: { get(name: string): string | null } }): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

type PublicDeps = {
  publications: LandingPagePublicationStore;
  leads: LandingPageLeadStore;
  metrics: LandingPageMetricStore;
  consumeRateLimit: (projectId: string, now: number) => boolean;
  log?: (event: PublicationLogEvent) => void;
  now?: Date;
};

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" } });
}

async function readJson(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; status: number }> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) return { ok: false, status: 415 };
  if (!publicRequestOriginAllowed(request)) return { ok: false, status: 403 };
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { ok: false, status: 413 };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}

export async function handlePublicLandingForm(
  deps: PublicDeps,
  request: Request,
  params: { slug: string; sectionId: string },
): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return json({ ok: false, message: PUBLIC_FORM_INVALID_MESSAGE }, body.status);
  const parsed = formBodySchema.safeParse(body.value);
  if (!parsed.success) return json({ ok: false, message: PUBLIC_FORM_INVALID_MESSAGE }, 400);
  const page = await deps.publications.findActiveBySlug(params.slug);
  if (!page) return json({ ok: false, message: "Página não encontrada." }, 404);
  const document = documentFromPublicationSnapshot(page.publication.snapshot);
  if (!document) return json({ ok: false, message: "Página não encontrada." }, 404);
  const section = document.sections.find((item) => item.id === params.sectionId && item.type === "FORM");
  const successMessage = section?.type === "FORM" ? section.content.successMessage || "Mensagem enviada." : "Mensagem enviada.";
  const result = await submitLandingPageForm(
    {
      leads: deps.leads,
      metrics: deps.metrics,
      consumeRateLimit: deps.consumeRateLimit,
      now: deps.now,
      log: () => deps.log?.(publicationLogEvent({ projectId: page.projectId, publicationId: page.publication.id, code: "METRIC_WRITE_FAILED" })),
    },
    {
      landingPageProjectId: page.projectId,
      publication: { id: page.publication.id, landingPageProjectId: page.publication.landingPageProjectId },
      formSectionId: params.sectionId,
      document,
      idempotencyKey: parsed.data.submissionId,
      payload: {
        ...(parsed.data.values ?? {}),
        website: parsed.data.website ?? "",
        company_website: parsed.data.company_website ?? "",
      },
    },
  );
  if (!result.ok && result.code === "RATE_LIMITED") return json({ ok: false, message: PUBLIC_FORM_RATE_LIMIT_MESSAGE }, 429);
  if (!result.ok) return json({ ok: false, message: PUBLIC_FORM_INVALID_MESSAGE }, 400);
  return json({ ok: true, accepted: true, successMessage }, 200);
}

export async function handlePublicLandingEvent(
  deps: Pick<PublicDeps, "publications" | "metrics" | "log" | "now">,
  request: Request,
  params: { slug: string },
): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return json({ ok: false }, body.status);
  const parsed = eventBodySchema.safeParse(body.value);
  if (!parsed.success || parsed.data.eventType === "FORM_SUBMIT") return json({ ok: false }, 400);
  const page = await deps.publications.findActiveBySlug(params.slug);
  if (!page) return json({ ok: false }, 404);
  const enabled = new Set(page.publication.snapshot.measurement.enabledEvents);
  if (parsed.data.eventType === "WHATSAPP_CLICK" && !snapshotHasWhatsAppAction(page.publication.snapshot)) return json({ ok: false }, 400);
  const requested = parsed.data.eventType === "WHATSAPP_CLICK" ? landingPageClickEvents("WHATSAPP") : [parsed.data.eventType];
  const events = requested.filter((event) => event !== "FORM_SUBMIT" && enabled.has(event));
  if (events.length === 0 || !enabled.has(parsed.data.eventType)) return json({ ok: false }, 400);
  try {
    await recordLandingPageMeasurementEvents({
      source: "PUBLIC",
      sink: deps.metrics,
      landingPageProjectId: page.projectId,
      publicationId: page.publication.id,
      events,
      date: landingPageMetricDate(deps.now),
    });
  } catch {
    deps.log?.(publicationLogEvent({ projectId: page.projectId, publicationId: page.publication.id, code: "METRIC_WRITE_FAILED" }));
  }
  return new Response(null, { status: 204, headers: { "x-content-type-options": "nosniff" } });
}
