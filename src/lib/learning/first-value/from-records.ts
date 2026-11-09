import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";
import { FIRST_VALUE_LESSON_CATALOG, firstValueLessonBySlug } from "@/lib/learning/first-value/catalog";
import { buildFirstValueArtifact } from "@/lib/learning/first-value/evidence";
import {
  FIRST_VALUE_RESULT_FIELD_KEYS,
  isValidPedagogicalPayload,
  matchesOwnedCompletedDiagnostic,
  parsePublicationLessonPayload,
  parseTrafficReadinessLink,
  resolveTrustedResultAchievedAt,
} from "@/lib/learning/first-value/evidence-validate";
import { resolvePurchaseConfirmation } from "@/lib/learning/first-value/finance";
import type {
  FirstValueArtifact,
  FirstValueDependencyAvailability,
  FirstValueEntitlement,
  FirstValueOrderStatus,
  FirstValueProgress,
  FirstValuePurchase,
  FirstValueSelectInput,
} from "@/lib/learning/first-value/types";

export type FirstValueOrderItemRecord = {
  id: string;
  productType: "LESSON" | "MODULE" | "COURSE";
  courseSlug: string | null;
  lessonSlugs: string[];
};

export type FirstValueOrderRecord = {
  id: string;
  userId: string;
  status: FirstValueOrderStatus | string;
  zeroValueUpgrade: boolean;
  totalCents: number;
  createdAt: Date;
  items: FirstValueOrderItemRecord[];
  payments: Array<{ status: string; approvedAt: Date | null; amountCents: number }>;
};

