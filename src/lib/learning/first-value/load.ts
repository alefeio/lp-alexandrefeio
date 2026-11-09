import { getPrisma } from "@/lib/db/prisma";
import {
  buildFirstValueSelectInput,
  type FirstValueLoaderRecords,
} from "@/lib/learning/first-value/from-records";
import { selectFirstValueAction } from "@/lib/learning/first-value/select";
import type { FirstValueOrderStatus, FirstValueRecommendation } from "@/lib/learning/first-value/types";

export type FirstValueLoadResult = {
  recommendation: FirstValueRecommendation;
  /** Metadados seguros para observabilidade — sem payloads pedagógicos. */
  meta: {
    subjectUserId: string;
    purchaseCount: number;
    artifactCount: number;
    publishedLessonCount: number;
  };
};

/**
 * Loader autenticado read-only (ACT-1B.1).
 * `userId` deve vir da sessão validada — nunca de parâmetro público arbitrário.
 * Não grava, não altera entitlement/pedido/pagamento.
 */
export async function loadFirstValueRecommendation(
  userId: string,
  now = new Date(),
): Promise<FirstValueLoadResult> {
  if (!userId || typeof userId !== "string") {
    throw new Error("FIRST_VALUE_USER_REQUIRED");
  }

  const records = await fetchFirstValueRecords(userId, now);
  const input = buildFirstValueSelectInput(records);
  const recommendation = selectFirstValueAction(input);

  return {
    recommendation,
    meta: {
      subjectUserId: userId,
      purchaseCount: input.purchases.length,
      artifactCount: input.artifacts.length,
      publishedLessonCount: input.publishedLessonSlugs.length,
    },
  };
}

/** Expõe a montagem pura para testes de contrato sem Prisma. */
export function recommendFromFirstValueRecords(records: FirstValueLoaderRecords): FirstValueLoadResult {
  const input = buildFirstValueSelectInput(records);
  return {
    recommendation: selectFirstValueAction(input),
    meta: {
      subjectUserId: records.subjectUserId,
      purchaseCount: input.purchases.length,
      artifactCount: input.artifacts.length,
      publishedLessonCount: input.publishedLessonSlugs.length,
    },
  };
}

async function fetchFirstValueRecords(userId: string, now: Date): Promise<FirstValueLoaderRecords> {
  const prisma = getPrisma();

  const [orders, entitlements, progress, lessonResults, lessonResponses, diagnostics, landingPageProjects, projects, imports, publishedLessons] =
    await Promise.all([
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
              lessons: {
                select: {
                  lessonId: true,
                },
              },
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
        where: { userId },
        select: {
          status: true,
          grantedAt: true,
          lesson: { select: { slug: true } },
        },
      }),
      prisma.lessonProgress.findMany({
        where: { userId },
        select: {
          startedAt: true,
          completedAt: true,
          lastActiveAt: true,
          percent: true,
          lesson: { select: { slug: true } },
        },
      }),
      prisma.lessonResult.findMany({
        where: { userId },
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
        where: { userId },
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
      prisma.diagnostic.findMany({
        where: { userId },
        select: {
          id: true,
          userId: true,
          status: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.landingPageProject.findMany({
        where: { userId },
        select: {
          id: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
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
      prisma.project.findMany({
        where: { userId, status: "ACTIVE" },
        select: { id: true, userId: true, status: true },
      }),
      prisma.campaignDataImport.findMany({
        where: { userId, deletedAt: null, status: { not: "DELETED" } },
        select: { id: true, userId: true, status: true, deletedAt: true },
        take: 100,
      }),
      prisma.lesson.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true },
      }),
    ]);

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
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    landingPageProjects: landingPageProjects.map((row) => ({
      id: row.id,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    publications,
    projects: projects.map((row) => ({ id: row.id, userId: row.userId, status: row.status })),
    imports: imports.map((row) => ({
      id: row.id,
      userId: row.userId,
      status: row.status,
      deletedAt: row.deletedAt,
    })),
    publishedLessonSlugs: publishedLessons.map((row) => row.slug),
  };
}
