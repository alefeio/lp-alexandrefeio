import { z } from "zod";
import { GUIDED_WIREFRAME_ENGINE_V1, LANDING_COMPONENT_TYPES, type LandingComponentType } from "@/lib/landing-page/constants";
import { WIREFRAME_PURPOSE } from "@/lib/landing-page/wireframe/copy";
import {
  availableSectionTypes,
  cardinalityAllows,
  DEFAULT_SECTION_VARIANT,
  hasActionPath,
  variantAllowed,
  WIREFRAME_REQUIRED_TYPES,
} from "@/lib/landing-page/wireframe/policy";
import {
  WIREFRAME_CONFIDENCE,
  WIREFRAME_STRATEGIES,
  type WireframePlanV1,
  type WireframeSectionKey,
} from "@/lib/landing-page/wireframe/plan";

const KEY = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(40);

export const reviewedWireframeSectionSchema = z
  .object({
    key: KEY,
    type: z.enum(LANDING_COMPONENT_TYPES),
    variant: z.string().trim().min(1).max(40),
    order: z.number().int().min(0).max(29),
    origin: z.enum(["ENGINE", "USER_ADDED"]),
    purpose: z.string().trim().min(1).max(240),
    reason: z.string().trim().min(1).max(400).optional(),
  })
  .strict();

