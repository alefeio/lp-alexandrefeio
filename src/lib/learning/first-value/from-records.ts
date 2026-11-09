import { FIRST_VALUE_LESSON_CATALOG, firstValueLessonBySlug } from "@/lib/learning/first-value/catalog";
import { buildFirstValueArtifact } from "@/lib/learning/first-value/evidence";
import { isValidPedagogicalPayload } from "@/lib/learning/first-value/evidence-validate";
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
  status: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FirstValueLandingPageProjectRecord = {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type FirstValuePublicationRecord = {
  id: string;
  userId: string;
  landingPageProjectId: string;
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

export function buildArtifactsFromRecords(input: {
  subjectUserId: string;
  lessonResults: FirstValueLessonResultRecord[];
  lessonResponses: FirstValueLessonResponseRecord[];
  diagnostics: FirstValueDiagnosticRecord[];
  landingPageProjects: FirstValueLandingPageProjectRecord[];
  publications: FirstValuePublicationRecord[];
}): FirstValueArtifact[] {
  const artifacts: FirstValueArtifact[] = [];
  const ownedResults = input.lessonResults.filter((row) => row.userId === input.subjectUserId);
  const ownedResponses = input.lessonResponses.filter((row) => row.userId === input.subjectUserId);
  const ownedDiagnostics = input.diagnostics.filter((row) => row.userId === input.subjectUserId);
  const ownedLp = input.landingPageProjects.filter((row) => row.userId === input.subjectUserId);
  const ownedPubs = input.publications.filter((row) => row.userId === input.subjectUserId);

  for (const definition of FIRST_VALUE_LESSON_CATALOG) {
    if (definition.evidenceKind === "diagnostic_completed") {
      const done = ownedDiagnostics
        .filter((row) => row.status === "COMPLETED" && row.completedAt != null)
        .sort((a, b) => a.completedAt!.getTime() - b.completedAt!.getTime());
      const first = done[0];
      if (first?.completedAt) {
        pushUniqueArtifact(
          artifacts,
          buildFirstValueArtifact({
            id: first.id,
            lessonSlug: definition.lessonSlug,
            kind: "diagnostic_completed",
            userId: input.subjectUserId,
            resultSource: "diagnostic_completed_at",
            resultAchievedAt: first.completedAt,
            createdAt: first.createdAt,
            updatedAt: first.updatedAt,
          }),
        );
      }
      continue;
    }

    if (definition.evidenceKind === "landing_page_published") {
      const pubs = ownedPubs.slice().sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
      const first = pubs[0];
      if (first) {
        pushUniqueArtifact(
          artifacts,
          buildFirstValueArtifact({
            id: first.id,
            lessonSlug: definition.lessonSlug,
            kind: "landing_page_published",
            userId: input.subjectUserId,
            resultSource: "landing_page_publication_published_at",
            resultAchievedAt: first.publishedAt,
            createdAt: first.createdAt,
            updatedAt: first.publishedAt,
          }),
        );
      }
      continue;
    }

    if (definition.evidenceKind === "lesson_result_personal" || definition.evidenceKind === "lesson_result_project") {
      const results = ownedResults
        .filter((row) => row.lessonSlug === definition.lessonSlug)
        .filter((row) =>
          isValidPedagogicalPayload({
            toolKey: definition.toolKey,
            evidenceKind: definition.evidenceKind,
            payload: row.payload,
          }),
        )
        .filter((row) => {
          if (definition.evidenceKind === "lesson_result_project") return Boolean(row.projectId);
          return true;
        })
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));

      for (const row of results) {
        pushUniqueArtifact(
          artifacts,
          buildFirstValueArtifact({
            id: row.id,
            lessonSlug: definition.lessonSlug,
            kind: row.projectId ? "lesson_result_project" : "lesson_result_personal",
            userId: input.subjectUserId,
            resultSource: "lesson_result_created_at",
            // Nunca payload.completedAt — mutável em re-saves (ex.: brief Sites).
            resultAchievedAt: row.createdAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }),
        );
      }

      const responses = ownedResponses
        .filter((row) => row.lessonSlug === definition.lessonSlug)
        .filter((row) =>
          isValidPedagogicalPayload({
            toolKey: definition.toolKey,
            evidenceKind: definition.evidenceKind,
            payload: row.payload,
          }),
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));

      for (const row of responses) {
        // Só usa LessonResponse se não houver LessonResult válido da mesma aula.
        if (results.length > 0) break;
        pushUniqueArtifact(
          artifacts,
          buildFirstValueArtifact({
            id: row.id,
            lessonSlug: definition.lessonSlug,
            kind: definition.evidenceKind,
            userId: input.subjectUserId,
            resultSource: "lesson_response_created_at",
            resultAchievedAt: row.createdAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }),
        );
      }

      // Shell LP sem brief válido — evidência não verificável.
      if (
        definition.lessonSlug === "oferta-publico-acao-principal" &&
        results.length === 0 &&
        responses.length === 0 &&
        ownedLp.length > 0
      ) {
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

/**
 * Monta `FirstValueSelectInput` a partir de registros já filtrados.
 * Puro: sem Prisma, sem escrita, sem side-effects.
 */
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

/** Garante que o catálogo conhece o slug antes de anexar evidência de aula. */
export function knownFirstValueLesson(slug: string): boolean {
  return Boolean(firstValueLessonBySlug(slug));
}
