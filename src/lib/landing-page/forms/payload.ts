import { sanitizeWhatsAppPhone } from "@/lib/landing-page/actions";
import {
  LANDING_PAGE_FORM_LIMITS,
  normalizeLandingPageFormField,
  type LandingPageFormContentV1,
  type LandingPageFormField,
} from "@/lib/landing-page/forms/schema";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HONEYPOT_KEYS = new Set(["website", "company_website"]);

export type LandingPageFormPayloadResult =
  | { ok: true; data: Record<string, string> }
  | { ok: false; reason: "HONEYPOT" | "INVALID" | "OVERSIZED" };

function limitsFor(field: LandingPageFormField): number {
  switch (field.type) {
    case "NAME":
      return LANDING_PAGE_FORM_LIMITS.name;
    case "EMAIL":
      return LANDING_PAGE_FORM_LIMITS.email;
    case "PHONE":
      return LANDING_PAGE_FORM_LIMITS.phoneInput;
    case "COMPANY":
      return LANDING_PAGE_FORM_LIMITS.company;
    case "MESSAGE":
      return LANDING_PAGE_FORM_LIMITS.message;
    default: {
      const _never: never = field.type;
      return _never;
    }
  }
}

function normalizeValue(field: LandingPageFormField, value: string): string | null {
  const trimmed = value.trim();
  if (/[<>]/.test(trimmed)) return null;
  if (trimmed.length > limitsFor(field)) return null;
  if (field.type === "EMAIL") {
    if (!EMAIL_PATTERN.test(trimmed) || trimmed.length > LANDING_PAGE_FORM_LIMITS.email) return null;
    return trimmed;
  }
  if (field.type === "PHONE") {
    if (/[<>]/.test(value) || value.trim().length > LANDING_PAGE_FORM_LIMITS.phoneInput) return null;
    return sanitizeWhatsAppPhone(trimmed);
  }
  if (!trimmed) return null;
  return trimmed;
}

/**
 * Valida o corpo do envio contra o formulário da seção.
 * Não grava lead, não mede e não registra o valor rejeitado.
 */
export function validateLandingPageFormPayload(content: LandingPageFormContentV1, payload: unknown): LandingPageFormPayloadResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, reason: "INVALID" };
  let encoded = "";
  try {
    encoded = JSON.stringify(payload);
  } catch {
    return { ok: false, reason: "INVALID" };
  }
  if (encoded.length > LANDING_PAGE_FORM_LIMITS.payloadJson) return { ok: false, reason: "OVERSIZED" };

  const source = payload as Record<string, unknown>;
  for (const key of HONEYPOT_KEYS) {
    const trap = source[key];
    if (typeof trap === "string" && trap.trim()) return { ok: false, reason: "HONEYPOT" };
  }

  const fields = content.fields.map(normalizeLandingPageFormField).filter((field): field is LandingPageFormField => Boolean(field));
  const allowed = new Set(fields.map((field) => field.id));
  for (const key of Object.keys(source)) {
    if (HONEYPOT_KEYS.has(key)) continue;
    if (!allowed.has(key)) return { ok: false, reason: "INVALID" };
  }

  const data: Record<string, string> = {};
  for (const field of fields) {
    const raw = source[field.id];
    const text = typeof raw === "string" ? raw : "";
    if (!text.trim()) {
      if (field.required) return { ok: false, reason: "INVALID" };
      continue;
    }
    const normalized = normalizeValue(field, text);
    if (!normalized) return { ok: false, reason: "INVALID" };
    data[field.id] = normalized;
  }
  return { ok: true, data };
}
