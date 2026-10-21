import { GUIDED_WIREFRAME_ENGINE_V1 } from "@/lib/landing-page/constants";
import type { LandingComponentType } from "@/lib/landing-page/constants";
import { fail, ok, type LandingPageResult } from "@/lib/landing-page/errors";
import {
  WIREFRAME_PURPOSE,
  WIREFRAME_RATIONALE_TEXT,
  WIREFRAME_REASON_TEXT,
  WIREFRAME_WARNING_TEXT,
  type WireframeRationaleCode,
  type WireframeReasonCode,
} from "@/lib/landing-page/wireframe/copy";
import { parseWireframeContext, type WireframeContextV1 } from "@/lib/landing-page/wireframe/context";
import { wireframePlanFingerprint } from "@/lib/landing-page/wireframe/fingerprint";
import {
  wireframePlanSchema,
  WIREFRAME_SECTION_KEYS,
  type WireframePlanV1,
  type WireframeSectionKey,
  type WireframeStrategy,
} from "@/lib/landing-page/wireframe/plan";

const SECTION_TYPE: Record<WireframeSectionKey, LandingComponentType> = {
  hero: "HERO",
  problem: "PROBLEM",
  solution: "SOLUTION",
  benefits: "BENEFITS",
  process: "PROCESS",
  trust: "TRUST",
  faq: "FAQ",
  "primary-form": "FORM",
  "primary-cta": "CTA",
  contact: "CONTACT",
  footer: "FOOTER",
};

const SECTION_VARIANT: Record<LandingComponentType, string> = {
  HERO: "default",
  PROBLEM: "default",
  SOLUTION: "default",
  BENEFITS: "grid",
  PROCESS: "numbered",
  TRUST: "default",
  PORTFOLIO: "default",
  TESTIMONIALS: "default",
  FAQ: "default",
  CTA: "banner",
  FORM: "default",
  CONTACT: "default",
  FOOTER: "default",
};

const RATIONALE_BY_STRATEGY: Record<WireframeStrategy, WireframeRationaleCode> = {
  FOCUSED: "STRATEGY_FOCUSED",
  EXPLANATORY: "STRATEGY_EXPLANATORY",
  TRUST_HEAVY: "STRATEGY_TRUST_HEAVY",
  CONVERSATIONAL: "STRATEGY_CONVERSATIONAL",
  BALANCED: "STRATEGY_BALANCED",
};

function knownSignals(context: WireframeContextV1): boolean {
  return (
    context.explanationNeed !== "UNKNOWN" &&
    context.trustNeed !== "UNKNOWN" &&
    context.decisionComplexity !== "UNKNOWN" &&
    context.contactImportance !== "UNKNOWN" &&
    context.processNeedsExplanation !== "UNKNOWN" &&
    context.proofSituation !== "UNKNOWN"
  );
}

export function decideWireframeStrategy(context: WireframeContextV1): WireframeStrategy {
  if (context.contextCompleteness === "INSUFFICIENT") return "BALANCED";
  if (context.trustNeed === "HIGH") return "TRUST_HEAVY";
  if (context.explanationNeed === "HIGH" || context.decisionComplexity === "HIGH") return "EXPLANATORY";
  if (context.primaryAction.type === "WHATSAPP") return "CONVERSATIONAL";
  if (context.explanationNeed === "LOW" && context.decisionComplexity === "LOW" && context.trustNeed === "LOW") {
    return "FOCUSED";
  }
  return "BALANCED";
}

function canDescribeProblem(context: WireframeContextV1): boolean {
  return (
    context.contextCompleteness === "SUFFICIENT" ||
    Boolean(context.offer.summary) ||
    Boolean(context.audience.description) ||
    context.objections.length > 0
  );
}

function selectedKeys(context: WireframeContextV1, strategy: WireframeStrategy): Set<WireframeSectionKey> {
  if (context.contextCompleteness === "INSUFFICIENT") {
    return new Set(["hero", "primary-cta", "footer"]);
  }

  const keys = new Set<WireframeSectionKey>(["hero", "benefits", "footer"]);
  const explanationHigh = context.explanationNeed === "HIGH";
  const complexityHigh = context.decisionComplexity === "HIGH";

  if ((context.explanationNeed === "MEDIUM" || explanationHigh) && canDescribeProblem(context)) {
    keys.add("problem");
    keys.add("solution");
  }
  if (context.processNeedsExplanation === "YES" || complexityHigh) keys.add("process");
  if (context.trustNeed === "MEDIUM" || context.trustNeed === "HIGH" || context.proofSituation === "NEEDS_PROOF") {
    keys.add("trust");
  }
  if (context.objections.length > 0 || explanationHigh || complexityHigh) keys.add("faq");

  const formAction = context.primaryAction.type === "FORM" || (context.preferredConversionMethod === "FORM" && context.primaryAction.type !== "WHATSAPP");
  if (formAction) keys.add("primary-form");

  const leanForm = strategy === "FOCUSED" && formAction;
  if (!leanForm) keys.add("primary-cta");

  if (
    context.contactImportance === "MEDIUM" ||
    context.contactImportance === "HIGH" ||
    strategy === "CONVERSATIONAL" ||
    context.primaryAction.type === "WHATSAPP"
  ) {
    keys.add("contact");
  }

  return keys;
}

