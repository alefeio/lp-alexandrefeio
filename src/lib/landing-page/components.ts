import { z } from "zod";
import { landingPageActionSchema } from "@/lib/landing-page/actions";
import { LANDING_COMPONENT_TYPES, LANDING_PAGE_LIMITS, type LandingComponentType } from "@/lib/landing-page/constants";

const FORBIDDEN_CONTENT_KEYS = new Set(["html", "rawHtml", "script", "javascript", "customCode"]);

function rejectForbiddenKeys(value: unknown, ctx: z.RefinementCtx) {
  if (!value || typeof value !== "object") return;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN_CONTENT_KEYS.has(key)) {
      ctx.addIssue({ code: "custom", message: `Campo proibido: ${key}`, path: [key] });
    }
  }
}

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

const emptySettings = z.object({}).strict();

const heroContentSchema = z
  .object({
    eyebrow: optionalText(LANDING_PAGE_LIMITS.maxEyebrow),
    headline: text(LANDING_PAGE_LIMITS.maxHeadline),
    subheadline: optionalText(LANDING_PAGE_LIMITS.maxSubheadline),
    primaryCta: landingPageActionSchema.optional(),
    secondaryCta: landingPageActionSchema.optional(),
    imageRef: z.string().trim().max(120).optional(),
  })
  .strict()
  .superRefine(rejectForbiddenKeys);

const benefitsContentSchema = z
  .object({
    heading: optionalText(LANDING_PAGE_LIMITS.maxHeadline),
    items: z
      .array(
        z
          .object({
            title: text(LANDING_PAGE_LIMITS.maxShortText),
            description: text(LANDING_PAGE_LIMITS.maxMediumText),
          })
          .strict(),
      )
      .max(LANDING_PAGE_LIMITS.maxBenefits),
  })
  .strict()
  .superRefine(rejectForbiddenKeys);

const processContentSchema = z
  .object({
    heading: optionalText(LANDING_PAGE_LIMITS.maxHeadline),
    steps: z
      .array(
        z
          .object({
            title: text(LANDING_PAGE_LIMITS.maxShortText),
            description: text(LANDING_PAGE_LIMITS.maxMediumText),
          })
          .strict(),
      )
      .max(LANDING_PAGE_LIMITS.maxProcessSteps),
  })
  .strict()
  .superRefine(rejectForbiddenKeys);

const trustContentSchema = z
  .object({
    heading: optionalText(LANDING_PAGE_LIMITS.maxHeadline),
    intro: optionalText(LANDING_PAGE_LIMITS.maxMediumText),
    items: z
      .array(
        z
          .object({
            title: text(LANDING_PAGE_LIMITS.maxShortText),
            description: text(LANDING_PAGE_LIMITS.maxMediumText),
          })
          .strict(),
      )
      .max(LANDING_PAGE_LIMITS.maxTrustItems),
  })
  .strict()
  .superRefine(rejectForbiddenKeys);

const faqContentSchema = z
  .object({
    heading: optionalText(LANDING_PAGE_LIMITS.maxHeadline),
    items: z
      .array(
        z
          .object({
            question: text(LANDING_PAGE_LIMITS.maxMediumText),
            answer: text(LANDING_PAGE_LIMITS.maxLongText),
          })
          .strict(),
      )
      .max(LANDING_PAGE_LIMITS.maxFaqItems),
  })
  .strict()
  .superRefine(rejectForbiddenKeys);

const ctaContentSchema = z
  .object({
    heading: text(LANDING_PAGE_LIMITS.maxHeadline),
    description: optionalText(LANDING_PAGE_LIMITS.maxMediumText),
    action: landingPageActionSchema,
  })
  .strict()
  .superRefine(rejectForbiddenKeys);

const formFieldSchema = z.enum(["name", "email", "phone", "message"]);

const formContentSchema = z
  .object({
    heading: optionalText(LANDING_PAGE_LIMITS.maxHeadline),
    intro: optionalText(LANDING_PAGE_LIMITS.maxMediumText),
    fields: z.array(formFieldSchema).min(1).max(4),
    consentEnabled: z.boolean().optional(),
    consentText: optionalText(LANDING_PAGE_LIMITS.maxMediumText),
    submitLabel: optionalText(LANDING_PAGE_LIMITS.maxShortText),
  })
  .strict()
  .superRefine(rejectForbiddenKeys);

const contactContentSchema = z
  .object({
    heading: optionalText(LANDING_PAGE_LIMITS.maxHeadline),
    phone: optionalText(40),
    whatsapp: optionalText(40),
    email: z.union([z.string().trim().email().max(160), z.literal("")]).optional(),
    addressText: optionalText(LANDING_PAGE_LIMITS.maxMediumText),
  })
  .strict()
  .superRefine(rejectForbiddenKeys);

const footerContentSchema = z
  .object({
    brandText: optionalText(LANDING_PAGE_LIMITS.maxShortText),
    copyrightText: optionalText(LANDING_PAGE_LIMITS.maxMediumText),
    links: z
      .array(
        z
          .object({
            label: text(LANDING_PAGE_LIMITS.maxShortText),
            action: landingPageActionSchema,
          })
          .strict(),
      )
      .max(LANDING_PAGE_LIMITS.maxFooterLinks),
  })
  .strict()
  .superRefine(rejectForbiddenKeys);

