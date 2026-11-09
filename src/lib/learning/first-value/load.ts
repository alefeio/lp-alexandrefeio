import { getPrisma } from "@/lib/db/prisma";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";
import {
  FIRST_VALUE_CATALOG_SLUGS,
  buildFirstValueSelectInput,
  type FirstValueLoaderRecords,
} from "@/lib/learning/first-value/from-records";
import { selectFirstValueAction } from "@/lib/learning/first-value/select";
import type { FirstValueOrderStatus, FirstValueRecommendation } from "@/lib/learning/first-value/types";

export type FirstValueLoadResult = {
  recommendation: FirstValueRecommendation;
  /** Metadados de servidor — sem subjectUserId nem payloads (não enviar a Analytics/cliente). */
  meta: {
    purchaseCount: number;
    artifactCount: number;
    publishedLessonCount: number;
    readOnly: true;
  };
};

/**
 * Entrypoint autenticado para ACT-1B.2.
 * Usa exclusivamente `requireSession()` — nunca userId arbitrário de cliente.
 * Import dinâmico evita acoplar o barrel de testes à sessão/Prisma.
 */
export async function loadFirstValueForAuthenticatedUser(now = new Date()): Promise<FirstValueLoadResult> {
  const { requireSession } = await import("@/lib/auth/session");
  const session = await requireSession();
  return loadFirstValueRecommendation(session.user.id, now);
}

/**
 * Loader read-only. Preferir `loadFirstValueForAuthenticatedUser` na UI.
 * `userId` deve originar-se da sessão validada.
 */
export async function loadFirstValueRecommendation(
  userId: string,
  now = new Date(),
): Promise<FirstValueLoadResult> {
  if (!userId || typeof userId !== "string") {
    throw new Error("FIRST_VALUE_USER_REQUIRED");
  }

  const records = await fetchFirstValueRecords(userId, now);
  return recommendFromFirstValueRecords(records);
}

/** Montagem pura para testes de contrato sem Prisma. */
export function recommendFromFirstValueRecords(records: FirstValueLoaderRecords): FirstValueLoadResult {
  const input = buildFirstValueSelectInput(records);
  return {
    recommendation: selectFirstValueAction(input),
    meta: {
      purchaseCount: input.purchases.length,
      artifactCount: input.artifacts.length,
      publishedLessonCount: input.publishedLessonSlugs.length,
      readOnly: true,
    },
  };
}

