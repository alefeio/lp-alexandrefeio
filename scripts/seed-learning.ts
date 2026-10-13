import { config as loadEnv } from "dotenv";
import { assertMigrationTargetAllowed } from "../src/lib/db/urls";
import { getPrisma } from "../src/lib/db/prisma";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { seedLesson01Content } from "../src/lib/learning/seed-lesson-01";
import { LESSON_02_SLUG } from "../src/lib/learning/lesson-02";
import { seedLesson02Content } from "../src/lib/learning/seed-lesson-02";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });
assertMigrationTargetAllowed();

async function main() {
  const prisma = getPrisma();
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
      commerceStatus: "NOT_FOR_SALE",
      publishedAt: now,
    },
    update: { commerceStatus: "NOT_FOR_SALE" },
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
        commerceStatus: "NOT_FOR_SALE",
      },
      update: { commerceStatus: "NOT_FOR_SALE" },
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
          commerceStatus: "NOT_FOR_SALE",
          publishedAt: now,
        },
        update: { commerceStatus: "NOT_FOR_SALE" },
      });

      if (lessonSeed.blocks.length === 0 || lessonSeed.slug === LESSON_02_SLUG) continue;
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

  const lesson01 = await seedLesson01Content(prisma);
  const lesson02 = await seedLesson02Content(prisma);
  const lessons = await prisma.lesson.count({ where: { module: { courseId: course.id } } });
  const blocks = await prisma.lessonBlock.count();
  console.log(JSON.stringify({ course: course.slug, lessons, blocks, lesson01, lesson02 }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "seed failed");
  process.exit(1);
});
