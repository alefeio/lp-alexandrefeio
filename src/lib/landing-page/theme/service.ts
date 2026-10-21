import { landingPageSectionSchema, type LandingPageSection } from "@/lib/landing-page/components";
import { parseLandingPageDocument, type LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { fail, ok, type LandingPageResult } from "@/lib/landing-page/errors";
import type { LandingPageProjectView } from "@/lib/landing-page/service";
import { assessThemeContrast, landingPageThemeSchema, sectionVisualSettingsSchema } from "@/lib/landing-page/theme/schema";
import type { LandingPageStore } from "@/lib/landing-page/types";
import { variantAllowed } from "@/lib/landing-page/wireframe/policy";

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

export async function updateLandingPageTheme(
  store: LandingPageStore,
  input: { userId: string; landingPageProjectId: string; expectedRevision: number; theme: unknown },
): Promise<LandingPageResult<LandingPageProjectView>> {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) return fail("INVALID_INPUT");
  const record = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!record) return fail("NOT_FOUND");
  if (record.status === "PUBLISHED" || record.status === "UNPUBLISHED") return fail("INVALID_INPUT");
  const theme = landingPageThemeSchema.safeParse(input.theme);
  if (!theme.success) return fail("INVALID_INPUT");
  const contrast = assessThemeContrast(theme.data);
  if (contrast.blocked.length > 0) return fail("LANDING_PAGE_THEME_CONTRAST");
  const document = { ...record.draftDocument, theme: theme.data };
  const parsed = parseLandingPageDocument(document);
  if (!parsed.ok) return fail("INVALID_DOCUMENT");
  const updated = await store.updateDraftAtomic({
    id: record.id,
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    document: parsed.document,
  });
  if (!updated.ok) return fail(updated.reason === "CONFLICT" ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  return ok(viewFrom(updated.record));
}

export async function updateLandingPageSectionVisualSettings(
  store: LandingPageStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    sectionId: string;
    expectedRevision: number;
    visualSettings: unknown;
    variant?: string;
  },
): Promise<LandingPageResult<LandingPageProjectView>> {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) return fail("INVALID_INPUT");
  const record = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!record) return fail("NOT_FOUND");
  if (record.status === "PUBLISHED" || record.status === "UNPUBLISHED") return fail("INVALID_INPUT");
  const settings = sectionVisualSettingsSchema.safeParse(input.visualSettings ?? {});
  if (!settings.success) return fail("INVALID_INPUT");
  if (settings.data.backgroundRole === "ACCENT" && !record.draftDocument.theme.colors.accent) return fail("INVALID_INPUT");
  const current = record.draftDocument.sections.find((section) => section.id === input.sectionId);
  if (!current) return fail("INVALID_INPUT");
  if (input.variant !== undefined && !variantAllowed(current.type, input.variant)) return fail("INVALID_INPUT");
  const candidate = {
    ...current,
    settings: settings.data,
    ...(input.variant ? { variant: input.variant } : {}),
  };
  const parsedSection = landingPageSectionSchema.safeParse(candidate);
  if (!parsedSection.success) return fail("INVALID_INPUT");
  const document = {
    ...record.draftDocument,
    sections: record.draftDocument.sections.map((section) => (section.id === current.id ? parsedSection.data : section)),
  };
  const parsed = parseLandingPageDocument(document);
  if (!parsed.ok) return fail("INVALID_DOCUMENT");
  const updated = await store.updateDraftAtomic({
    id: record.id,
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    document: parsed.document,
  });
  if (!updated.ok) return fail(updated.reason === "CONFLICT" ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  const saved = updated.record.draftDocument.sections.find((section) => section.id === current.id) as LandingPageSection | undefined;
  if (!saved) return fail("INVALID_DOCUMENT");
  if (JSON.stringify(saved.content) !== JSON.stringify(current.content)) return fail("INVALID_DOCUMENT");
  if (saved.contentStatus !== current.contentStatus) return fail("INVALID_DOCUMENT");
  if (JSON.stringify((saved as { copyMeta?: unknown }).copyMeta ?? null) !== JSON.stringify((current as { copyMeta?: unknown }).copyMeta ?? null)) return fail("INVALID_DOCUMENT");
  return ok(viewFrom(updated.record));
}