async function fetchFirstValueRecords(userId: string, now: Date): Promise<FirstValueLoaderRecords> {
  const prisma = getPrisma();
  const catalogSlugs = [...FIRST_VALUE_CATALOG_SLUGS];

  const [orders, entitlements, progress, lessonResults, lessonResponses, landingPageProjects, activeProject, readyImport, publishedLessons] =
    await Promise.all([
      // Pedidos: nunca truncar — necessário para confirmação e desempate.
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          status: true,
          zeroValueUpgrade: true,
          totalCents: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              productType: true,
              course: { select: { slug: true } },
              lessons: { select: { lessonId: true } },
            },
          },
          payments: {
            select: {
              status: true,
              approvedAt: true,
              amountCents: true,
            },
          },
        },
      }),
      prisma.entitlement.findMany({
        where: { userId, lesson: { slug: { in: catalogSlugs } } },
        select: {
          status: true,
          grantedAt: true,
          lesson: { select: { slug: true } },
        },
      }),
      prisma.lessonProgress.findMany({
        where: { userId, lesson: { slug: { in: catalogSlugs } } },
        select: {
          startedAt: true,
          completedAt: true,
          lastActiveAt: true,
          percent: true,
          lesson: { select: { slug: true } },
        },
      }),
      prisma.lessonResult.findMany({
        where: { userId, lesson: { slug: { in: catalogSlugs } } },
        select: {
          id: true,
          userId: true,
          projectId: true,
          payload: true,
          createdAt: true,
          updatedAt: true,
          lesson: { select: { slug: true } },
        },
      }),
      prisma.lessonResponse.findMany({
        where: { userId, lesson: { slug: { in: catalogSlugs } } },
        select: {
          id: true,
          userId: true,
          blockKey: true,
          payload: true,
          createdAt: true,
          updatedAt: true,
          lesson: { select: { slug: true } },
        },
      }),
      prisma.landingPageProject.findMany({
        where: { userId, course: { slug: SITES_COURSE_SLUG } },
        select: {
          id: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          course: { select: { slug: true } },
          publications: {
            select: {
              id: true,
              publishedAt: true,
              createdAt: true,
            },
            orderBy: { publishedAt: "asc" },
          },
        },
      }),
      prisma.project.findFirst({
        where: { userId, status: "ACTIVE" },
        select: { id: true, userId: true, status: true },
      }),
      prisma.campaignDataImport.findFirst({
        where: { userId, deletedAt: null, status: "READY" },
        select: { id: true, userId: true, status: true, deletedAt: true },
      }),
      prisma.lesson.findMany({
        where: { status: "PUBLISHED", slug: { in: catalogSlugs } },
        select: { slug: true },
      }),
    ]);

  const linkedDiagnosticIds = [
    ...new Set(
      lessonResponses
        .map((row) => {
          const payload = row.payload;
          if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
          const diagnosticId = (payload as { diagnosticId?: unknown }).diagnosticId;
          return typeof diagnosticId === "string" ? diagnosticId : null;
        })
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const diagnostics =
    linkedDiagnosticIds.length === 0
      ? []
      : await prisma.diagnostic.findMany({
          where: {
            userId,
            id: { in: linkedDiagnosticIds },
            status: "COMPLETED",
          },
          select: {
            id: true,
            userId: true,
            status: true,
            version: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });

  const orderItemLessonIds = [
    ...new Set(orders.flatMap((order) => order.items.flatMap((item) => item.lessons.map((row) => row.lessonId)))),
  ];
  const lessonSlugById = new Map<string, string>();
  if (orderItemLessonIds.length > 0) {
    const lessons = await prisma.lesson.findMany({
      where: { id: { in: orderItemLessonIds } },
      select: { id: true, slug: true },
    });
    for (const lesson of lessons) lessonSlugById.set(lesson.id, lesson.slug);
  }

  const publications = landingPageProjects.flatMap((project) =>
    project.publications.map((publication) => ({
      id: publication.id,
      userId: project.userId,
      landingPageProjectId: project.id,
      courseSlug: project.course.slug,
      publishedAt: publication.publishedAt,
      createdAt: publication.createdAt,
    })),
  );

  return {
    subjectUserId: userId,
    now,
    orders: orders.map((order) => ({
      id: order.id,
      userId: order.userId,
      status: order.status as FirstValueOrderStatus,
      zeroValueUpgrade: order.zeroValueUpgrade,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
      payments: order.payments.map((payment) => ({
        status: payment.status,
        approvedAt: payment.approvedAt,
        amountCents: payment.amountCents,
      })),
      items: order.items.map((item) => ({
        id: item.id,
        productType: item.productType,
        courseSlug: item.course?.slug ?? null,
        lessonSlugs: item.lessons
          .map((row) => lessonSlugById.get(row.lessonId))
          .filter((slug): slug is string => Boolean(slug)),
      })),
    })),
    entitlements: entitlements.map((row) => ({
      userId,
      lessonSlug: row.lesson.slug,
      status: row.status,
      grantedAt: row.grantedAt,
    })),
    progress: progress.map((row) => ({
      userId,
      lessonSlug: row.lesson.slug,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      lastActiveAt: row.lastActiveAt,
      percent: row.percent,
    })),
    lessonResults: lessonResults.map((row) => ({
      id: row.id,
      userId: row.userId,
      lessonSlug: row.lesson.slug,
      projectId: row.projectId,
      payload: row.payload,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    lessonResponses: lessonResponses.map((row) => ({
      id: row.id,
      userId: row.userId,
      lessonSlug: row.lesson.slug,
      blockKey: row.blockKey,
      payload: row.payload,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    diagnostics: diagnostics.map((row) => ({
      id: row.id,
      userId: row.userId,
      status: row.status,
      version: row.version,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    landingPageProjects: landingPageProjects.map((row) => ({
      id: row.id,
      userId: row.userId,
      courseSlug: row.course.slug,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    publications,
    projects: activeProject ? [{ id: activeProject.id, userId: activeProject.userId, status: activeProject.status }] : [],
    imports: readyImport
      ? [{ id: readyImport.id, userId: readyImport.userId, status: readyImport.status, deletedAt: readyImport.deletedAt }]
      : [],
    publishedLessonSlugs: publishedLessons.map((row) => row.slug),
  };
}
