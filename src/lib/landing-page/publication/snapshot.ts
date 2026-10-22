import { createHash } from "node:crypto";
import { z } from "zod";
import { landingPageActionSchema, type LandingPageAction } from "@/lib/landing-page/actions";
import { landingPageSectionSchema, type LandingPageSection } from "@/lib/landing-page/components";
import { LANDING_COMPONENT_REGISTRY_V1, LANDING_PAGE_DOCUMENT_SCHEMA_VERSION, LANDING_PAGE_LIMITS } from "@/lib/landing-page/constants";
import { landingPageDocumentSchema, type LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { landingPageMeasurementSchema } from "@/lib/landing-page/measurement/schema";
import { landingPageThemeSchema } from "@/lib/landing-page/theme/schema";
import { trustProofSchema, type TrustProofV1 } from "@/lib/landing-page/trust/schema";

export const PUBLICATION_SNAPSHOT_SCHEMA_VERSION = 1 as const;

const FORBIDDEN_SNAPSHOT_KEYS = new Set([
  "strategy",
  "experienceReview",
  "copyFacts",
  "brief",
  "decisionJourney",
  "trustPlan",
  "visualDirection",
  "measurementPlan",
  "findings",
  "lessonResult",
  "lessonResults",
  "courseProgress",
  "openai",
  "promptVersion",
  "editorState",
  "storageKey",
  "userNotes",
]);

const publicMediaSchema = z
  .object({
    mediaId: z.string().trim().min(1).max(64),
    publicUrl: z.string().url().startsWith("https://"),
    altText: z.string().trim().max(180),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
  })
  .strict();

export const landingPagePublicationSnapshotSchema = z
  .object({
    snapshotSchemaVersion: z.literal(PUBLICATION_SNAPSHOT_SCHEMA_VERSION),
    schemaVersion: z.literal(LANDING_PAGE_DOCUMENT_SCHEMA_VERSION),
    registryVersion: z.literal(LANDING_COMPONENT_REGISTRY_V1),
    theme: landingPageThemeSchema,
    sections: z.array(landingPageSectionSchema).max(LANDING_PAGE_LIMITS.maxSections),
    conversion: z
      .object({
        primaryAction: landingPageActionSchema.nullable(),
        secondaryAction: landingPageActionSchema.nullable(),
      })
      .strict(),
    measurement: landingPageMeasurementSchema,
    media: z.array(publicMediaSchema).max(40),
    trustProofs: z.array(trustProofSchema).max(12),
    page: z
      .object({
        title: z.string().trim().min(1).max(70),
        description: z.string().trim().min(1).max(160),
      })
      .strict(),
  })
  .strict();

export type LandingPagePublicationSnapshotV1 = z.infer<typeof landingPagePublicationSnapshotSchema>;

export type PublicationMediaInput = {
  id: string;
  landingPageProjectId: string;
  status: string;
  publicUrl: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  fileSize: number;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function hashLandingPagePublicationSnapshot(snapshot: unknown): string {
  return createHash("sha256").update(stableStringify(snapshot)).digest("hex");
}

export function snapshotHasForbiddenKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => snapshotHasForbiddenKey(item));
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => FORBIDDEN_SNAPSHOT_KEYS.has(key) || snapshotHasForbiddenKey(child));
}

export function validatePublicationSnapshot(snapshot: unknown): { ok: true; snapshot: LandingPagePublicationSnapshotV1 } | { ok: false } {
  if (snapshotHasForbiddenKey(snapshot)) return { ok: false };
  const parsed = landingPagePublicationSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) return { ok: false };
  return { ok: true, snapshot: parsed.data };
}

function publicSection(section: LandingPageSection): LandingPageSection {
  const clone = structuredClone(section) as LandingPageSection & { copyMeta?: unknown };
  delete clone.copyMeta;
  return clone;
}

function pageCopy(sections: LandingPageSection[]): { title: string; description: string } {
  const hero = sections.find((section) => section.type === "HERO" && section.enabled);
  const headline = hero?.type === "HERO" ? hero.content.headline : "Página";
  const subheadline = hero?.type === "HERO" && hero.content.subheadline ? hero.content.subheadline : headline;
  const title = headline.trim().slice(0, 70) || "Página";
  const description = subheadline.trim().slice(0, 160) || title;
  return { title, description };
}

export function selectedTrustProofs(document: LandingPageDocumentV1): TrustProofV1[] {
  const ids = new Set<string>();
  for (const section of document.sections) {
    if (!section.enabled || (section.type !== "TRUST" && section.type !== "TESTIMONIALS")) continue;
    for (const proofId of section.content.proofRefs ?? []) ids.add(proofId);
  }
  const proofs = document.strategy?.copyFacts?.trustProofs ?? [];
  return proofs.filter((proof) => proof.id && ids.has(proof.id));
}

