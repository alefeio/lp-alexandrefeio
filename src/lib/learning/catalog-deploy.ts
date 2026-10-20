import { getPrisma } from "@/lib/db/prisma";
import { commercePatch, commerceStatusForCreate, type CatalogCommerceOptions, preserveCommerce } from "@/lib/learning/catalog-commerce";
import { firstCourseSeed } from "@/lib/learning/first-course";
import { LESSON_02_SLUG } from "@/lib/learning/lesson-02";
import { LESSON_03_SLUG } from "@/lib/learning/lesson-03";
import { LESSON_04_SLUG } from "@/lib/learning/lesson-04";
import { LESSON_05_SLUG } from "@/lib/learning/lesson-05";
import { LESSON_06_SLUG } from "@/lib/learning/lesson-06";
import { LESSON_07_SLUG } from "@/lib/learning/lesson-07";
import { LESSON_08_SLUG } from "@/lib/learning/lesson-08";
import { LESSON_09_SLUG } from "@/lib/learning/lesson-09";
import { LESSON_10_SLUG } from "@/lib/learning/lesson-10";
import { LESSON_11_SLUG } from "@/lib/learning/lesson-11";
import { LESSON_12_SLUG } from "@/lib/learning/lesson-12";
import { seedLesson01Content } from "@/lib/learning/seed-lesson-01";
import { seedLesson02Content } from "@/lib/learning/seed-lesson-02";
import { seedLesson03Content } from "@/lib/learning/seed-lesson-03";
import { seedLesson04Content } from "@/lib/learning/seed-lesson-04";
import { seedLesson05Content } from "@/lib/learning/seed-lesson-05";
import { seedLesson06Content } from "@/lib/learning/seed-lesson-06";
import { seedLesson07Content } from "@/lib/learning/seed-lesson-07";

import { seedLesson08Content } from "@/lib/learning/seed-lesson-08";
import { seedLesson09Content } from "@/lib/learning/seed-lesson-09";
import { seedLesson10Content } from "@/lib/learning/seed-lesson-10";
import { seedLesson11Content } from "@/lib/learning/seed-lesson-11";
import { seedLesson12Content } from "@/lib/learning/seed-lesson-12";
import { seedSiteAjudaAVenderContent } from "@/lib/learning/seed-site-ajuda-a-vender";
import { seedSiteLandingWhatsappContent } from "@/lib/learning/seed-site-landing-page-ou-whatsapp";
import { SITE_LESSON_01_SLUG } from "@/lib/learning/site-ajuda-a-vender";
import { SITE_LESSON_02_SLUG } from "@/lib/learning/site-landing-page-ou-whatsapp";
import { sitesCourseSeed } from "@/lib/learning/sites-course";

const contentOwned = new Set([LESSON_02_SLUG, LESSON_03_SLUG, LESSON_04_SLUG, LESSON_05_SLUG, LESSON_06_SLUG, LESSON_07_SLUG, LESSON_08_SLUG, LESSON_09_SLUG, LESSON_10_SLUG, LESSON_11_SLUG, LESSON_12_SLUG]);

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
  const lesson07 = await seedLesson07Content(prisma, seedOptions);
  const lesson08 = await seedLesson08Content(prisma, seedOptions);
  const lesson09 = await seedLesson09Content(prisma, seedOptions);
  const lesson10 = await seedLesson10Content(prisma, seedOptions);
  const lesson11 = await seedLesson11Content(prisma, seedOptions);
  const lesson12 = await seedLesson12Content(prisma, seedOptions);
  const lessons = await prisma.lesson.count({ where: { module: { courseId: course.id } } });
  const blocks = await prisma.lessonBlock.count({ where: { lesson: { module: { courseId: course.id } } } });
  const sitesCourse = await deploySitesCourseScaffold();
  const siteLesson01 = await seedSiteAjudaAVenderContent(prisma, seedOptions);
  const siteLesson02 = await seedSiteLandingWhatsappContent(prisma, seedOptions);
  return {
    course: course.slug,
    lessons,
    blocks,
    lesson01,
    lesson02,
    lesson03,
    lesson04,
    lesson05,
    lesson06,
    lesson07,
    lesson08,
    lesson09,
    lesson10,
    lesson11,
    lesson12,
    sitesCourse,
    siteLesson01,
    siteLesson02,
  };
}

