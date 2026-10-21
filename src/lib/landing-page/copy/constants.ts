export const LANDING_PAGE_COPY_PROMPT_V1 = "LANDING_PAGE_COPY_PROMPT_V1" as const;

export const COPY_INTENTS = ["CLEAR", "DIRECT", "WARM", "PROFESSIONAL"] as const;

export type CopyIntent = (typeof COPY_INTENTS)[number];

export const COPY_VARIANT_MAX = 3;

export const COPY_PROVIDER_TIMEOUT_MS = 12_000;

export const COPY_SUGGESTION_SECTION_TYPES = [
  "HERO",
  "PROBLEM",
  "SOLUTION",
  "BENEFITS",
  "PROCESS",
  "TRUST",
  "FAQ",
  "CTA",
  "FORM",
] as const;

export type CopySuggestionSectionType = (typeof COPY_SUGGESTION_SECTION_TYPES)[number];

export const COPY_MISSING_FACTS = [
  "PRIMARY_BENEFIT",
  "ADDITIONAL_BENEFITS",
  "PROCESS_STEPS",
  "TRUST_PROOF",
  "FAQ_ANSWER",
  "DELIVERY_TIME",
  "PROBLEM_CONTEXT",
  "OFFER",
] as const;

export type CopyMissingFact = (typeof COPY_MISSING_FACTS)[number];

export const COPY_CLAIM_POLICY = {
  facts: "USER_PROVIDED",
  claimsAllowed: ["RESTATE", "SUMMARIZE", "CLARIFY", "COMBINE"] as const,
  claimsForbidden: [
    "TESTIMONIAL",
    "CLIENT",
    "CASE",
    "METRIC",
    "GUARANTEE",
    "CERTIFICATION",
    "AWARD",
    "AUTHORITY",
    "PRICE",
    "URGENCY",
    "SCARCITY",
    "RATING",
  ] as const,
  unknown: "DO_NOT_INVENT" as const,
};
