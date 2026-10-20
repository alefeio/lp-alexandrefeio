import {
  landingPageActionSchema,
  safeExternalUrlSchema,
  safeInternalRouteSchema,
  sanitizeWhatsAppPhone,
  type LandingPageAction,
} from "@/lib/landing-page/actions";
import { landingPageSectionSchema, type LandingPageSection } from "@/lib/landing-page/components";
import { fail, ok, type LandingPageResult } from "@/lib/landing-page/errors";
import { WIREFRAME_PLACEHOLDERS } from "@/lib/landing-page/wireframe/copy";
import type { WireframeActionIntent, WireframeContextV1 } from "@/lib/landing-page/wireframe/context";
import type { WireframePlanV1 } from "@/lib/landing-page/wireframe/plan";

function defaultId(): string {
  return crypto.randomUUID();
}

function anchorFor(ids: { formId?: string; contactId?: string }): string {
  return ids.formId ?? ids.contactId ?? "acao";
}

function materializeAction(intent: WireframeActionIntent, anchor: string): LandingPageAction {
  if (intent.type === "WHATSAPP" && intent.phone) {
    const phone = sanitizeWhatsAppPhone(intent.phone);
    if (phone) {
      const action = { type: "WHATSAPP" as const, phone, ...(intent.message ? { message: intent.message } : {}) };
      const parsed = landingPageActionSchema.safeParse(action);
      if (parsed.success) return parsed.data;
    }
  }
  if (intent.type === "EXTERNAL_URL" && intent.url && safeExternalUrlSchema.safeParse(intent.url).success) {
    const action = { type: "EXTERNAL_URL" as const, url: intent.url, ...(intent.label ? { label: intent.label } : {}) };
    const parsed = landingPageActionSchema.safeParse(action);
    if (parsed.success) return parsed.data;
  }
  if (intent.type === "INTERNAL_ROUTE" && intent.path && safeInternalRouteSchema.safeParse(intent.path).success) {
    const action = { type: "INTERNAL_ROUTE" as const, path: intent.path, ...(intent.label ? { label: intent.label } : {}) };
    const parsed = landingPageActionSchema.safeParse(action);
    if (parsed.success) return parsed.data;
  }
  return {
    type: "FORM_ANCHOR",
    sectionId: anchor,
    label: intent.label ?? WIREFRAME_PLACEHOLDERS.actionLabel,
  };
}

function sectionContent(
  planSection: WireframePlanV1["sections"][number],
  action: LandingPageAction,
  phone: string | null,
): LandingPageSection["content"] {
  switch (planSection.type) {
    case "HERO":
      return {
        headline: WIREFRAME_PLACEHOLDERS.heroHeadline,
        subheadline: WIREFRAME_PLACEHOLDERS.heroSubheadline,
        primaryCta: action,
      };
    case "PROBLEM":
      return {
        heading: WIREFRAME_PLACEHOLDERS.problemHeading,
        description: WIREFRAME_PLACEHOLDERS.problemDescription,
      };
    case "SOLUTION":
      return {
        heading: WIREFRAME_PLACEHOLDERS.solutionHeading,
        description: WIREFRAME_PLACEHOLDERS.solutionDescription,
      };
    case "BENEFITS":
      return {
        heading: WIREFRAME_PLACEHOLDERS.benefitsHeading,
        items: [
          {
            title: WIREFRAME_PLACEHOLDERS.benefitsItemTitle,
            description: WIREFRAME_PLACEHOLDERS.benefitsItemDescription,
          },
        ],
      };
    case "PROCESS":
      return {
        heading: WIREFRAME_PLACEHOLDERS.processHeading,
        steps: [
          {
            title: WIREFRAME_PLACEHOLDERS.processStepTitle,
            description: WIREFRAME_PLACEHOLDERS.processStepDescription,
          },
        ],
      };
    case "TRUST":
      return {
        heading: WIREFRAME_PLACEHOLDERS.trustHeading,
        intro: WIREFRAME_PLACEHOLDERS.trustIntro,
        items: [],
      };
    case "FAQ":
      return {
        heading: WIREFRAME_PLACEHOLDERS.faqHeading,
        items: [{ question: WIREFRAME_PLACEHOLDERS.faqQuestion, answer: WIREFRAME_PLACEHOLDERS.faqAnswer }],
      };
    case "FORM":
      return {
        heading: WIREFRAME_PLACEHOLDERS.formHeading,
        intro: WIREFRAME_PLACEHOLDERS.formIntro,
        fields: ["name", "email", "message"],
        consentEnabled: true,
        consentText: WIREFRAME_PLACEHOLDERS.formConsent,
        submitLabel: "Enviar",
      };
    case "CTA":
      return {
        heading: WIREFRAME_PLACEHOLDERS.ctaHeading,
        description: WIREFRAME_PLACEHOLDERS.ctaDescription,
        action,
      };
    case "CONTACT":
      return {
        heading: WIREFRAME_PLACEHOLDERS.contactHeading,
        ...(phone ? { whatsapp: phone } : {}),
      };
    case "FOOTER":
      return {
        brandText: WIREFRAME_PLACEHOLDERS.footerBrand,
        copyrightText: WIREFRAME_PLACEHOLDERS.footerCopyright,
        links: [],
      };
    default: {
      const unreachable: never = planSection.type;
      return unreachable;
    }
  }
}

export function materializeWireframePlan(
  plan: WireframePlanV1,
  context: WireframeContextV1,
  options?: { idFactory?: () => string },
): LandingPageResult<LandingPageSection[]> {
  const idFactory = options?.idFactory ?? defaultId;
  const ids = new Map(plan.sections.map((section) => [section.key, idFactory()]));
  const formId = ids.get("primary-form");
  const contactId = ids.get("contact");
  const phone = context.primaryAction.type === "WHATSAPP" && context.primaryAction.phone
    ? sanitizeWhatsAppPhone(context.primaryAction.phone)
    : null;
  const action = materializeAction(context.primaryAction, anchorFor({ formId, contactId }));

  const sections: LandingPageSection[] = [];
  for (const [index, planSection] of plan.sections.entries()) {
    const id = ids.get(planSection.key);
    if (!id) return fail("INVALID_INPUT");
    const candidate = {
      id,
      type: planSection.type,
      variant: planSection.variant,
      order: index,
      enabled: true,
      content: sectionContent(planSection, action, phone),
      settings: {},
      contentStatus: "PLACEHOLDER" as const,
    };
    const parsed = landingPageSectionSchema.safeParse(candidate);
    if (!parsed.success) return fail("INVALID_INPUT");
    sections.push(parsed.data);
  }

  return ok(sections);
}
