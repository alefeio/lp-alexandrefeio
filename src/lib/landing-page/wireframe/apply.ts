import { parseLandingPageDocument } from "@/lib/landing-page/document";
import { fail, ok, type LandingPageResult } from "@/lib/landing-page/errors";
import type { LandingPageProjectView } from "@/lib/landing-page/service";
import { parseWireframeContext } from "@/lib/landing-page/wireframe/context";
import { generateWireframePlan } from "@/lib/landing-page/wireframe/engine";
import { materializeWireframePlan } from "@/lib/landing-page/wireframe/materialize";
import type { WireframePlanV1 } from "@/lib/landing-page/wireframe/plan";
import type { LandingPageStore } from "@/lib/landing-page/types";

export const WIREFRAME_APPLY_MODES = ["ONLY_IF_EMPTY", "REPLACE_ALL"] as const;
export type WireframeApplyMode = (typeof WIREFRAME_APPLY_MODES)[number];

export type AppliedWireframe = {
  project: LandingPageProjectView;
  plan: WireframePlanV1;
};

function viewFromRecord(record: {
  id: string;
  userId: string;
  projectId: string | null;
  courseId: string;
  slug: string;
  title: string;
  status: LandingPageProjectView["status"];
  draftDocument: LandingPageProjectView["draftDocument"];
  draftRevision: number;
  publishedPublicationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  publicationCount: number;
}): LandingPageProjectView {
  return {
    id: record.id,
    userId: record.userId,
    projectId: record.projectId,
    courseId: record.courseId,
    slug: record.slug,
    title: record.title,
    status: record.status,
    draftDocument: record.draftDocument,
    draftRevision: record.draftRevision,
    publishedPublicationId: record.publishedPublicationId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    hasPublicationHistory: record.publicationCount > 0,
  };
}

/**
 * Gera o plano e, só então, grava as seções.
 * ONLY_IF_EMPTY é o único modo habilitado. REPLACE_ALL existe no contrato e fica desligado.
 */
export async function applyGuidedWireframe(
  store: LandingPageStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    context: unknown;
    mode?: WireframeApplyMode;
    idFactory?: () => string;
  },
): Promise<LandingPageResult<AppliedWireframe>> {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) return fail("INVALID_INPUT");

  const contextResult = parseWireframeContext(input.context);
  if (!contextResult.ok) return fail("INVALID_INPUT");

  const record = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!record) return fail("NOT_FOUND");

  const mode = input.mode ?? "ONLY_IF_EMPTY";
  if (mode === "REPLACE_ALL") return fail("LANDING_PAGE_WIREFRAME_REPLACE_DISABLED");
  if (record.draftDocument.sections.length > 0) return fail("LANDING_PAGE_WIREFRAME_NOT_EMPTY");

  const planResult = generateWireframePlan(contextResult.context);
  if (!planResult.ok) return planResult;
  const sectionsResult = materializeWireframePlan(planResult.value, contextResult.context, { idFactory: input.idFactory });
  if (!sectionsResult.ok) return sectionsResult;

  const document = {
    ...record.draftDocument,
    sections: sectionsResult.value,
    guidedWireframe: {
      engineVersion: planResult.value.engineVersion,
      planFingerprint: planResult.value.planFingerprint,
      strategy: planResult.value.strategy,
      confidence: planResult.value.confidence,
    },
  };
  const parsedDocument = parseLandingPageDocument(document);
  if (!parsedDocument.ok) return fail("INVALID_DOCUMENT");

  const updated = await store.updateDraftAtomic({
    id: input.landingPageProjectId,
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    document: parsedDocument.document,
  });
  if (!updated.ok) {
    if (updated.reason === "CONFLICT") return fail("LANDING_PAGE_DRAFT_CONFLICT");
    return fail("NOT_FOUND");
  }

  return ok({ project: viewFromRecord(updated.record), plan: planResult.value });
}
