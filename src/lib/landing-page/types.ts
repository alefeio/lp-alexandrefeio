import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";

export type LandingPageStatusName = "DRAFT" | "READY_TO_PREVIEW" | "PUBLISHED" | "UNPUBLISHED";

export type LandingPageProjectRecord = {
  id: string;
  userId: string;
  projectId: string | null;
  courseId: string;
  slug: string;
  title: string;
  status: LandingPageStatusName;
  draftDocument: LandingPageDocumentV1;
  draftRevision: number;
  publishedPublicationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  publicationCount: number;
};

export type CreateLandingPageRecordInput = {
  id: string;
  userId: string;
  projectId: string | null;
  courseId: string;
  slug: string;
  title: string;
  draftDocument: LandingPageDocumentV1;
};

export type LandingPageStore = {
  findCourseIdBySlug(slug: string): Promise<string | null>;
  findOwnedProject(projectId: string, userId: string): Promise<{ id: string } | null>;
  findByIdForUser(id: string, userId: string): Promise<LandingPageProjectRecord | null>;
  findSlugOwner(slug: string): Promise<{ id: string; userId: string } | null>;
  create(input: CreateLandingPageRecordInput): Promise<LandingPageProjectRecord>;
  updateDraftAtomic(input: {
    id: string;
    userId: string;
    expectedRevision: number;
    document: LandingPageDocumentV1;
  }): Promise<{ ok: true; record: LandingPageProjectRecord } | { ok: false; reason: "NOT_FOUND" | "CONFLICT" }>;
  updateTitleAtomic(input: {
    id: string;
    userId: string;
    title: string;
  }): Promise<{ ok: true; record: LandingPageProjectRecord } | { ok: false; reason: "NOT_FOUND" }>;
  updateSlugAtomic(input: {
    id: string;
    userId: string;
    slug: string;
  }): Promise<{ ok: true; record: LandingPageProjectRecord } | { ok: false; reason: "NOT_FOUND" | "TAKEN" | "LOCKED" }>;
};
