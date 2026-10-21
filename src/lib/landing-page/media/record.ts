import type { LandingPageMediaStatus, LandingPageMediaType } from "@/lib/landing-page/media/limits";

export type LandingPageMediaRecord = {
  id: string;
  landingPageProjectId: string;
  userId: string;
  type: LandingPageMediaType;
  status: LandingPageMediaStatus;
  storageKey: string;
  publicUrl: string | null;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface LandingPageMediaStore {
  insert(record: LandingPageMediaRecord): Promise<void>;
  save(record: LandingPageMediaRecord): Promise<void>;
  findById(id: string): Promise<LandingPageMediaRecord | null>;
  listForProjectOwner(landingPageProjectId: string, userId: string): Promise<LandingPageMediaRecord[]>;
  countActive(landingPageProjectId: string): Promise<number>;
  listUploadingBefore(cutoff: Date): Promise<LandingPageMediaRecord[]>;
}