/**
 * Scaffold do segundo curso: DRAFT, NOT_FOR_SALE, sem blocos.
 * Idempotente por slug. Não publica, não ativa venda e não cria Tool/LessonResult.
 */
export async function deploySitesCourseScaffold() {
  const prisma = getPrisma();
  const course = await prisma.course.upsert({
    where: { slug: sitesCourseSeed.slug },
    create: {
      slug: sitesCourseSeed.slug,
      title: sitesCourseSeed.title,
      subtitle: sitesCourseSeed.subtitle,
      description: sitesCourseSeed.description,
      status: "DRAFT",
      sortOrder: sitesCourseSeed.sortOrder,
      bundlePriceCents: sitesCourseSeed.bundlePriceCents,
      commerceStatus: commerceStatusForCreate(),
      publishedAt: null,
    },
    update: {
      title: sitesCourseSeed.title,
      subtitle: sitesCourseSeed.subtitle,
      description: sitesCourseSeed.description,
      sortOrder: sitesCourseSeed.sortOrder,
      bundlePriceCents: sitesCourseSeed.bundlePriceCents,
      status: "DRAFT",
      commerceStatus: "NOT_FOR_SALE",
      publishedAt: null,
    },
  });

  let modules = 0;
  let lessons = 0;
  for (const moduleSeed of sitesCourseSeed.modules) {
    const moduleRow = await prisma.module.upsert({
      where: { courseId_slug: { courseId: course.id, slug: moduleSeed.slug } },
      create: {
        courseId: course.id,
        slug: moduleSeed.slug,
        title: moduleSeed.title,
        description: moduleSeed.description,
        status: "DRAFT",
        sortOrder: moduleSeed.sortOrder,
        bundlePriceCents: moduleSeed.bundlePriceCents,
        commerceStatus: commerceStatusForCreate(),
      },
      update: {
        title: moduleSeed.title,
        description: moduleSeed.description,
        sortOrder: moduleSeed.sortOrder,
        bundlePriceCents: moduleSeed.bundlePriceCents,
        status: "DRAFT",
        commerceStatus: "NOT_FOR_SALE",
      },
    });
    modules += 1;

    for (const lessonSeed of moduleSeed.lessons) {
      const contentOwned = lessonSeed.slug === SITE_LESSON_01_SLUG || lessonSeed.slug === SITE_LESSON_02_SLUG;
      await prisma.lesson.upsert({
        where: { slug: lessonSeed.slug },
        create: {
          moduleId: moduleRow.id,
          slug: lessonSeed.slug,
          title: lessonSeed.title,
          summary: lessonSeed.summary,
          publicPreview: lessonSeed.publicPreview,
          estimatedMinutes: lessonSeed.estimatedMinutes,
          sortOrder: lessonSeed.sortOrder,
          status: "DRAFT",
          accessType: lessonSeed.accessType,
          priceCents: lessonSeed.priceCents,
          commerceStatus: commerceStatusForCreate(),
          publishedAt: null,
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
          commerceStatus: "NOT_FOR_SALE",
          ...(contentOwned
            ? {}
            : {
                status: "DRAFT" as const,
                publishedAt: null,
              }),
        },
      });
      lessons += 1;
    }
  }

  const blockCount = await prisma.lessonBlock.count({
    where: { lesson: { module: { courseId: course.id } } },
  });

  return {
    course: course.slug,
    status: course.status,
    commerceStatus: course.commerceStatus,
    modules,
    lessons,
    blocks: blockCount,
  };
}
