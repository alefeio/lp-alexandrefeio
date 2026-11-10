import "server-only";

import { projectPricingDesk, type PricingCourseDesk, type PricingCourseSummary } from "@/lib/admin/pricing-core";
import { updateProductPriceWithDb, type PricingActor, type UpdateProductPriceInput } from "@/lib/admin/pricing-write";
import { getPrisma } from "@/lib/db/prisma";

export type { PricingActor } from "@/lib/admin/pricing-write";
export { UNCHANGED_PRICE_MESSAGE } from "@/lib/admin/pricing-write";

export {
  atomicPriceWhere,
  coherenceWarnings,
  CONFLICT_MESSAGE,
  evaluatePriceChange,
  parseExpectedUpdatedAt,
  projectPricingDesk,
  simulateBrlChange,
  type AtomicPriceWrite,
  type PriceChangeInput,
  type PricingCourseDesk,
  type PricingCourseSummary,
  type PricingDrafts,
  type PricingLessonRow,
  type PricingModuleRow,
  type PricingResult,
  type PricingTarget,
} from "@/lib/admin/pricing-core";

export async function listPricingCourses(): Promise<PricingCourseSummary[]> {
  const rows = await getPrisma().course.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      modules: {
        include: { lessons: { select: { accessType: true } } },
      },
    },
  });
  return rows.map((course) => {
    const lessons = course.modules.flatMap((moduleRow) => moduleRow.lessons);
    return {
      id: course.id,
      title: course.title,
      status: course.status,
      commerceStatus: course.commerceStatus,
      bundlePriceCents: course.bundlePriceCents,
      paidLessonCount: lessons.filter((lesson) => lesson.accessType === "PAID").length,
      lessonCount: lessons.length,
      moduleCount: course.modules.length,
    };
  });
}

export async function loadPricingCourseDesk(courseId: string): Promise<PricingCourseDesk | null> {
  const course = await getPrisma().course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { sortOrder: "asc" },
        include: { lessons: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!course) return null;

  const base: PricingCourseDesk = {
    id: course.id,
    title: course.title,
    status: course.status,
    commerceStatus: course.commerceStatus,
    bundlePriceCents: course.bundlePriceCents,
    updatedAt: course.updatedAt.toISOString(),
    modules: course.modules.map((moduleRow) => ({
      id: moduleRow.id,
      title: moduleRow.title,
      status: moduleRow.status,
      commerceStatus: moduleRow.commerceStatus,
      bundlePriceCents: moduleRow.bundlePriceCents,
      updatedAt: moduleRow.updatedAt.toISOString(),
      lessons: moduleRow.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        accessType: lesson.accessType,
        status: lesson.status,
        commerceStatus: lesson.commerceStatus,
        priceCents: lesson.priceCents,
        updatedAt: lesson.updatedAt.toISOString(),
      })),
      paidLessonCount: 0,
      lessonCount: 0,
      paidLessonSumCents: 0,
      savingsCents: 0,
      percentOff: null,
      warnings: [],
    })),
    paidLessonCount: 0,
    lessonCount: 0,
    freeLessonCount: 0,
    paidLessonSumCents: 0,
    moduleBundleSumCents: 0,
    savingsVsLessonsCents: 0,
    percentOffVsLessons: null,
    savingsVsModulesCents: 0,
    percentOffVsModules: null,
    warnings: [],
  };

  return projectPricingDesk(base);
}

export async function updateProductPrice(actor: PricingActor, input: UpdateProductPriceInput) {
  return updateProductPriceWithDb(getPrisma(), actor, input);
}