export const reviewedWireframePlanSchema = z
  .object({
    version: z.literal(1),
    engineVersion: z.literal(GUIDED_WIREFRAME_ENGINE_V1),
    planFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    strategy: z.enum(WIREFRAME_STRATEGIES),
    confidence: z.enum(WIREFRAME_CONFIDENCE),
    sections: z.array(reviewedWireframeSectionSchema).min(2).max(12),
    modifications: z
      .object({
        added: z.array(KEY).max(12),
        removed: z.array(KEY).max(12),
        reordered: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type ReviewedWireframeSectionV1 = z.infer<typeof reviewedWireframeSectionSchema>;
export type ReviewedWireframePlanV1 = z.infer<typeof reviewedWireframePlanSchema>;

const TYPE_KEY: Record<LandingComponentType, WireframeSectionKey | null> = {
  HERO: "hero",
  PROBLEM: "problem",
  SOLUTION: "solution",
  BENEFITS: "benefits",
  PROCESS: "process",
  TRUST: "trust",
  FAQ: "faq",
  FORM: "primary-form",
  CTA: "primary-cta",
  CONTACT: "contact",
  FOOTER: "footer",
};

function renumber(sections: ReviewedWireframeSectionV1[]): ReviewedWireframeSectionV1[] {
  return sections.map((section, order) => ({ ...section, order }));
}

type SectionBaseline = { sections: ReadonlyArray<{ key: string; type: string }> };

function withModifications(plan: ReviewedWireframePlanV1, original: SectionBaseline): ReviewedWireframePlanV1 {
  const originalKeys = original.sections.map((section) => section.key);
  const currentKeys = new Set(plan.sections.map((section) => section.key));
  const removed = originalKeys.filter((key) => !currentKeys.has(key));
  const added = plan.sections.filter((section) => section.origin === "USER_ADDED").map((section) => section.key);
  const engineOrder = plan.sections.filter((section) => originalKeys.includes(section.key)).map((section) => section.key);
  const originalRemaining = originalKeys.filter((key) => currentKeys.has(key));
  return {
    ...plan,
    modifications: {
      added,
      removed,
      reordered: engineOrder.join("|") !== originalRemaining.join("|"),
    },
  };
}

export function reviewedPlanFromEngine(plan: WireframePlanV1): ReviewedWireframePlanV1 {
  return {
    version: 1,
    engineVersion: plan.engineVersion,
    planFingerprint: plan.planFingerprint,
    strategy: plan.strategy,
    confidence: plan.confidence,
    sections: plan.sections.map((section, order) => ({
      key: section.key,
      type: section.type,
      variant: section.variant,
      order,
      origin: "ENGINE" as const,
      purpose: section.purpose,
      reason: section.reason,
    })),
    modifications: { added: [], removed: [], reordered: false },
  };
}

export function moveReviewedSection(
  plan: ReviewedWireframePlanV1,
  key: string,
  direction: "up" | "down",
  original: SectionBaseline,
): ReviewedWireframePlanV1 {
  const sections = [...plan.sections].sort((a, b) => a.order - b.order);
  const index = sections.findIndex((section) => section.key === key);
  const swap = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swap < 0 || swap >= sections.length) return plan;
  const next = sections.slice();
  const current = next[index];
  const other = next[swap];
  if (!current || !other) return plan;
  next[index] = other;
  next[swap] = current;
  return withModifications({ ...plan, sections: renumber(next) }, original);
}

export function removeReviewedSection(
  plan: ReviewedWireframePlanV1,
  key: string,
  original: SectionBaseline,
): { ok: true; plan: ReviewedWireframePlanV1 } | { ok: false; code: "REQUIRED" | "NOT_FOUND" } {
  const section = plan.sections.find((item) => item.key === key);
  if (!section) return { ok: false, code: "NOT_FOUND" };
  if ((WIREFRAME_REQUIRED_TYPES as readonly string[]).includes(section.type)) return { ok: false, code: "REQUIRED" };
  const sections = renumber(plan.sections.filter((item) => item.key !== key).sort((a, b) => a.order - b.order));
  return { ok: true, plan: withModifications({ ...plan, sections }, original) };
}

export function addReviewedSection(
  plan: ReviewedWireframePlanV1,
  type: LandingComponentType,
  original: SectionBaseline,
): { ok: true; plan: ReviewedWireframePlanV1 } | { ok: false; code: "CARDINALITY" | "VARIANT" } {
  const types = plan.sections.map((section) => section.type);
  if (!availableSectionTypes(types).includes(type) || !cardinalityAllows(types, type)) {
    return { ok: false, code: "CARDINALITY" };
  }
  const variant = DEFAULT_SECTION_VARIANT[type];
  if (!variantAllowed(type, variant)) return { ok: false, code: "VARIANT" };
  const used = new Set(plan.sections.map((section) => section.key));
  const canonical = TYPE_KEY[type];
  let key = canonical && !used.has(canonical) ? canonical : `extra-${type.toLowerCase()}`;
  let suffix = 2;
  while (used.has(key)) {
    key = `extra-${type.toLowerCase()}-${suffix}`;
    suffix += 1;
  }
  const section: ReviewedWireframeSectionV1 = {
    key,
    type,
    variant,
    order: plan.sections.length,
    origin: "USER_ADDED",
    purpose: WIREFRAME_PURPOSE[type] ?? "Organizar esta parte da página.",
  };
  return { ok: true, plan: withModifications({ ...plan, sections: [...plan.sections, section] }, original) };
}

export function validateReviewedWireframePlan(
  input: unknown,
  original: WireframePlanV1,
): { ok: true; plan: ReviewedWireframePlanV1 } | { ok: false; code: "INVALID" | "REQUIRED" | "CARDINALITY" | "VARIANT" | "PATH" | "FINGERPRINT" } {
  const parsed = reviewedWireframePlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID" };
  const plan = parsed.data;
  if (
    plan.planFingerprint !== original.planFingerprint ||
    plan.engineVersion !== original.engineVersion ||
    plan.strategy !== original.strategy ||
    plan.confidence !== original.confidence
  ) {
    return { ok: false, code: "FINGERPRINT" };
  }

  const keys = new Set<string>();
  const orders = new Set<number>();
  for (const section of plan.sections) {
    if (keys.has(section.key) || orders.has(section.order)) return { ok: false, code: "INVALID" };
    keys.add(section.key);
    orders.add(section.order);
    if (!variantAllowed(section.type, section.variant)) return { ok: false, code: "VARIANT" };
    const source = original.sections.find((item) => item.key === section.key);
    if (section.origin === "ENGINE") {
      if (!source || source.type !== section.type) return { ok: false, code: "INVALID" };
    } else if (source) {
      return { ok: false, code: "INVALID" };
    }
  }

  const types = plan.sections.map((section) => section.type);
  if (!cardinalityAllows(types)) return { ok: false, code: "CARDINALITY" };
  for (const required of WIREFRAME_REQUIRED_TYPES) {
    if (!types.includes(required)) return { ok: false, code: "REQUIRED" };
  }
  if (!hasActionPath(types)) return { ok: false, code: "PATH" };

  for (const source of original.sections) {
    if ((WIREFRAME_REQUIRED_TYPES as readonly string[]).includes(source.type) && !keys.has(source.key)) {
      return { ok: false, code: "REQUIRED" };
    }
  }

  const normalized = withModifications(
    { ...plan, sections: renumber([...plan.sections].sort((a, b) => a.order - b.order)) },
    original,
  );
  const checked = reviewedWireframePlanSchema.safeParse(normalized);
  if (!checked.success) return { ok: false, code: "INVALID" };
  return { ok: true, plan: checked.data };
}