export const COMPONENT_REGISTRY_V1 = {
  HERO: {
    type: "HERO" as const,
    variants: ["default", "split"] as const,
    contentSchema: heroContentSchema,
    settingsSchema: emptySettings,
  },
  BENEFITS: {
    type: "BENEFITS" as const,
    variants: ["default", "grid"] as const,
    contentSchema: benefitsContentSchema,
    settingsSchema: emptySettings,
  },
  PROCESS: {
    type: "PROCESS" as const,
    variants: ["default", "numbered"] as const,
    contentSchema: processContentSchema,
    settingsSchema: emptySettings,
  },
  TRUST: {
    type: "TRUST" as const,
    variants: ["default"] as const,
    contentSchema: trustContentSchema,
    settingsSchema: emptySettings,
  },
  FAQ: {
    type: "FAQ" as const,
    variants: ["default"] as const,
    contentSchema: faqContentSchema,
    settingsSchema: emptySettings,
  },
  CTA: {
    type: "CTA" as const,
    variants: ["default", "banner"] as const,
    contentSchema: ctaContentSchema,
    settingsSchema: emptySettings,
  },
  FORM: {
    type: "FORM" as const,
    variants: ["default"] as const,
    contentSchema: formContentSchema,
    settingsSchema: emptySettings,
  },
  CONTACT: {
    type: "CONTACT" as const,
    variants: ["default"] as const,
    contentSchema: contactContentSchema,
    settingsSchema: emptySettings,
  },
  FOOTER: {
    type: "FOOTER" as const,
    variants: ["default"] as const,
    contentSchema: footerContentSchema,
    settingsSchema: emptySettings,
  },
} as const;

export type ComponentRegistryV1 = typeof COMPONENT_REGISTRY_V1;

const sectionIdSchema = z.string().trim().min(1).max(64);
const sectionOrderSchema = z.number().int().min(0).max(LANDING_PAGE_LIMITS.maxSections);

export const landingPageSectionSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: sectionIdSchema,
      type: z.literal("HERO"),
      variant: z.enum(COMPONENT_REGISTRY_V1.HERO.variants),
      order: sectionOrderSchema,
      enabled: z.boolean(),
      content: heroContentSchema,
      settings: emptySettings,
    })
    .strict(),
  z
    .object({
      id: sectionIdSchema,
      type: z.literal("BENEFITS"),
      variant: z.enum(COMPONENT_REGISTRY_V1.BENEFITS.variants),
      order: sectionOrderSchema,
      enabled: z.boolean(),
      content: benefitsContentSchema,
      settings: emptySettings,
    })
    .strict(),
  z
    .object({
      id: sectionIdSchema,
      type: z.literal("PROCESS"),
      variant: z.enum(COMPONENT_REGISTRY_V1.PROCESS.variants),
      order: sectionOrderSchema,
      enabled: z.boolean(),
      content: processContentSchema,
      settings: emptySettings,
    })
    .strict(),
  z
    .object({
      id: sectionIdSchema,
      type: z.literal("TRUST"),
      variant: z.enum(COMPONENT_REGISTRY_V1.TRUST.variants),
      order: sectionOrderSchema,
      enabled: z.boolean(),
      content: trustContentSchema,
      settings: emptySettings,
    })
    .strict(),
  z
    .object({
      id: sectionIdSchema,
      type: z.literal("FAQ"),
      variant: z.enum(COMPONENT_REGISTRY_V1.FAQ.variants),
      order: sectionOrderSchema,
      enabled: z.boolean(),
      content: faqContentSchema,
      settings: emptySettings,
    })
    .strict(),
  z
    .object({
      id: sectionIdSchema,
      type: z.literal("CTA"),
      variant: z.enum(COMPONENT_REGISTRY_V1.CTA.variants),
      order: sectionOrderSchema,
      enabled: z.boolean(),
      content: ctaContentSchema,
      settings: emptySettings,
    })
    .strict(),
  z
    .object({
      id: sectionIdSchema,
      type: z.literal("FORM"),
      variant: z.enum(COMPONENT_REGISTRY_V1.FORM.variants),
      order: sectionOrderSchema,
      enabled: z.boolean(),
      content: formContentSchema,
      settings: emptySettings,
    })
    .strict(),
  z
    .object({
      id: sectionIdSchema,
      type: z.literal("CONTACT"),
      variant: z.enum(COMPONENT_REGISTRY_V1.CONTACT.variants),
      order: sectionOrderSchema,
      enabled: z.boolean(),
      content: contactContentSchema,
      settings: emptySettings,
    })
    .strict(),
  z
    .object({
      id: sectionIdSchema,
      type: z.literal("FOOTER"),
      variant: z.enum(COMPONENT_REGISTRY_V1.FOOTER.variants),
      order: sectionOrderSchema,
      enabled: z.boolean(),
      content: footerContentSchema,
      settings: emptySettings,
    })
    .strict(),
]);

type SectionFor<T extends LandingComponentType> = {
  id: string;
  type: T;
  variant: (typeof COMPONENT_REGISTRY_V1)[T]["variants"][number];
  order: number;
  enabled: boolean;
  content: z.infer<(typeof COMPONENT_REGISTRY_V1)[T]["contentSchema"]>;
  settings: z.infer<(typeof COMPONENT_REGISTRY_V1)[T]["settingsSchema"]>;
};

export type LandingPageSection = {
  [T in LandingComponentType]: SectionFor<T>;
}[LandingComponentType];

export function isLandingComponentType(value: string): value is LandingComponentType {
  return (LANDING_COMPONENT_TYPES as readonly string[]).includes(value);
}
