import { getPrisma } from "@/lib/db/prisma";
import type { CreditSource, SaleCourse, SaleLesson, SaleModule } from "@/lib/commerce/quote";

export async function loadSaleCatalog(): Promise<{ lessons: SaleLesson[]; modules: SaleModule[]; courses: SaleCourse[] }> {
  const rows = await getPrisma().course.findMany({
    where: { status: "PUBLISHED" },
    include: {
      modules: {
        where: { status: "PUBLISHED" },
        include: { lessons: { where: { status: "PUBLISHED" } } },
      },
    },
  });
  const lessons: SaleLesson[] = [];
  const modules: SaleModule[] = [];
  const courses: SaleCourse[] = [];
  for (const course of rows) {
    const coursePaid: string[] = [];
    let courseLessonCount = 0;
    for (const moduleRow of course.modules) {
      const paid = moduleRow.lessons.filter((lesson) => lesson.accessType === "PAID");
      const paidIds = paid.map((lesson) => lesson.id);
      coursePaid.push(...paidIds);
      courseLessonCount += moduleRow.lessons.length;
      for (const lesson of moduleRow.lessons) {
        lessons.push({
          id: lesson.id,
          slug: lesson.slug,
          title: lesson.title,
          accessType: lesson.accessType,
          status: lesson.status,
          commerceStatus: lesson.commerceStatus,
          priceCents: lesson.priceCents,
          moduleId: moduleRow.id,
          courseId: course.id,
        });
      }
      modules.push({
        id: moduleRow.id,
        slug: moduleRow.slug,
        title: moduleRow.title,
        status: moduleRow.status,
        commerceStatus: moduleRow.commerceStatus,
        bundlePriceCents: moduleRow.bundlePriceCents,
        courseId: course.id,
        paidLessonIds: paidIds,
        lessonCount: moduleRow.lessons.length,
      });
    }
    courses.push({
      id: course.id,
      slug: course.slug,
      title: course.title,
      status: course.status,
      commerceStatus: course.commerceStatus,
      bundlePriceCents: course.bundlePriceCents,
      paidLessonIds: coursePaid,
      lessonCount: courseLessonCount,
    });
  }
  return { lessons, modules, courses };
}

export async function loadCreditSources(userId: string): Promise<CreditSource[]> {
  const orders = await getPrisma().order.findMany({
    where: { userId, status: "PAID" },
    include: { items: { include: { lessons: true } } },
  });
  return orders.flatMap((order) =>
    order.items.map((item) => ({
      orderItemId: item.id,
      finalPriceCents: item.finalPriceCents,
      lessonIds: item.lessons.map((lesson) => lesson.lessonId),
    })),
  );
}

export async function loadOwnedLessonIds(userId: string): Promise<string[]> {
  const rows = await getPrisma().entitlement.findMany({
    where: { userId, status: "ACTIVE" },
    select: { lessonId: true },
    distinct: ["lessonId"],
  });
  return rows.map((row) => row.lessonId);
}
