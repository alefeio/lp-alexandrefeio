import { CampaignDataError } from "@/lib/campaign-data/errors";
import type { CampaignDataCode } from "@/lib/campaign-data/errors";
import { assertSize, rejectDeclaredName } from "@/lib/campaign-data/format";
import { CAMPAIGN_DATA_LIMITS } from "@/lib/campaign-data/limits";
import { pathnameMatchesImport } from "@/lib/campaign-data/paths";

type Env = Record<string, string | undefined>;

export function uploadsAllowed(env: Env): boolean {
  return env.VERCEL_ENV !== "preview" && env.CAMPAIGN_DATA_UPLOADS !== "off";
}

export function sameOwner(sessionUserId: string | null, ownerId: string | null): boolean {
  return Boolean(sessionUserId && ownerId && sessionUserId === ownerId);
}

export function authorizeUpload(input: {
  sessionUserId: string | null;
  projectOwnerId: string | null;
  projectId: string;
  importId: string;
  pathname: string;
  sizeBytes: number;
  fileName: string;
  env: Env;
}): { ok: true } | { ok: false; code: CampaignDataCode } {
  if (!uploadsAllowed(input.env)) return { ok: false, code: "UPLOADS_DISABLED" };
  if (!sameOwner(input.sessionUserId, input.projectOwnerId)) return { ok: false, code: "NOT_FOUND" };
  if (!pathnameMatchesImport(input.pathname, input.projectId, input.importId)) return { ok: false, code: "NOT_FOUND" };
  try {
    rejectDeclaredName(input.fileName);
    assertSize(input.sizeBytes);
  } catch (error) {
    if (error instanceof CampaignDataError) return { ok: false, code: error.code };
    return { ok: false, code: "PARSE_FAILED" };
  }
  return { ok: true };
}

export function uploadGrant(now: number, pathname: string) {
  return {
    pathname,
    access: "private" as const,
    operations: ["put"] as const,
    validUntil: now + CAMPAIGN_DATA_LIMITS.uploadGrantMs,
    maximumSizeInBytes: CAMPAIGN_DATA_LIMITS.maxFileBytes,
  };
}
