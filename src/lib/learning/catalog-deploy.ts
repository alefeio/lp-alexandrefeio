import { getPrisma } from "@/lib/db/prisma";
import { commercePatch, commerceStatusForCreate, type CatalogCommerceOptions, preserveCommerce } from "@/lib/learning/catalog-commerce";
import { firstCourseSeed } from "@/lib/learning/first-course";
import { LESSON_02_SLUG } from "@/lib/learning/lesson-02";
import { LESSON_03_SLUG } from "@/lib/learning/lesson-03";
import { LESSON_04_SLUG } from "@/lib/learning/lesson-04";
import { LESSON_05_SLUG } from "@/lib/learning/lesson-05";
import { LESSON_06_SLUG } from "@/lib/learning/lesson-06";
import { seedLesson01Content } from "@/lib/learning/seed-lesson-01";
import { seedLesson02Content } from "@/lib/learning/seed-lesson-02";
import { seedLesson03Content } from "@/lib/learning/seed-lesson-03";
import { seedLesson04Content } from "@/lib/learning/seed-lesson-04";
import { seedLesson05Content } from "@/lib/learning/seed-lesson-05";
import { seedLesson06Content } from "@/lib/learning/seed-lesson-06";

const contentOwned = new Set([LESSON_02_SLUG, LESSON_03_SLUG, LESSON_04_SLUG, LESSON_05_SLUG, LESSON_06_SLUG]);

/**
 * Upsert do catálogo aprovado. Não apaga progresso, projeto, diagnóstico, pedido ou entitlement.
 * Registro novo nasce NOT_FOR_SALE. Registro existente preserva commerceStatus.
 * db:seed e catalog:deploy usam o mesmo banco físico de production e não fecham a venda.
 * Preço aprovado continua sendo sincronizado. Este comando não marca AVAILABLE.
 */
export async function deployLearningCatalog(options: CatalogCommerceOptions = {}) {
  const prisma = getPrisma();
  const keepSale = preserveCommerce(options);
  const now = new Date();
  const course = await prisma.course.upsert({
    where: { slug: firstCourseSeed.slug },
    create: {
      slug: firstCourseSeed.slug,
      title: firstCourseSeed.title,
      subtitle: firstCourseSeed.subtitle,
      description: firstCourseSeed.description,
      status: "PUBLISHED",
      sortOrder: 0,
      bundlePriceCents: firstCourseSeed.bundlePriceCents,
      commerceStatus: commerceStatusForCreate(),
      publishedAt: now,
    },
    update: {
      title: firstCourseSeed.title,
      subtitle: firstCourseSeed.subtitle,
      description: firstCourseSeed.description,
      bundlePriceCents: firstCourseSeed.bundlePriceCents,
      status: "PUBLISHED",
      ...commercePatch(keepSale),
    },
  });

  for (const moduleSeed of firstCourseSeed.modules) {
    const moduleRow = await prisma.module.upsert({
      where: { courseId_slug: { courseId: course.id, slug: moduleSeed.slug } },
      create: {
        courseId: course.id,
        slug: moduleSeed.slug,
        title: moduleSeed.title,
        description: moduleSeed.description,
        status: "PUBLISHED",
        sortOrder: moduleSeed.sortOrder,
        bundlePriceCents: moduleSeed.bundlePriceCents,
        commerceStatus: commerceStatusForCreate(),
      },
      update: {
        title: moduleSeed.title,
        description: moduleSeed.description,
        sortOrder: moduleSeed.sortOrder,
        bundlePriceCents: moduleSeed.bundlePriceCents,
        status: "PUBLISHED",
        ...commercePatch(keepSale),
      },
    });

    for (const lessonSeed of moduleSeed.lessons) {
      const lesson = await prisma.lesson.upsert({
        where: { slug: lessonSeed.slug },
        create: {
          moduleId: moduleRow.id,
          slug: lessonSeed.slug,
          title: lessonSeed.title,
          summary: lessonSeed.summary,
          publicPreview: lessonSeed.publicPreview,
          estimatedMinutes: lessonSeed.estimatedMinutes,
          sortOrder: lessonSeed.sortOrder,
          status: "PUBLISHED",
          accessType: lessonSeed.accessType,
          priceCents: lessonSeed.priceCents,
          commerceStatus: commerceStatusForCreate(),
          publishedAt: now,
        },
        update: {
          moduleId: moduleRow.id,
          title: lessonSeed.title,
          summary: lessonSeed.summary,
          publicPreview: lessonSeed.publicPreview,
          estimatedMinutes: lessonSeed.estimatedMinutes,
          sortOrder: lessonSeed.sortOrder,
          accessType: lessonSeed.accessType,
          priceCents: lessonSeed.priceCents,
          status: "PUBLISHED",
          ...commercePatch(keepSale),
        },
      });

      if (lessonSeed.blocks.length === 0 || contentOwned.has(lessonSeed.slug)) continue;
      const existingBlocks = await prisma.lessonBlock.count({ where: { lessonId: lesson.id } });
      if (existingBlocks > 0) continue;

      await prisma.lessonBlock.createMany({
        data: lessonSeed.blocks.map((block) => ({
          lessonId: lesson.id,
          blockKey: block.blockKey,
          type: block.data.type,
          position: block.position,
          payload: block.data,
          countsForProgress: block.countsForProgress,
          required: block.required,
        })),
      });
    }
  }

  const seedOptions = { preserveCommerceStatus: keepSale };
  const lesson01 = await seedLesson01Content(prisma, seedOptions);
  const lesson02 = await seedLesson02Content(prisma, seedOptions);
  const lesson03 = await seedLesson03Content(prisma, seedOptions);
  const lesson04 = await seedLesson04Content(prisma, seedOptions);
  const lesson05 = await seedLesson05Content(prisma, seedOptions);
  const lesson06 = await seedLesson06Content(prisma, seedOptions);
  const lessons = await prisma.lesson.count({ where: { module: { courseId: course.id } } });
  const blocks = await prisma.lessonBlock.count({ where: { lesson: { module: { courseId: course.id } } } });
  return { course: course.slug, lessons, blocks, lesson01, lesson02, lesson03, lesson04, lesson05, lesson06 };
}
