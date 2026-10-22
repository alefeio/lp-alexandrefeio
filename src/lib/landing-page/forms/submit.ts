import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { validateLandingPageFormPayload } from "@/lib/landing-page/forms/payload";
import { landingPageFormContentSchema } from "@/lib/landing-page/forms/schema";
import type { LandingPageLeadStore } from "@/lib/landing-page/leads/store";
import { landingPageMetricDate, type LandingPageMetricStore } from "@/lib/landing-page/measurement/metrics";

export type LandingPageFormSubmission =
  | { ok: true; accepted: true; leadId: string; duplicate: boolean }
  | { ok: true; accepted: false; reason: "HONEYPOT" }
  | { ok: false; code: "INVALID" | "RATE_LIMITED" | "UNAVAILABLE" };

/**
 * Núcleo do envio. Não é rota HTTP.
 * A persistência do lead vem antes da métrica. Se a métrica falhar, o envio continua aceito
 * e o retry com a mesma chave não cria outro lead.
 * O log operacional não recebe o payload.
 */
export async function submitLandingPageForm(
  deps: {
    leads: LandingPageLeadStore;
    metrics: LandingPageMetricStore;
    consumeRateLimit: (projectId: string, now: number) => boolean;
    log?: (event: { code: "METRIC_WRITE_FAILED" }) => void;
    now?: Date;
    createId?: () => string;
  },
  input: {
    landingPageProjectId: string;
    publication: { id: string; landingPageProjectId: string };
    formSectionId: string;
    document: LandingPageDocumentV1;
    payload: unknown;
    idempotencyKey: string;
  },
): Promise<LandingPageFormSubmission> {
  if (!input.publication.id || input.publication.landingPageProjectId !== input.landingPageProjectId) {
    return { ok: false, code: "UNAVAILABLE" };
  }
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(input.idempotencyKey)) return { ok: false, code: "INVALID" };

  const section = input.document.sections.find((item) => item.id === input.formSectionId && item.type === "FORM" && item.enabled);
  if (!section || section.type !== "FORM") return { ok: false, code: "INVALID" };
  const content = landingPageFormContentSchema.safeParse(section.content);
  if (!content.success) return { ok: false, code: "INVALID" };

  const validated = validateLandingPageFormPayload(content.data, input.payload);
  if (!validated.ok && validated.reason === "HONEYPOT") return { ok: true, accepted: false, reason: "HONEYPOT" };
  if (!validated.ok) return { ok: false, code: "INVALID" };

  const now = deps.now ?? new Date();
  const existing = await deps.leads.listForProject(input.landingPageProjectId);
  const previous = existing.find((lead) => lead.idempotencyKey === input.idempotencyKey);
  if (previous) return { ok: true, accepted: true, leadId: previous.id, duplicate: true };

  if (!deps.consumeRateLimit(input.landingPageProjectId, now.getTime())) return { ok: false, code: "RATE_LIMITED" };

  const saved = await deps.leads.insert({
    id: deps.createId?.() ?? crypto.randomUUID(),
    landingPageProjectId: input.landingPageProjectId,
    publicationId: input.publication.id,
    formSectionId: input.formSectionId,
    submittedData: validated.data,
    idempotencyKey: input.idempotencyKey,
  });
  if (!saved.created) return { ok: true, accepted: true, leadId: saved.record.id, duplicate: true };

  try {
    await deps.metrics.increment({
      landingPageProjectId: input.landingPageProjectId,
      publicationId: input.publication.id,
      date: landingPageMetricDate(now),
      eventType: "FORM_SUBMIT",
    });
  } catch {
    deps.log?.({ code: "METRIC_WRITE_FAILED" });
  }
  return { ok: true, accepted: true, leadId: saved.record.id, duplicate: false };
}
