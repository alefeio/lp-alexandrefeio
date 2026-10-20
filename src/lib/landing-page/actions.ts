import { z } from "zod";
import { LANDING_PAGE_LIMITS } from "@/lib/landing-page/constants";

const FORBIDDEN_URL_PREFIX = /^(javascript|data|vbscript|file|blob):/i;

export function sanitizeWhatsAppPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export const safeExternalUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => !FORBIDDEN_URL_PREFIX.test(value), { message: "URL insegura" })
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, { message: "URL inválida" });

export const safeInternalRouteSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^\/[A-Za-z0-9/_-]*$/, "Rota interna inválida")
  .refine((value) => !value.includes(".."), { message: "Rota interna inválida" });

const phoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .transform((value, ctx) => {
    const phone = sanitizeWhatsAppPhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Telefone WhatsApp inválido" });
      return z.NEVER;
    }
    return phone;
  });

export const landingPageActionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("WHATSAPP"),
      phone: phoneSchema,
      message: z.string().trim().max(LANDING_PAGE_LIMITS.maxWhatsappMessage).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("EXTERNAL_URL"),
      url: safeExternalUrlSchema,
      label: z.string().trim().min(1).max(LANDING_PAGE_LIMITS.maxShortText).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("INTERNAL_ROUTE"),
      path: safeInternalRouteSchema,
      label: z.string().trim().min(1).max(LANDING_PAGE_LIMITS.maxShortText).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("FORM_ANCHOR"),
      sectionId: z.string().trim().min(1).max(64).optional(),
      label: z.string().trim().min(1).max(LANDING_PAGE_LIMITS.maxShortText).optional(),
    })
    .strict(),
]);

export type LandingPageAction = z.infer<typeof landingPageActionSchema>;
