import { z } from "zod";
import { LANDING_PAGE_LIMITS } from "@/lib/landing-page/constants";

const line = (max: number) => z.string().trim().min(1).max(max);
const optionalLine = (max: number) => z.string().trim().min(1).max(max).optional();

export const TRUST_PROOF_TYPES = [
  "TESTIMONIAL",
  "PORTFOLIO",
  "CASE",
  "CREDENTIAL",
  "EXPERIENCE",
  "PROCESS_EVIDENCE",
  "BUSINESS_INFORMATION",
  "OTHER",
] as const;

export const TRUST_PROOF_STATUSES = ["DRAFT", "READY_FOR_DISPLAY"] as const;

export type TrustProofType = (typeof TRUST_PROOF_TYPES)[number];
export type TrustProofStatus = (typeof TRUST_PROOF_STATUSES)[number];

export const trustProofSchema = z
  .object({
    id: z.string().trim().min(1).max(64).optional(),
    type: z.enum(TRUST_PROOF_TYPES),
    title: line(LANDING_PAGE_LIMITS.maxShortText),
    description: optionalLine(LANDING_PAGE_LIMITS.maxMediumText),
    factualDetails: optionalLine(LANDING_PAGE_LIMITS.maxMediumText),
    sourceLabel: optionalLine(LANDING_PAGE_LIMITS.maxShortText),
    mediaIds: z.array(z.string().trim().min(1).max(64)).max(8).optional(),
    status: z.enum(TRUST_PROOF_STATUSES).optional(),
    quote: optionalLine(LANDING_PAGE_LIMITS.maxMediumText),
    authorName: optionalLine(LANDING_PAGE_LIMITS.maxShortText),
    authorRole: optionalLine(LANDING_PAGE_LIMITS.maxShortText),
    company: optionalLine(LANDING_PAGE_LIMITS.maxShortText),
    avatarMediaId: z.string().trim().min(1).max(64).optional(),
    consentConfirmed: z.boolean().optional(),
    consentAt: z.string().datetime().optional(),
    caseContext: optionalLine(LANDING_PAGE_LIMITS.maxMediumText),
    whatWasDone: optionalLine(LANDING_PAGE_LIMITS.maxMediumText),
    result: optionalLine(LANDING_PAGE_LIMITS.maxMediumText),
    issuer: optionalLine(LANDING_PAGE_LIMITS.maxShortText),
  })
  .strict();

export type TrustProofV1 = z.infer<typeof trustProofSchema>;

export function trustProofReady(proof: TrustProofV1): boolean {
  if (proof.type === "TESTIMONIAL") {
    return Boolean(proof.quote && proof.authorName && proof.consentConfirmed === true);
  }
  if (proof.type === "CASE") return Boolean(proof.caseContext && proof.whatWasDone);
  if (proof.type === "EXPERIENCE") return Boolean(proof.description);
  if (proof.type === "PORTFOLIO") return Boolean(proof.title || (proof.mediaIds?.length ?? 0) > 0);
  return Boolean(proof.title);
}
