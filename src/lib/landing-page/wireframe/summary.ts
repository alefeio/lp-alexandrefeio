import { z } from "zod";
import { GUIDED_WIREFRAME_ENGINE_V1, LANDING_COMPONENT_TYPES } from "@/lib/landing-page/constants";
import { WIREFRAME_CONFIDENCE, WIREFRAME_STRATEGIES } from "@/lib/landing-page/wireframe/plan";
import type { ReviewedWireframePlanV1 } from "@/lib/landing-page/wireframe/review";

export const wireframeStructureResponseSchema = z
  .object({
    kind: z.literal("wireframe-structure-summary"),
    landingPageProjectId: z.string().trim().min(1).max(80),
    engineVersion: z.literal(GUIDED_WIREFRAME_ENGINE_V1),
    planFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    strategy: z.enum(WIREFRAME_STRATEGIES),
    confidence: z.enum(WIREFRAME_CONFIDENCE),
    sectionCount: z.number().int().min(1).max(30),
    sectionTypes: z.array(z.enum(LANDING_COMPONENT_TYPES)).max(30),
    userModified: z.boolean(),
    contextCompleteness: z.enum(["SUFFICIENT", "PARTIAL", "INSUFFICIENT"]),
    draftRevision: z.number().int().min(1),
    completedAt: z.string().trim().min(1).max(40),
  })
  .strict();

export type WireframeStructureSummary = z.infer<typeof wireframeStructureResponseSchema>;

export function wireframeStructureSummary(input: {
  landingPageProjectId: string;
  plan: ReviewedWireframePlanV1;
  sectionTypes: WireframeStructureSummary["sectionTypes"];
  contextCompleteness: WireframeStructureSummary["contextCompleteness"];
  draftRevision: number;
  completedAt: string;
}): WireframeStructureSummary {
  return {
    kind: "wireframe-structure-summary",
    landingPageProjectId: input.landingPageProjectId,
    engineVersion: input.plan.engineVersion,
    planFingerprint: input.plan.planFingerprint,
    strategy: input.plan.strategy,
    confidence: input.plan.confidence,
    sectionCount: input.sectionTypes.length,
    sectionTypes: input.sectionTypes,
    userModified: input.plan.modifications.added.length > 0 || input.plan.modifications.removed.length > 0 || input.plan.modifications.reordered,
    contextCompleteness: input.contextCompleteness,
    draftRevision: input.draftRevision,
    completedAt: input.completedAt,
  };
}
