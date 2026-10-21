import { z } from "zod";
import { LANDING_PAGE_LIMITS } from "@/lib/landing-page/constants";

const line = (max: number) => z.string().trim().min(1).max(max);
const optionalLine = (max: number) => z.string().trim().min(1).max(max).optional();

export const COPY_TRUST_PROOF_TYPES = [
  "TESTIMONIAL",
  "PORTFOLIO",
  "CASE",
  "CREDENTIAL",
  "EXPERIENCE",
  "PROCESS_EVIDENCE",
  "OTHER",
] as const;

export const copyFactsSchema = z
  .object({
    version: z.literal(1),
    processSteps: z
      .array(
        z.object({ title: line(LANDING_PAGE_LIMITS.maxShortText), description: optionalLine(LANDING_PAGE_LIMITS.maxMediumText) }).strict(),
      )
      .max(LANDING_PAGE_LIMITS.maxProcessSteps)
      .optional(),
    additionalBenefits: z
      .array(
        z.object({ title: line(LANDING_PAGE_LIMITS.maxShortText), description: optionalLine(LANDING_PAGE_LIMITS.maxMediumText) }).strict(),
      )
      .max(6)
      .optional(),
    trustProofs: z
      .array(
        z
          .object({
            type: z.enum(COPY_TRUST_PROOF_TYPES),
            title: line(LANDING_PAGE_LIMITS.maxShortText),
            description: optionalLine(LANDING_PAGE_LIMITS.maxMediumText),
            factualDetails: optionalLine(LANDING_PAGE_LIMITS.maxMediumText),
          })
          .strict(),
      )
      .max(8)
      .optional(),
    objectionAnswers: z
      .array(
        z
          .object({
            objection: line(LANDING_PAGE_LIMITS.maxShortText),
            answerFact: line(LANDING_PAGE_LIMITS.maxMediumText),
          })
          .strict(),
      )
      .max(8)
      .optional(),
  })
  .strict();

export type CopyFactsV1 = z.infer<typeof copyFactsSchema>;
