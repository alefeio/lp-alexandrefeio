import { landingPageSectionSchema, type LandingPageSection } from "@/lib/landing-page/components";
import { parseLandingPageDocument, type LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { fail, ok, type LandingPageResult } from "@/lib/landing-page/errors";
import type { LandingPageProjectView } from "@/lib/landing-page/service";
import { themeFingerprint } from "@/lib/landing-page/theme/fingerprint";
import { assessThemeContrast, landingPageThemeSchema, sectionVisualSettingsSchema } from "@/lib/landing-page/theme/schema";
import { evaluateVisualHierarchy } from "@/lib/landing-page/theme/hierarchy";
import {
  assembleVisualDirection,
  sameWarningSet,
  visualDirectionChoiceSchema,
  visualSectionUpdateListSchema,
  type VisualSectionView,
} from "@/lib/landing-page/theme/visual-direction";
import type { LandingPageStore } from "@/lib/landing-page/types";
import { SECTION_NAMES, variantAllowed } from "@/lib/landing-page/wireframe/policy";

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

function preservedSnapshot(document: LandingPageDocumentV1) {
  return {
    order: document.sections.map((section) => section.id),
    sections: document.sections.map((section) => ({
      id: section.id,
      type: section.type,
      enabled: section.enabled,
      content: section.content,
      contentStatus: section.contentStatus,
      copyMeta: (section as { copyMeta?: unknown }).copyMeta ?? null,
    })),
    brief: document.strategy?.brief ?? null,
    decisionJourney: document.strategy?.decisionJourney ?? null,
    wireframe: document.strategy?.wireframe ?? null,
    copyFacts: document.strategy?.copyFacts ?? null,
    conversion: document.conversion,
    measurement: document.measurement,
  };
}

export async function saveLandingPageVisualDirection(
  store: LandingPageStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    theme: unknown;
    sections: unknown;
    direction: unknown;
  },
): Promise<LandingPageResult<LandingPageProjectView>> {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) return fail("INVALID_INPUT");
  const record = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!record) return fail("NOT_FOUND");
  if (record.status === "PUBLISHED" || record.status === "UNPUBLISHED") return fail("INVALID_INPUT");
  if (record.draftDocument.sections.length === 0) return fail("INVALID_INPUT");
  const theme = landingPageThemeSchema.safeParse(input.theme);
  if (!theme.success) return fail("INVALID_INPUT");
  const contrast = assessThemeContrast(theme.data);
  if (contrast.blocked.length > 0) return fail("LANDING_PAGE_THEME_CONTRAST");
  const updates = visualSectionUpdateListSchema.safeParse(input.sections);
  const choice = visualDirectionChoiceSchema.safeParse(input.direction);
  if (!updates.success || !choice.success) return fail("INVALID_INPUT");
  const currentIds = record.draftDocument.sections.map((section) => section.id);
  const updateIds = updates.data.map((section) => section.sectionId);
  if (updateIds.length !== currentIds.length || currentIds.some((id) => !updateIds.includes(id))) return fail("INVALID_INPUT");
  const byId = new Map(updates.data.map((section) => [section.sectionId, section]));
  const nextSections: LandingPageSection[] = [];
  for (const current of record.draftDocument.sections) {
    const update = byId.get(current.id);
    if (!update) return fail("INVALID_INPUT");
    if (update.visualSettings.backgroundRole === "ACCENT" && !theme.data.colors.accent) return fail("INVALID_INPUT");
    if (!variantAllowed(current.type, update.variant)) return fail("INVALID_INPUT");
    const parsedSection = landingPageSectionSchema.safeParse({
      ...current,
      settings: update.visualSettings,
      variant: update.variant,
    });
    if (!parsedSection.success) return fail("INVALID_INPUT");
    nextSections.push(parsedSection.data);
  }
  const views: VisualSectionView[] = nextSections.map((section) => ({
    id: section.id,
    type: section.type,
    label: SECTION_NAMES[section.type],
    variant: section.variant,
    enabled: section.enabled,
    settings: section.settings,
  }));
  const warnings = evaluateVisualHierarchy(theme.data, views);
  if (!sameWarningSet(choice.data.warningsReviewed, warnings)) return fail("LANDING_PAGE_VISUAL_REVIEW");
  const direction = assembleVisualDirection({
    themeFingerprint: themeFingerprint(theme.data),
    sections: views,
    choice: choice.data,
  });
  if (!direction) return fail("INVALID_INPUT");
  const document = {
    ...record.draftDocument,
    theme: theme.data,
    sections: nextSections,
    strategy: { ...record.draftDocument.strategy, visualDirection: direction },
  };
  const parsed = parseLandingPageDocument(document);
  if (!parsed.ok) return fail("INVALID_DOCUMENT");
  if (JSON.stringify(preservedSnapshot(record.draftDocument)) !== JSON.stringify(preservedSnapshot(parsed.document))) return fail("INVALID_DOCUMENT");
  const updated = await store.updateDraftAtomic({
    id: record.id,
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    document: parsed.document,
  });
  if (!updated.ok) return fail(updated.reason === "CONFLICT" ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  return ok(viewFrom(updated.record));
}
