import { randomUUID } from "node:crypto";
import { parseLandingPageDocument, type LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { fail, ok, type LandingPageResult } from "@/lib/landing-page/errors";
import type { LandingPageProjectRecord, LandingPageStore } from "@/lib/landing-page/types";
import type { LandingPageMediaStore } from "@/lib/landing-page/media/record";
import { landingPageReferencesProof } from "@/lib/landing-page/media/refs";
import { trustProofReady, trustProofSchema, type TrustProofV1 } from "@/lib/landing-page/trust/schema";

async function commit(
  store: LandingPageStore,
  input: { id: string; userId: string; expectedRevision: number; document: LandingPageDocumentV1 },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  const parsed = parseLandingPageDocument(input.document);
  if (!parsed.ok) return fail("INVALID_DOCUMENT");
  const updated = await store.updateDraftAtomic({
    id: input.id,
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    document: parsed.document,
  });
  if (!updated.ok) return fail(updated.reason === "CONFLICT" ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  return ok(updated.record);
}

async function mediaOwned(
  mediaStore: LandingPageMediaStore,
  userId: string,
  landingPageProjectId: string,
  mediaId: string,
): Promise<boolean> {
  const media = await mediaStore.findById(mediaId);
  return Boolean(media && media.userId === userId && media.landingPageProjectId === landingPageProjectId && media.status === "READY");
}

export async function saveLandingPageTrustProof(
  store: LandingPageStore,
  mediaStore: LandingPageMediaStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    proof: unknown;
  },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  const parsed = trustProofSchema.safeParse(input.proof);
  if (!parsed.success) return fail("INVALID_INPUT");
  const project = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project || project.draftRevision !== input.expectedRevision) {
    return fail(project ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  }
  const mediaIds = [...(parsed.data.mediaIds ?? []), ...(parsed.data.avatarMediaId ? [parsed.data.avatarMediaId] : [])];
  for (const mediaId of mediaIds) {
    if (!(await mediaOwned(mediaStore, input.userId, project.id, mediaId))) return fail("LANDING_PAGE_MEDIA_REJECTED");
  }
  const document = structuredClone(project.draftDocument);
  const facts = document.strategy?.copyFacts ?? { version: 1 as const };
  const proofs = [...(facts.trustProofs ?? [])];
  const next: TrustProofV1 = {
    ...parsed.data,
    id: parsed.data.id ?? randomUUID(),
    status: "DRAFT",
    ...(parsed.data.consentConfirmed ? { consentConfirmed: true, consentAt: parsed.data.consentAt ?? new Date().toISOString() } : {}),
  };
  const index = proofs.findIndex((proof) => proof.id === next.id);
  if (index >= 0) proofs[index] = next;
  else proofs.push(next);
  document.strategy = { ...document.strategy, copyFacts: { ...facts, trustProofs: proofs } };
  return commit(store, { id: project.id, userId: input.userId, expectedRevision: input.expectedRevision, document });
}

export async function markLandingPageTrustProofReady(
  store: LandingPageStore,
  input: { userId: string; landingPageProjectId: string; expectedRevision: number; proofId: string },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  const project = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project || project.draftRevision !== input.expectedRevision) {
    return fail(project ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  }
  const document = structuredClone(project.draftDocument);
  const proofs = document.strategy?.copyFacts?.trustProofs ?? [];
  const proof = proofs.find((item) => item.id === input.proofId);
  if (!proof || !trustProofReady(proof)) return fail("INVALID_INPUT");
  proof.status = "READY_FOR_DISPLAY";
  if (proof.type === "TESTIMONIAL") proof.consentAt = proof.consentAt ?? new Date().toISOString();
  return commit(store, { id: project.id, userId: input.userId, expectedRevision: input.expectedRevision, document });
}

export async function removeLandingPageTrustProof(
  store: LandingPageStore,
  input: { userId: string; landingPageProjectId: string; expectedRevision: number; proofId: string },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  const project = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project || project.draftRevision !== input.expectedRevision) {
    return fail(project ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  }
  if (landingPageReferencesProof(project.draftDocument, input.proofId)) return fail("LANDING_PAGE_TRUST_PROOF_IN_USE");
  const document = structuredClone(project.draftDocument);
  const facts = document.strategy?.copyFacts;
  if (!facts?.trustProofs?.some((proof) => proof.id === input.proofId)) return fail("NOT_FOUND");
  facts.trustProofs = facts.trustProofs.filter((proof) => proof.id !== input.proofId);
  return commit(store, { id: project.id, userId: input.userId, expectedRevision: input.expectedRevision, document });
}

export async function setLandingPageProofRefs(
  store: LandingPageStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    sectionId: string;
    proofIds: string[];
  },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  const project = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project || project.draftRevision !== input.expectedRevision) {
    return fail(project ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  }
  const proofs = project.draftDocument.strategy?.copyFacts?.trustProofs ?? [];
  const document = structuredClone(project.draftDocument);
  const section = document.sections.find((item) => item.id === input.sectionId);
  if (!section || (section.type !== "TRUST" && section.type !== "TESTIMONIALS")) return fail("INVALID_INPUT");
  for (const proofId of input.proofIds) {
    const proof = proofs.find((item) => item.id === proofId);
    if (!proof) return fail("INVALID_INPUT");
    if (section.type === "TESTIMONIALS" && proof.type !== "TESTIMONIAL") return fail("INVALID_INPUT");
  }
  section.content = { ...section.content, proofRefs: input.proofIds };
  return commit(store, { id: project.id, userId: input.userId, expectedRevision: input.expectedRevision, document });
}
