import type { LandingPagePublicationSnapshotV1 } from "@/lib/landing-page/publication/snapshot";

export type LandingPagePublicationRecord = {
  id: string;
  landingPageProjectId: string;
  version: number;
  snapshot: LandingPagePublicationSnapshotV1;
  snapshotHash: string;
  snapshotSchemaVersion: 1;
  sourceDraftRevision: number | null;
  rollbackSourcePublicationId: string | null;
  publishedSlug: string;
  publishedAt: Date;
  createdAt: Date;
};

export type PublicationListItem = {
  id: string;
  version: number;
  createdAt: Date;
  sourceDraftRevision: number | null;
  isActive: boolean;
  rollbackSourcePublicationId: string | null;
  snapshotSchemaVersion: number;
  snapshotHash: string;
};

export type PublicationCommitInput = {
  userId: string;
  projectId: string;
  expectedDraftRevision: number | null;
  snapshot: LandingPagePublicationSnapshotV1;
  snapshotHash: string;
  sourceDraftRevision: number | null;
  rollbackSourcePublicationId: string | null;
  publishedSlug: string;
};

export type PublicationCommitResult =
  | { ok: true; publication: PublicationListItem }
  | { ok: false; code: "NOT_FOUND" | "LANDING_PAGE_DRAFT_CONFLICT" | "LANDING_PAGE_NO_PUBLIC_CHANGES" | "LANDING_PAGE_PUBLICATION_INVALID" };

export type PublicLandingPage = {
  projectId: string;
  slug: string;
  publication: LandingPagePublicationRecord;
};

export interface LandingPagePublicationStore {
  commit(input: PublicationCommitInput): Promise<PublicationCommitResult>;
  clearActive(input: { userId: string; projectId: string }): Promise<{ ok: true; alreadyInactive: boolean } | { ok: false; code: "NOT_FOUND" }>;
  list(input: { userId: string; projectId: string }): Promise<PublicationListItem[] | null>;
  get(input: { userId: string; projectId: string; publicationId: string }): Promise<LandingPagePublicationRecord | null>;
  findActiveBySlug(slug: string): Promise<PublicLandingPage | null>;
  referencesMedia(projectId: string, mediaId: string): Promise<boolean>;
}