export type FirstValueLessonResultRecord = {
  id: string;
  userId: string;
  lessonSlug: string;
  projectId: string | null;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type FirstValueLessonResponseRecord = {
  id: string;
  userId: string;
  lessonSlug: string;
  blockKey: string;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type FirstValueDiagnosticRecord = {
  id: string;
  userId: string;
  projectId: string;
  status: string;
  version?: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FirstValueLandingPageProjectRecord = {
  id: string;
  userId: string;
  courseSlug: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FirstValuePublicationRecord = {
  id: string;
  userId: string;
  landingPageProjectId: string;
  courseSlug: string | null;
  publishedAt: Date;
  createdAt: Date;
};

export type FirstValueLoaderRecords = {
  subjectUserId: string;
  now: Date;
  orders: FirstValueOrderRecord[];
  entitlements: Array<{ userId: string; lessonSlug: string; status: "ACTIVE" | "REVOKED"; grantedAt: Date }>;
  progress: Array<{
    userId: string;
    lessonSlug: string;
    startedAt: Date | null;
    completedAt: Date | null;
    lastActiveAt: Date | null;
    percent: number;
  }>;
  lessonResults: FirstValueLessonResultRecord[];
  lessonResponses: FirstValueLessonResponseRecord[];
  diagnostics: FirstValueDiagnosticRecord[];
  landingPageProjects: FirstValueLandingPageProjectRecord[];
  publications: FirstValuePublicationRecord[];
  projects: Array<{ id: string; userId: string; status: string }>;
  imports: Array<{ id: string; userId: string; status: string; deletedAt: Date | null }>;
  publishedLessonSlugs: string[];
  /** Chaves do bloco RESULT publicado por aula (sem tool). Preferir DB; fallback de seed em `FIRST_VALUE_RESULT_FIELD_KEYS`. */
  resultFieldKeysByLessonSlug?: Record<string, readonly string[]>;
};

function asOrderStatus(status: string): FirstValueOrderStatus {
  if (
    status === "PENDING_PAYMENT" ||
    status === "PAID" ||
    status === "CANCELLED" ||
    status === "REFUNDED" ||
    status === "NEEDS_REVIEW"
  ) {
    return status;
  }
  return "NEEDS_REVIEW";
}

export function buildPurchasesFromOrders(input: {
  subjectUserId: string;
  orders: FirstValueOrderRecord[];
}): FirstValuePurchase[] {
  const purchases: FirstValuePurchase[] = [];
  for (const order of input.orders) {
    if (order.userId !== input.subjectUserId) continue;
    const confirmation = resolvePurchaseConfirmation({
      status: order.status,
      zeroValueUpgrade: order.zeroValueUpgrade,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
      payments: order.payments,
    });
    const items = order.items.slice().sort((a, b) => a.id.localeCompare(b.id));
    for (const item of items) {
      const lessonSlugs = [...new Set(item.lessonSlugs)].sort((a, b) => a.localeCompare(b));
      purchases.push({
        orderId: order.id,
        orderItemId: item.id,
        status: asOrderStatus(String(order.status)),
        zeroValueUpgrade: order.zeroValueUpgrade,
        confirmedAt: confirmation.confirmedAt,
        confirmedAtSource: confirmation.confirmedAtSource,
        createdAt: order.createdAt,
        productType: item.productType,
        courseSlug: item.courseSlug,
        lessonSlugs,
      });
    }
  }
  return purchases.sort((a, b) => {
    const aTime = (a.confirmedAt ?? a.createdAt).getTime();
    const bTime = (b.confirmedAt ?? b.createdAt).getTime();
    if (bTime !== aTime) return bTime - aTime;
    const byOrder = a.orderId.localeCompare(b.orderId);
    if (byOrder !== 0) return byOrder;
    return (a.orderItemId ?? "").localeCompare(b.orderItemId ?? "");
  });
}

export function buildEntitlementsFromRecords(input: {
  subjectUserId: string;
  entitlements: FirstValueLoaderRecords["entitlements"];
}): FirstValueEntitlement[] {
  return input.entitlements
    .filter((row) => row.userId === input.subjectUserId)
    .map((row) => ({ lessonSlug: row.lessonSlug, status: row.status, grantedAt: row.grantedAt }))
    .sort((a, b) => a.lessonSlug.localeCompare(b.lessonSlug) || a.status.localeCompare(b.status));
}

export function buildProgressFromRecords(input: {
  subjectUserId: string;
  progress: FirstValueLoaderRecords["progress"];
}): FirstValueProgress[] {
  return input.progress
    .filter((row) => row.userId === input.subjectUserId)
    .map((row) => ({
      lessonSlug: row.lessonSlug,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      lastActiveAt: row.lastActiveAt,
      percent: row.percent,
    }))
    .sort((a, b) => a.lessonSlug.localeCompare(b.lessonSlug));
}

function pushUniqueArtifact(bucket: FirstValueArtifact[], artifact: FirstValueArtifact) {
  const key = `${artifact.userId}|${artifact.lessonSlug}|${artifact.kind}|${artifact.id ?? artifact.createdAt.toISOString()}`;
  if (bucket.some((row) => `${row.userId}|${row.lessonSlug}|${row.kind}|${row.id ?? row.createdAt.toISOString()}` === key)) {
    return;
  }
  bucket.push(artifact);
}

function resolveResultFieldKeys(
  lessonSlug: string,
  resultFieldKeysByLessonSlug: Record<string, readonly string[]> | undefined,
): readonly string[] | null {
  const fromLoader = resultFieldKeysByLessonSlug?.[lessonSlug];
  if (fromLoader && fromLoader.length > 0) return fromLoader;
  const fromSeed = FIRST_VALUE_RESULT_FIELD_KEYS[lessonSlug];
  return fromSeed && fromSeed.length > 0 ? fromSeed : null;
}

function artifactFromLessonRow(
  subjectUserId: string,
  definition: (typeof FIRST_VALUE_LESSON_CATALOG)[number],
  row: { id: string; projectId?: string | null; payload: unknown; createdAt: Date; updatedAt: Date },
  source: "lesson_result_created_at" | "lesson_response_created_at",
  resultFieldKeysByLessonSlug: Record<string, readonly string[]> | undefined,
): FirstValueArtifact | null {
  if (
    !isValidPedagogicalPayload({
      toolKey: definition.toolKey,
      evidenceKind: definition.evidenceKind,
      payload: row.payload,
      lessonSlug: definition.lessonSlug,
      requiredResultFieldKeys: resolveResultFieldKeys(definition.lessonSlug, resultFieldKeysByLessonSlug),
    })
  ) {
    return null;
  }
  if (definition.evidenceKind === "lesson_result_project" && source === "lesson_result_created_at" && !row.projectId) {
    return null;
  }
  const achieved = resolveTrustedResultAchievedAt(row);
  return buildFirstValueArtifact({
    id: row.id,
    lessonSlug: definition.lessonSlug,
    kind: row.projectId ? "lesson_result_project" : definition.evidenceKind === "lesson_result_project" ? "lesson_result_project" : "lesson_result_personal",
    userId: subjectUserId,
    resultSource: achieved ? source : "unproven",
    resultAchievedAt: achieved,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function buildDiagnosticArtifacts(input: {
  subjectUserId: string;
  definition: (typeof FIRST_VALUE_LESSON_CATALOG)[number];
  responses: FirstValueLessonResponseRecord[];
  diagnostics: FirstValueDiagnosticRecord[];
  projects: Array<{ id: string; userId: string; status: string }>;
}): FirstValueArtifact[] {
  const out: FirstValueArtifact[] = [];
  const links = input.responses
    .filter((row) => row.userId === input.subjectUserId && row.lessonSlug === input.definition.lessonSlug)
    .map((row) => ({ row, link: parseTrafficReadinessLink(row.payload) }))
    .filter((item): item is { row: FirstValueLessonResponseRecord; link: { projectId: string; diagnosticId: string } } =>
      Boolean(item.link),
    )
    .sort((a, b) => a.row.createdAt.getTime() - b.row.createdAt.getTime() || a.row.id.localeCompare(b.row.id));

  for (const item of links) {
    const diagnostic = input.diagnostics.find((row) =>
      matchesOwnedCompletedDiagnostic({
        subjectUserId: input.subjectUserId,
        link: item.link,
        diagnostic: row,
        projects: input.projects,
      }),
    );
    if (!diagnostic?.completedAt) continue;
    pushUniqueArtifact(
      out,
      buildFirstValueArtifact({
        id: diagnostic.id,
        lessonSlug: input.definition.lessonSlug,
        kind: "diagnostic_completed",
        userId: input.subjectUserId,
        resultSource: "diagnostic_completed_at",
        resultAchievedAt: diagnostic.completedAt,
        createdAt: diagnostic.createdAt,
        updatedAt: diagnostic.updatedAt,
      }),
    );
  }
  return out;
}

function buildPublicationArtifacts(input: {
  subjectUserId: string;
  definition: (typeof FIRST_VALUE_LESSON_CATALOG)[number];
  results: FirstValueLessonResultRecord[];
  responses: FirstValueLessonResponseRecord[];
  publications: FirstValuePublicationRecord[];
  landingPageProjects: FirstValueLandingPageProjectRecord[];
}): FirstValueArtifact[] {
  const out: FirstValueArtifact[] = [];
  const candidates = [
    ...input.results
      .filter((row) => row.userId === input.subjectUserId && row.lessonSlug === input.definition.lessonSlug)
      .map((row) => ({ id: row.id, payload: row.payload, createdAt: row.createdAt, updatedAt: row.updatedAt })),
    ...input.responses
      .filter((row) => row.userId === input.subjectUserId && row.lessonSlug === input.definition.lessonSlug)
      .map((row) => ({ id: row.id, payload: row.payload, createdAt: row.createdAt, updatedAt: row.updatedAt })),
  ];

  for (const candidate of candidates) {
    const parsed = parsePublicationLessonPayload(candidate.payload);
    if (!parsed) continue;
    const publication = input.publications.find(
      (row) =>
        row.userId === input.subjectUserId &&
        row.id === parsed.publicationId &&
        row.landingPageProjectId === parsed.landingPageProjectId,
    );
    if (!publication) continue;
    if (publication.courseSlug && publication.courseSlug !== SITES_COURSE_SLUG) continue;
    const lp = input.landingPageProjects.find(
      (row) => row.id === publication.landingPageProjectId && row.userId === input.subjectUserId,
    );
    if (!lp) continue;
    if (lp.courseSlug && lp.courseSlug !== SITES_COURSE_SLUG) continue;

    pushUniqueArtifact(
      out,
      buildFirstValueArtifact({
        id: publication.id,
        lessonSlug: input.definition.lessonSlug,
        kind: "landing_page_published",
        userId: input.subjectUserId,
        resultSource: "landing_page_publication_published_at",
        resultAchievedAt: publication.publishedAt,
        createdAt: publication.createdAt,
        updatedAt: publication.publishedAt,
      }),
    );
  }
  return out;
}

export function buildArtifactsFromRecords(input: {
  subjectUserId: string;
  lessonResults: FirstValueLessonResultRecord[];
  lessonResponses: FirstValueLessonResponseRecord[];
  diagnostics: FirstValueDiagnosticRecord[];
  landingPageProjects: FirstValueLandingPageProjectRecord[];
  publications: FirstValuePublicationRecord[];
  projects?: Array<{ id: string; userId: string; status: string }>;
  resultFieldKeysByLessonSlug?: Record<string, readonly string[]>;
}): FirstValueArtifact[] {
  const artifacts: FirstValueArtifact[] = [];
  const ownedResults = input.lessonResults.filter((row) => row.userId === input.subjectUserId);
  const ownedResponses = input.lessonResponses.filter((row) => row.userId === input.subjectUserId);
  const ownedLp = input.landingPageProjects.filter((row) => row.userId === input.subjectUserId);
  const projects = input.projects ?? [];

  for (const definition of FIRST_VALUE_LESSON_CATALOG) {
    if (definition.evidenceKind === "diagnostic_completed") {
      for (const artifact of buildDiagnosticArtifacts({
        subjectUserId: input.subjectUserId,
        definition,
        responses: ownedResponses,
        diagnostics: input.diagnostics,
        projects,
      })) {
        pushUniqueArtifact(artifacts, artifact);
      }
      continue;
    }

    if (definition.evidenceKind === "landing_page_published") {
      for (const artifact of buildPublicationArtifacts({
        subjectUserId: input.subjectUserId,
        definition,
        results: ownedResults,
        responses: ownedResponses,
        publications: input.publications,
        landingPageProjects: input.landingPageProjects,
      })) {
        pushUniqueArtifact(artifacts, artifact);
      }
      continue;
    }

    if (definition.evidenceKind === "lesson_result_personal" || definition.evidenceKind === "lesson_result_project") {
      const results = ownedResults
        .filter((row) => row.lessonSlug === definition.lessonSlug)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));

      const validResults: FirstValueArtifact[] = [];
      for (const row of results) {
        const artifact = artifactFromLessonRow(
          input.subjectUserId,
          definition,
          row,
          "lesson_result_created_at",
          input.resultFieldKeysByLessonSlug,
        );
        if (artifact) {
          validResults.push(artifact);
          pushUniqueArtifact(artifacts, artifact);
        }
      }

      if (validResults.length === 0) {
        const responses = ownedResponses
          .filter((row) => row.lessonSlug === definition.lessonSlug)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
        for (const row of responses) {
          const artifact = artifactFromLessonRow(
            input.subjectUserId,
            definition,
            row,
            "lesson_response_created_at",
            input.resultFieldKeysByLessonSlug,
          );
          if (artifact) pushUniqueArtifact(artifacts, artifact);
        }
      }

      const hasValidBrief =
        definition.lessonSlug === "oferta-publico-acao-principal" &&
        artifacts.some(
          (row) =>
            row.lessonSlug === definition.lessonSlug &&
            (row.kind === "lesson_result_personal" || row.kind === "lesson_result_project"),
        );

      if (definition.lessonSlug === "oferta-publico-acao-principal" && !hasValidBrief && ownedLp.length > 0) {
        const shell = ownedLp.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]!;
        pushUniqueArtifact(
          artifacts,
          buildFirstValueArtifact({
            id: shell.id,
            lessonSlug: definition.lessonSlug,
            kind: "landing_page_project_shell",
            userId: input.subjectUserId,
            resultSource: "unproven",
            resultAchievedAt: null,
            createdAt: shell.createdAt,
            updatedAt: shell.updatedAt,
          }),
        );
      }
    }
  }

  return artifacts.sort(
    (a, b) =>
      a.lessonSlug.localeCompare(b.lessonSlug) ||
      (a.id ?? "").localeCompare(b.id ?? "") ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

export function buildDependencyAvailability(input: {
  subjectUserId: string;
  projects: FirstValueLoaderRecords["projects"];
  landingPageProjects: FirstValueLandingPageProjectRecord[];
  imports: FirstValueLoaderRecords["imports"];
}): FirstValueDependencyAvailability {
  const hasProject = input.projects.some((row) => row.userId === input.subjectUserId && row.status === "ACTIVE");
  const hasLanding = input.landingPageProjects.some((row) => row.userId === input.subjectUserId);
  const hasImport = input.imports.some(
    (row) => row.userId === input.subjectUserId && row.deletedAt == null && row.status === "READY",
  );
  return {
    project: hasProject,
    landing_page_project: hasLanding,
    campaign_import: hasImport,
  };
}

export function buildFirstValueSelectInput(records: FirstValueLoaderRecords): FirstValueSelectInput {
  const subjectUserId = records.subjectUserId;
  return {
    subjectUserId,
    now: records.now,
    purchases: buildPurchasesFromOrders({ subjectUserId, orders: records.orders }),
    entitlements: buildEntitlementsFromRecords({ subjectUserId, entitlements: records.entitlements }),
    progress: buildProgressFromRecords({ subjectUserId, progress: records.progress }),
    artifacts: buildArtifactsFromRecords({
      subjectUserId,
      lessonResults: records.lessonResults,
      lessonResponses: records.lessonResponses,
      diagnostics: records.diagnostics,
      landingPageProjects: records.landingPageProjects,
      publications: records.publications,
      projects: records.projects,
      resultFieldKeysByLessonSlug: records.resultFieldKeysByLessonSlug,
    }),
    publishedLessonSlugs: [...new Set(records.publishedLessonSlugs)].sort((a, b) => a.localeCompare(b)),
    dependencyAvailability: buildDependencyAvailability({
      subjectUserId,
      projects: records.projects,
      landingPageProjects: records.landingPageProjects,
      imports: records.imports,
    }),
  };
}

export function knownFirstValueLesson(slug: string): boolean {
  return Boolean(firstValueLessonBySlug(slug));
}

export const FIRST_VALUE_CATALOG_SLUGS: readonly string[] = FIRST_VALUE_LESSON_CATALOG.map((row) => row.lessonSlug);
