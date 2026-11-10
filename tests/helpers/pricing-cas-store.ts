import { atomicPriceWhere } from "../../src/lib/admin/pricing-core";
import type {
  PricingBundleRecord,
  PricingLessonRecord,
  PricingWriteDb,
} from "../../src/lib/admin/pricing-write";

type LessonRow = PricingLessonRecord & { writeCount: number };
type BundleRow = PricingBundleRecord & { writeCount: number };

function matchesWhere(
  row: { id: string; updatedAt: Date; commerceStatus: string; accessType?: string },
  where: ReturnType<typeof atomicPriceWhere>,
) {
  if (row.id !== where.id) return false;
  if (row.updatedAt.getTime() !== where.updatedAt.getTime()) return false;
  if (row.commerceStatus !== where.commerceStatus) return false;
  if ("accessType" in where && where.accessType !== undefined && row.accessType !== where.accessType) {
    return false;
  }
  return true;
}

/** Persistência em memória com compare-and-swap fiel ao updateMany. */
export function createPricingCasStore(seed: {
  lesson?: PricingLessonRecord;
  module?: PricingBundleRecord;
  course?: PricingBundleRecord;
}): PricingWriteDb & {
  lessonRow: () => LessonRow | null;
  moduleRow: () => BundleRow | null;
  courseRow: () => BundleRow | null;
  /** Altera status sem CAS — só para simular corrida em testes. */
  forceLessonCommerceStatus: (status: PricingLessonRecord["commerceStatus"]) => void;
} {
  let lesson: LessonRow | null = seed.lesson ? { ...seed.lesson, writeCount: 0 } : null;
  let moduleRow: BundleRow | null = seed.module ? { ...seed.module, writeCount: 0 } : null;
  let course: BundleRow | null = seed.course ? { ...seed.course, writeCount: 0 } : null;

  return {
    lessonRow: () => (lesson ? { ...lesson } : null),
    moduleRow: () => (moduleRow ? { ...moduleRow } : null),
    courseRow: () => (course ? { ...course } : null),
    forceLessonCommerceStatus: (status) => {
      if (!lesson) return;
      lesson = { ...lesson, commerceStatus: status };
    },
    lesson: {
      findUnique: async ({ where }) => (lesson && lesson.id === where.id ? { ...lesson } : null),
      updateMany: async ({ where, data }) => {
        if (!lesson || !matchesWhere(lesson, where)) return { count: 0 };
        lesson = {
          ...lesson,
          priceCents: data.priceCents,
          updatedById: data.updatedById,
          updatedAt: new Date(lesson.updatedAt.getTime() + 1000),
          writeCount: lesson.writeCount + 1,
        };
        return { count: 1 };
      },
    },
    module: {
      findUnique: async ({ where }) => (moduleRow && moduleRow.id === where.id ? { ...moduleRow } : null),
      updateMany: async ({ where, data }) => {
        if (!moduleRow || !matchesWhere(moduleRow, where)) return { count: 0 };
        moduleRow = {
          ...moduleRow,
          bundlePriceCents: data.bundlePriceCents,
          updatedById: data.updatedById,
          updatedAt: new Date(moduleRow.updatedAt.getTime() + 1000),
          writeCount: moduleRow.writeCount + 1,
        };
        return { count: 1 };
      },
    },
    course: {
      findUnique: async ({ where }) => (course && course.id === where.id ? { ...course } : null),
      updateMany: async ({ where, data }) => {
        if (!course || !matchesWhere(course, where)) return { count: 0 };
        course = {
          ...course,
          bundlePriceCents: data.bundlePriceCents,
          updatedById: data.updatedById,
          updatedAt: new Date(course.updatedAt.getTime() + 1000),
          writeCount: course.writeCount + 1,
        };
        return { count: 1 };
      },
    },
  };
}
