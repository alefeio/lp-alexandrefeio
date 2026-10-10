import { z } from "zod";

export const PROJECT_OBJECTIVES = ["LEADS", "SALES", "WHATSAPP", "STORE_VISITS", "AWARENESS", "UNDEFINED"] as const;
export const DESTINATION_TYPES = ["LANDING_PAGE", "WEBSITE", "WHATSAPP", "INSTAGRAM", "MARKETPLACE", "OTHER", "UNDEFINED"] as const;

const name = z.string().trim().min(2, "Dê um nome ao projeto.").max(80, "Use um nome mais curto.");
const optionalText = z
  .string()
  .trim()
  .max(160)
  .optional()
  .transform((value) => (value ? value : null));

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      const trimmed = value?.trim() ?? "";
      if (!trimmed) return null;
      if (!(values as readonly string[]).includes(trimmed)) {
        ctx.addIssue({ code: "custom", message: "Opção inválida." });
        return z.NEVER;
      }
      return trimmed as T[number];
    });

const optionalTriState = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (!value || value === "") return null;
    if (value === "yes") return true;
    if (value === "no") return false;
    ctx.addIssue({ code: "custom", message: "Opção inválida." });
    return z.NEVER;
  });

export function parseMoneyToCents(raw: string | undefined): number | null | "invalid" {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(value)) return "invalid";
  const cents = Math.round(Number(value.replace(",", ".")) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 1_000_000_000) return "invalid";
  return cents;
}

const moneyField = z.string().optional().transform((value, ctx) => {
  const parsed = parseMoneyToCents(value);
  if (parsed === "invalid") {
    ctx.addIssue({ code: "custom", message: "Informe um valor em reais, sem centavos soltos demais." });
    return z.NEVER;
  }
  return parsed;
});

const website = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
      return url.toString();
    } catch {
      ctx.addIssue({ code: "custom", message: "Use um endereço que comece com http:// ou https://." });
      return z.NEVER;
    }
  });

export const projectInputSchema = z.object({
  name,
  segment: optionalText,
  primaryOffer: optionalText,
  objective: optionalEnum(PROJECT_OBJECTIVES),
  usesGoogleAds: optionalTriState,
  usesMetaAds: optionalTriState,
  destinationType: optionalEnum(DESTINATION_TYPES),
  monthlyMediaBudgetCents: moneyField,
  averageTicketCents: moneyField,
  websiteUrl: website,
  serviceArea: optionalText,
});

export type ProjectInput = z.infer<typeof projectInputSchema>;

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function readProjectForm(formData: FormData): unknown {
  return {
    name: field(formData, "name"),
    segment: field(formData, "segment"),
    primaryOffer: field(formData, "primaryOffer"),
    objective: field(formData, "objective"),
    usesGoogleAds: field(formData, "usesGoogleAds"),
    usesMetaAds: field(formData, "usesMetaAds"),
    destinationType: field(formData, "destinationType"),
    monthlyMediaBudgetCents: field(formData, "monthlyMediaBudget"),
    averageTicketCents: field(formData, "averageTicket"),
    websiteUrl: field(formData, "websiteUrl"),
    serviceArea: field(formData, "serviceArea"),
  };
}
