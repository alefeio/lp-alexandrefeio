import { parseLandingPageDocument, type LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { fail, ok, type LandingPageResult } from "@/lib/landing-page/errors";
import type { LandingPageProjectView } from "@/lib/landing-page/service";
import type { LandingPageStore } from "@/lib/landing-page/types";
import { copyFactsSchema, type CopyFactsV1 } from "@/lib/landing-page/copy/facts-schema";

function viewFrom(record: {
  id: string;
  userId: string;
  projectId: string | null;
  courseId: string;
  slug: string;
  title: string;
  status: LandingPageProjectView["status"];
  draftDocument: LandingPageDocumentV1;
  draftRevision: number;
  publishedPublicationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  publicationCount: number;
}): LandingPageProjectView {
  return { ...record, hasPublicationHistory: record.publicationCount > 0 };
}

export async function saveLandingPageCopyFacts(
  store: LandingPageStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    facts: unknown;
  },
): Promise<LandingPageResult<LandingPageProjectView>> {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) return fail("INVALID_INPUT");
  const record = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!record) return fail("NOT_FOUND");
  if (record.status === "PUBLISHED" || record.status === "UNPUBLISHED") return fail("INVALID_INPUT");
  const current = record.draftDocument.strategy?.copyFacts;
  const parsed = copyFactsSchema.safeParse({
    version: 1,
    ...(current ?? {}),
    ...(input.facts && typeof input.facts === "object" ? input.facts : {}),
  });
  if (!parsed.success) return fail("INVALID_INPUT");
  const document = {
    ...record.draftDocument,
    strategy: { ...record.draftDocument.strategy, copyFacts: parsed.data },
  };
  const checked = parseLandingPageDocument(document);
  if (!checked.ok) return fail("INVALID_DOCUMENT");
  const updated = await store.updateDraftAtomic({
    id: record.id,
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    document: checked.document,
  });
  if (!updated.ok) return fail(updated.reason === "CONFLICT" ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  return ok(viewFrom(updated.record));
}

export function copyFactLines(facts: CopyFactsV1 | undefined): Record<string, string> {
  if (!facts) return {};
  const lines: Record<string, string> = {};
  if (facts.processSteps?.length) {
    lines.processSteps = facts.processSteps.map((step) => (step.description ? `${step.title} — ${step.description}` : step.title)).join("\n");
  }
  if (facts.additionalBenefits?.length) {
    lines.additionalBenefits = facts.additionalBenefits.map((item) => (item.description ? `${item.title} — ${item.description}` : item.title)).join("\n");
  }
  if (facts.trustProofs?.length) {
    const trustProofs = facts.trustProofs
      .filter((item) => item.status !== "DRAFT")
      .filter((item) => item.type !== "TESTIMONIAL" || item.consentConfirmed === true || (!item.quote && !item.authorName && !item.status))
      .map((item) => [item.title, item.description, item.factualDetails, item.quote, item.authorName, item.caseContext, item.whatWasDone, item.result].filter(Boolean).join(" — "))
      .filter(Boolean)
      .join("\n");
    if (trustProofs) lines.trustProofs = trustProofs;
  }
  if (facts.objectionAnswers?.length) {
    lines.objectionAnswers = facts.objectionAnswers.map((item) => `${item.objection} — ${item.answerFact}`).join("\n");
  }
  return lines;
}
