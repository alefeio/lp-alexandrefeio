import { COPY_MISSING_FACTS, COPY_VARIANT_MAX, LANDING_PAGE_COPY_PROMPT_V1, type CopySuggestionSectionType } from "@/lib/landing-page/copy/constants";

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };

function objectSchema(properties: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

const CONTENT: Record<CopySuggestionSectionType, Record<string, unknown>> = {
  HERO: objectSchema({
    eyebrow: nullableString,
    headline: { type: "string" },
    subheadline: nullableString,
    primaryCtaLabel: nullableString,
  }),
  PROBLEM: objectSchema({
    heading: { type: "string" },
    description: nullableString,
  }),
  SOLUTION: objectSchema({
    heading: { type: "string" },
    description: { type: "string" },
  }),
  BENEFITS: objectSchema({
    heading: nullableString,
    items: {
      type: "array",
      items: objectSchema({
        title: { type: "string" },
        description: { type: "string" },
      }),
    },
  }),
  PROCESS: objectSchema({
    heading: nullableString,
    note: nullableString,
  }),
  TRUST: objectSchema({
    heading: nullableString,
    note: nullableString,
  }),
  FAQ: objectSchema({
    heading: nullableString,
    note: nullableString,
  }),
  CTA: objectSchema({
    heading: { type: "string" },
    description: nullableString,
    buttonLabel: nullableString,
  }),
  FORM: objectSchema({
    heading: nullableString,
    intro: nullableString,
    submitLabel: nullableString,
  }),
};

export function copyResponseJsonSchema(input: {
  sectionId: string;
  sectionType: CopySuggestionSectionType;
}): Record<string, unknown> {
  return objectSchema({
    version: { type: "integer", enum: [1] },
    promptVersion: { type: "string", enum: [LANDING_PAGE_COPY_PROMPT_V1] },
    sectionId: { type: "string", enum: [input.sectionId] },
    sectionType: { type: "string", enum: [input.sectionType] },
    suggestions: {
      type: "array",
      items: objectSchema({
        id: { type: "string" },
        content: CONTENT[input.sectionType],
        rationale: nullableString,
      }),
    },
    warnings: {
      type: "array",
      items: objectSchema({
        code: { type: "string" },
        text: { type: "string" },
      }),
    },
    missingFacts: {
      type: "array",
      items: { type: "string", enum: [...COPY_MISSING_FACTS] },
    },
  });
}

export const COPY_RESPONSE_SCHEMA_NAME = "copy_suggestion_response_v1";
export const COPY_RESPONSE_VARIANT_CAP = COPY_VARIANT_MAX;
