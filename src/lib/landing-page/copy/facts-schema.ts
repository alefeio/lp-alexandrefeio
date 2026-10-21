import { z } from "zod";
import { LANDING_PAGE_LIMITS } from "@/lib/landing-page/constants";
import { TRUST_PROOF_TYPES, trustProofSchema } from "@/lib/landing-page/trust/schema";

const line = (max: number) => z.string().trim().min(1).max(max);
const optionalLine = (max: number) => z.string().trim().min(1).max(max).optional();

export const COPY_TRUST_PROOF_TYPES = TRUST_PROOF_TYPES;

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
    trustProofs: z.array(trustProofSchema).max(8).optional(),
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