function reasonFor(key: WireframeSectionKey, context: WireframeContextV1): WireframeReasonCode {
  switch (key) {
    case "hero":
      return "HERO_OFFER_AND_ACTION";
    case "problem":
      return "PROBLEM_EXPLANATION_NEED";
    case "solution":
      return "SOLUTION_CONNECTS_OFFER";
    case "benefits":
      return "BENEFITS_CLARIFY_VALUE";
    case "process":
      return context.processNeedsExplanation === "YES" ? "PROCESS_NEEDS_EXPLANATION" : "PROCESS_HIGH_COMPLEXITY";
    case "trust":
      if (context.trustNeed === "HIGH") return "HIGH_TRUST_NEED";
      if (context.trustNeed === "MEDIUM") return "MEDIUM_TRUST_NEED";
      return "NEEDS_REAL_PROOF";
    case "faq":
      if (context.objections.length > 0) return "HAS_OBJECTIONS";
      if (context.explanationNeed === "HIGH") return "HIGH_EXPLANATION_NEED";
      return "HIGH_DECISION_COMPLEXITY";
    case "primary-form":
      return "FORM_PRIMARY_ACTION";
    case "primary-cta":
      return context.primaryAction.type === "WHATSAPP" ? "CONVERSATIONAL_PRIMARY_ACTION" : "CLOSING_ACTION";
    case "contact":
      return context.primaryAction.type === "WHATSAPP" ? "CONVERSATIONAL_PRIMARY_ACTION" : "CONTACT_IMPORTANCE";
    case "footer":
      return "FOOTER_REQUIRED";
    default: {
      const unreachable: never = key;
      return unreachable;
    }
  }
}

function requiredKeys(keys: Set<WireframeSectionKey>): Set<WireframeSectionKey> {
  const required = new Set<WireframeSectionKey>(["hero", "footer"]);
  if (keys.has("primary-form") && !keys.has("primary-cta")) required.add("primary-form");
  if (keys.has("primary-cta")) required.add("primary-cta");
  return required;
}

export function generateWireframePlan(input: unknown): LandingPageResult<WireframePlanV1> {
  const parsed = parseWireframeContext(input);
  if (!parsed.ok) return fail("INVALID_INPUT");
  const context = parsed.context;
  const strategy = decideWireframeStrategy(context);
  const keys = selectedKeys(context, strategy);
  const required = requiredKeys(keys);
  const ordered = WIREFRAME_SECTION_KEYS.filter((key) => keys.has(key));

  const warnings = [];
  if (context.contextCompleteness === "INSUFFICIENT") {
    warnings.push({ code: "NEEDS_MORE_CONTEXT" as const, text: WIREFRAME_WARNING_TEXT.NEEDS_MORE_CONTEXT });
  } else if (context.contextCompleteness === "PARTIAL") {
    warnings.push({ code: "PARTIAL_CONTEXT" as const, text: WIREFRAME_WARNING_TEXT.PARTIAL_CONTEXT });
  }
  if (keys.has("trust") && context.proofSituation === "NEEDS_PROOF") {
    warnings.push({ code: "ADD_REAL_PROOF" as const, text: WIREFRAME_WARNING_TEXT.ADD_REAL_PROOF });
  }

  const rationaleCode = context.contextCompleteness === "INSUFFICIENT" ? "STRATEGY_LIMITED_CONTEXT" : RATIONALE_BY_STRATEGY[strategy];
  const confidence =
    context.contextCompleteness === "INSUFFICIENT"
      ? "LIMITED"
      : context.contextCompleteness === "SUFFICIENT" && knownSignals(context)
        ? "STRONG"
        : "MODERATE";

  const plan = {
    version: 1 as const,
    engineVersion: GUIDED_WIREFRAME_ENGINE_V1,
    strategy,
    sections: ordered.map((key, index) => {
      const type = SECTION_TYPE[key];
      const reasonCode = reasonFor(key, context);
      return {
        key,
        type,
        variant: SECTION_VARIANT[type],
        purpose: WIREFRAME_PURPOSE[type] ?? "Organizar esta parte da página.",
        reasonCode,
        reason: WIREFRAME_REASON_TEXT[reasonCode],
        required: required.has(key),
        priority: index + 1,
      };
    }),
    rationale: [{ code: rationaleCode, text: WIREFRAME_RATIONALE_TEXT[rationaleCode] }],
    warnings,
    confidence,
    planFingerprint: wireframePlanFingerprint(context),
  };

  const checked = wireframePlanSchema.safeParse(plan);
  if (!checked.success) return fail("INVALID_INPUT");
  return ok(checked.data);
}
