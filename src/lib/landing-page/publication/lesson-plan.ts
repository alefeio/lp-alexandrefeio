import type { LandingPageCode } from "@/lib/landing-page/errors";
import type { LandingPageStore } from "@/lib/landing-page/types";
import {
  publicationAcknowledgedBlocker,
  publicationLessonCanComplete,
  publicationLessonResult,
  type PublicationLessonResult,
} from "@/lib/landing-page/publication/lesson-flow";
import { evaluateLandingPagePublicationReadiness } from "@/lib/landing-page/publication/readiness";
import {
  listLandingPagePublications,
  publishLandingPage,
  rollbackLandingPage,
  unpublishLandingPage,
  type PublicationLogEvent,
} from "@/lib/landing-page/publication/service";
import type { PublicationMediaInput } from "@/lib/landing-page/publication/snapshot";
import type { LandingPagePublicationStore } from "@/lib/landing-page/publication/store";

type LessonDeps = {
  projects: LandingPageStore;
  publications: LandingPagePublicationStore;
  media?: PublicationMediaInput[];
  runtimeEnabled: boolean;
  log?: (event: PublicationLogEvent) => void;
};

export type PublicationLessonSave =
  | {
      ok: true;
      lessonComplete: true;
      result: PublicationLessonResult;
      code?: "LANDING_PAGE_NO_PUBLIC_CHANGES";
      blockers: string[];
      warnings: string[];
    }
  | {
      ok: true;
      lessonComplete: false;
      result: null;
      code: "RUNTIME_DISABLED" | "LANDING_PAGE_NO_PUBLIC_CHANGES";
      blockers: string[];
      warnings: string[];
    }
  | { ok: false; code: LandingPageCode; blockers: string[]; warnings: string[]; result: null; lessonComplete: false };

function pendingWarnings(warnings: string[], acknowledged: string[]) {
  return warnings.filter((code) => !acknowledged.includes(code));
}

/**
 * Publica pelo serviço da Phase 9. O resultado da aula só nasce se a rota pública deste ambiente puder servir a versão ativa.
 */
export async function saveLandingPagePublicationLesson(
  deps: LessonDeps,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedDraftRevision: number;
    acknowledgedWarningCodes?: string[];
  },
): Promise<PublicationLessonSave> {
  const project = await deps.projects.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project) return { ok: false, code: "NOT_FOUND", blockers: [], warnings: [], result: null, lessonComplete: false };
  if (!project.draftDocument.sections.some((section) => section.enabled)) {
    return { ok: false, code: "INVALID_INPUT", blockers: [], warnings: [], result: null, lessonComplete: false };
  }
  if (project.draftRevision !== input.expectedDraftRevision) {
    return { ok: false, code: "LANDING_PAGE_DRAFT_CONFLICT", blockers: [], warnings: [], result: null, lessonComplete: false };
  }
  const readiness = evaluateLandingPagePublicationReadiness({
    document: project.draftDocument,
    draftRevision: project.draftRevision,
    slug: project.slug,
    projectId: project.id,
    media: deps.media,
  });
  const acknowledged = input.acknowledgedWarningCodes ?? [];
  if (publicationAcknowledgedBlocker(acknowledged) || readiness.blockers.some((code) => acknowledged.includes(code))) {
    return { ok: false, code: "LANDING_PAGE_NOT_READY", blockers: readiness.blockers, warnings: readiness.warnings, result: null, lessonComplete: false };
  }
  if (!readiness.ready) {
    return { ok: false, code: "LANDING_PAGE_NOT_READY", blockers: readiness.blockers, warnings: readiness.warnings, result: null, lessonComplete: false };
  }
  if (pendingWarnings(readiness.warnings, acknowledged).length > 0) {
    return { ok: false, code: "LANDING_PAGE_NOT_READY", blockers: [], warnings: readiness.warnings, result: null, lessonComplete: false };
  }

  const published = await publishLandingPage(deps, {
    userId: input.userId,
    landingPageProjectId: project.id,
    expectedDraftRevision: project.draftRevision,
    acknowledgedWarningCodes: acknowledged,
  });
  const sameVersion = !published.ok && published.code === "LANDING_PAGE_NO_PUBLIC_CHANGES";
  if (!published.ok && !sameVersion) {
    return { ok: false, code: published.code, blockers: published.blockers, warnings: published.warnings, result: null, lessonComplete: false };
  }

  const active = await deps.publications.findActiveBySlug(project.slug);
  const accessible = publicationLessonCanComplete({
    runtimeEnabled: deps.runtimeEnabled,
    activeSnapshot: active?.publication.snapshot ?? null,
  });
  if (!deps.runtimeEnabled || !accessible || !active || active.publication.sourceDraftRevision == null) {
    return {
      ok: true,
      lessonComplete: false,
      result: null,
      code: deps.runtimeEnabled ? "LANDING_PAGE_NO_PUBLIC_CHANGES" : "RUNTIME_DISABLED",
      blockers: [],
      warnings: readiness.warnings,
    };
  }
  const action = active.publication.snapshot.conversion.primaryAction;
  const conversion = active.publication.snapshot.measurement.primaryConversionEvent;
  if (!action || !conversion) {
    return { ok: false, code: "LANDING_PAGE_PUBLICATION_INVALID", blockers: ["INVALID_SNAPSHOT"], warnings: readiness.warnings, result: null, lessonComplete: false };
  }
  const result = publicationLessonResult({
    landingPageProjectId: project.id,
    publicationId: active.publication.id,
    publicationVersion: active.publication.version,
    publicSlug: active.publication.publishedSlug,
    primaryActionType: action.type,
    primaryConversionEvent: conversion,
    warningCount: readiness.warnings.length,
    acknowledgedWarningCount: acknowledged.filter((code) => readiness.warnings.includes(code)).length,
    publishedAt: active.publication.publishedAt.toISOString(),
    sourceDraftRevision: active.publication.sourceDraftRevision,
  });
  if (!result) {
    return { ok: false, code: "LANDING_PAGE_PUBLICATION_INVALID", blockers: ["INVALID_SNAPSHOT"], warnings: readiness.warnings, result: null, lessonComplete: false };
  }
  return {
    ok: true,
    lessonComplete: true,
    result,
    ...(sameVersion ? { code: "LANDING_PAGE_NO_PUBLIC_CHANGES" as const } : {}),
    blockers: [],
    warnings: readiness.warnings,
  };
}

export async function restoreLandingPagePublicationLesson(
  deps: LessonDeps,
  input: { userId: string; landingPageProjectId: string; publicationId: string },
) {
  return rollbackLandingPage(deps, input);
}

export async function hideLandingPagePublicationLesson(
  deps: Pick<LessonDeps, "projects" | "publications" | "log">,
  input: { userId: string; landingPageProjectId: string },
) {
  return unpublishLandingPage(deps, input);
}

export async function publicationHistoryForOwner(
  deps: Pick<LessonDeps, "publications">,
  input: { userId: string; landingPageProjectId: string },
) {
  const history = await listLandingPagePublications(deps, input);
  return history?.map((item) => ({
    id: item.id,
    version: item.version,
    publishedAt: item.createdAt.toISOString(),
    active: item.isActive,
  })) ?? null;
}
