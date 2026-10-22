import { z } from "zod";
import { LANDING_PAGE_LIMITS } from "@/lib/landing-page/constants";

export const LANDING_PAGE_FORM_FIELD_TYPES = ["NAME", "EMAIL", "PHONE", "COMPANY", "MESSAGE"] as const;

export type LandingPageFormFieldType = (typeof LANDING_PAGE_FORM_FIELD_TYPES)[number];

export const LANDING_PAGE_FORM_LIMITS = {
  maxFields: 8,
  name: 120,
  email: 254,
  phoneInput: 32,
  company: 160,
  message: 2000,
  label: 80,
  placeholder: 120,
  successMessage: 400,
  payloadJson: 8000,
} as const;

const LEGACY_FORM_FIELDS = ["name", "email", "phone", "message"] as const;

export type LandingPageLegacyFormField = (typeof LEGACY_FORM_FIELDS)[number];

const LEGACY_FORM_FIELD_DEFAULTS: Record<LandingPageLegacyFormField, LandingPageFormField> = {
  name: { id: "name", type: "NAME", label: "Nome", required: true },
  email: { id: "email", type: "EMAIL", label: "E-mail", required: true },
  phone: { id: "phone", type: "PHONE", label: "Telefone", required: true },
  message: { id: "message", type: "MESSAGE", label: "Mensagem", required: true },
};

function rejectsMarkup(value: string): boolean {
  return !/[<>]/.test(value);
}

const plainText = (max: number) =>
  z.string().trim().min(1).max(max).refine(rejectsMarkup, { message: "HTML não é aceito." });

const optionalPlainText = (max: number) =>
  z.string().trim().max(max).refine((value) => value.length === 0 || rejectsMarkup(value), { message: "HTML não é aceito." }).optional();

export const landingPageFormFieldObjectSchema = z
  .object({
    id: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/),
    type: z.enum(LANDING_PAGE_FORM_FIELD_TYPES),
    label: plainText(LANDING_PAGE_FORM_LIMITS.label),
    required: z.boolean(),
    placeholder: optionalPlainText(LANDING_PAGE_FORM_LIMITS.placeholder),
  })
  .strict();

export type LandingPageFormField = z.infer<typeof landingPageFormFieldObjectSchema>;

export const landingPageFormFieldSchema = z.union([z.enum(LEGACY_FORM_FIELDS), landingPageFormFieldObjectSchema]);

export type LandingPageFormFieldInput = z.infer<typeof landingPageFormFieldSchema>;

export function normalizeLandingPageFormField(field: LandingPageFormFieldInput): LandingPageFormField | null {
  if (typeof field === "string") return { ...LEGACY_FORM_FIELD_DEFAULTS[field] };
  return field;
}

export function landingPageFormFieldId(field: LandingPageFormFieldInput): string {
  return typeof field === "string" ? field : field.id;
}

const FORBIDDEN_CONTENT_KEYS = new Set(["html", "rawHtml", "script", "javascript", "customCode"]);

export const landingPageFormContentSchema = z
  .object({
    heading: optionalPlainText(LANDING_PAGE_LIMITS.maxHeadline),
    intro: optionalPlainText(LANDING_PAGE_LIMITS.maxMediumText),
    fields: z.array(landingPageFormFieldSchema).min(1).max(LANDING_PAGE_FORM_LIMITS.maxFields),
    consentEnabled: z.boolean().optional(),
    consentText: optionalPlainText(LANDING_PAGE_LIMITS.maxMediumText),
    submitLabel: optionalPlainText(LANDING_PAGE_LIMITS.maxShortText),
    successMessage: optionalPlainText(LANDING_PAGE_FORM_LIMITS.successMessage),
  })
  .strict()
  .superRefine((content, ctx) => {
    for (const key of Object.keys(content)) {
      if (FORBIDDEN_CONTENT_KEYS.has(key)) {
        ctx.addIssue({ code: "custom", message: "Campo proibido.", path: [key] });
      }
    }
    const ids = content.fields.map(landingPageFormFieldId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", message: "Há campos com o mesmo identificador.", path: ["fields"] });
    }
  });

export type LandingPageFormContentV1 = z.infer<typeof landingPageFormContentSchema>;