export function referencedMediaIds(document: LandingPageDocumentV1, proofs: TrustProofV1[]): string[] {
  const ids = new Set<string>();
  for (const ref of document.mediaRefs) ids.add(ref.mediaId);
  for (const section of document.sections) {
    if (!section.enabled) continue;
    if ((section.type === "HERO" || section.type === "FOOTER") && section.content.mediaRef) ids.add(section.content.mediaRef.mediaId);
    if (section.type === "PORTFOLIO") {
      for (const item of section.content.items) ids.add(item.mediaRef.mediaId);
    }
  }
  for (const proof of proofs) {
    for (const mediaId of proof.mediaIds ?? []) ids.add(mediaId);
    if (proof.avatarMediaId) ids.add(proof.avatarMediaId);
  }
  return [...ids];
}

/**
 * Monta o snapshot público. Não grava banco e não copia estratégia, revisão nem fatos internos.
 */
export function buildLandingPagePublicationSnapshot(
  document: LandingPageDocumentV1,
  media: PublicationMediaInput[],
): LandingPagePublicationSnapshotV1 | null {
  const proofs = selectedTrustProofs(document).map((proof) => structuredClone(proof));
  if (proofs.some((proof) => proof.status !== "READY_FOR_DISPLAY" || (proof.type === "TESTIMONIAL" && proof.consentConfirmed !== true))) {
    return null;
  }
  const mediaIds = referencedMediaIds(document, proofs);
  const descriptors = [];
  for (const mediaId of mediaIds) {
    const record = media.find((item) => item.id === mediaId);
    if (!record || record.status !== "READY" || !record.publicUrl?.startsWith("https://")) return null;
    descriptors.push({
      mediaId: record.id,
      publicUrl: record.publicUrl,
      altText: record.altText ?? "",
      width: record.width,
      height: record.height,
    });
  }
  const sections = document.sections.filter((section) => section.enabled).map(publicSection);
  const measurement = landingPageMeasurementSchema.safeParse({
    version: document.measurement.version,
    primaryConversionEvent: document.measurement.primaryConversionEvent,
    enabledEvents: document.measurement.enabledEvents,
  });
  if (!measurement.success) return null;
  const snapshot = {
    snapshotSchemaVersion: PUBLICATION_SNAPSHOT_SCHEMA_VERSION,
    schemaVersion: document.schemaVersion,
    registryVersion: document.registryVersion,
    theme: document.theme,
    sections,
    conversion: {
      primaryAction: document.conversion.primaryAction,
      secondaryAction: document.conversion.secondaryAction,
    },
    measurement: measurement.data,
    media: descriptors,
    trustProofs: proofs,
    page: pageCopy(sections),
  };
  const validated = validatePublicationSnapshot(snapshot);
  return validated.ok ? validated.snapshot : null;
}

export function documentFromPublicationSnapshot(snapshot: unknown): LandingPageDocumentV1 | null {
  const validated = validatePublicationSnapshot(snapshot);
  if (!validated.ok) return null;
  const document = {
    schemaVersion: validated.snapshot.schemaVersion,
    registryVersion: validated.snapshot.registryVersion,
    sections: validated.snapshot.sections,
    theme: validated.snapshot.theme,
    conversion: {
      primaryAction: validated.snapshot.conversion.primaryAction,
      secondaryAction: validated.snapshot.conversion.secondaryAction,
      businessOutcome: null,
    },
    measurement: validated.snapshot.measurement,
    mediaRefs: [],
  };
  const parsed = landingPageDocumentSchema.safeParse(document);
  return parsed.success ? parsed.data : null;
}

export function snapshotReferencesMedia(snapshot: unknown, mediaId: string): boolean {
  return walkMedia(snapshot, mediaId);
}

function walkMedia(value: unknown, mediaId: string): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => walkMedia(item, mediaId));
  const record = value as Record<string, unknown>;
  if (record.mediaId === mediaId || record.avatarMediaId === mediaId) return true;
  if (Array.isArray(record.mediaIds) && record.mediaIds.includes(mediaId)) return true;
  return Object.values(record).some((child) => walkMedia(child, mediaId));
}

export function snapshotHasWhatsAppAction(snapshot: LandingPagePublicationSnapshotV1): boolean {
  const actions: Array<LandingPageAction | null | undefined> = [
    snapshot.conversion.primaryAction,
    snapshot.conversion.secondaryAction,
  ];
  for (const section of snapshot.sections) {
    if (section.type === "HERO") {
      actions.push(section.content.primaryCta, section.content.secondaryCta);
    } else if (section.type === "CTA") {
      actions.push(section.content.action);
    } else if (section.type === "FOOTER") {
      for (const link of section.content.links) actions.push(link.action);
    }
  }
  return actions.some((action) => action?.type === "WHATSAPP");
}
