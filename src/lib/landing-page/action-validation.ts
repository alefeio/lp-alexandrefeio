import { buildSafeWhatsAppUrl, landingPageActionSchema, type LandingPageAction } from "@/lib/landing-page/actions";
import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";

const SAFE_ANCHOR = /^[A-Za-z0-9_-]{1,64}$/;

export type LandingPageActionValidation =
  | { ok: true; action: LandingPageAction }
  | { ok: false; code: "INVALID_ACTION" };

/**
 * Confere a ação contra a página. Não grava e não abre destino.
 * FORM_ANCHOR precisa de uma seção FORM habilitada na mesma landing.
 */
export function validateLandingPageAction(action: unknown, document: LandingPageDocumentV1): LandingPageActionValidation {
  const parsed = landingPageActionSchema.safeParse(action);
  if (!parsed.success) return { ok: false, code: "INVALID_ACTION" };
  if (parsed.data.type === "WHATSAPP") {
    if (!buildSafeWhatsAppUrl(parsed.data.phone, parsed.data.message)) return { ok: false, code: "INVALID_ACTION" };
  }
  if (parsed.data.type === "FORM_ANCHOR") {
    const sectionId = parsed.data.sectionId;
    if (!sectionId || !SAFE_ANCHOR.test(sectionId)) return { ok: false, code: "INVALID_ACTION" };
    const section = document.sections.find((item) => item.id === sectionId && item.type === "FORM" && item.enabled);
    if (!section) return { ok: false, code: "INVALID_ACTION" };
  }
  return { ok: true, action: parsed.data };
}
