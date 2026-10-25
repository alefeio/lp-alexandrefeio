import { assessLesson } from "@/lib/editorial/readiness";
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
import { seedSitePaginaProntaContent } from "@/lib/learning/seed-site-pagina-pronta-para-converter";
import { seedSiteOfertaPublicoContent } from "@/lib/learning/seed-site-oferta-publico-acao-principal";
import { seedSiteJornadaVisitanteContent } from "@/lib/learning/seed-site-jornada-do-visitante";
import { seedSiteOrganizeSecoesContent } from "@/lib/learning/seed-site-organize-as-secoes-da-pagina";
import { seedSiteMensagemOfertaContent } from "@/lib/learning/seed-site-mensagem-que-deixa-a-oferta-clara";
import { seedSiteHierarquiaVisualContent } from "@/lib/learning/seed-site-hierarquia-visual-e-atencao";
import { seedSiteConstruaConfiancaContent } from "@/lib/learning/seed-site-construa-confianca";
import { seedSitePaginaMobileExperienciaContent } from "@/lib/learning/seed-site-pagina-mobile-e-experiencia";
import { seedSiteConfigureOQuePrecisaSerMedidoContent } from "@/lib/learning/seed-site-configure-o-que-precisa-ser-medido";
import { seedSiteRevisaoAntesDoTrafegoContent } from "@/lib/learning/seed-site-revisao-antes-do-trafego";
import { reconcileSiteLesson11Slug } from "@/lib/learning/site-lesson-11-slug";
import { sitesCourseLessons, sitesCourseSeed } from "@/lib/learning/sites-course";

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
  await deploySitesCourseScaffold({ preserveCommerceStatus: keepSale });
  const siteLesson01 = await seedSiteAjudaAVenderContent(prisma, seedOptions);
  const siteLesson02 = await seedSiteLandingWhatsappContent(prisma, seedOptions);
  const siteLesson03 = await seedSitePaginaProntaContent(prisma, seedOptions);
  const siteLesson04 = await seedSiteOfertaPublicoContent(prisma, seedOptions);
  const siteLesson05 = await seedSiteJornadaVisitanteContent(prisma, seedOptions);
  const siteLesson06 = await seedSiteOrganizeSecoesContent(prisma, seedOptions);
  const siteLesson07 = await seedSiteMensagemOfertaContent(prisma, seedOptions);
  const siteLesson08 = await seedSiteHierarquiaVisualContent(prisma, seedOptions);
  const siteLesson09 = await seedSiteConstruaConfiancaContent(prisma, seedOptions);
  const siteLesson10 = await seedSitePaginaMobileExperienciaContent(prisma, seedOptions);
  const siteLesson11 = await seedSiteConfigureOQuePrecisaSerMedidoContent(prisma, seedOptions);
  const siteLesson12 = await seedSiteRevisaoAntesDoTrafegoContent(prisma, seedOptions);
  const sitesCourse = await publishSitesCourseCatalog();
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
    siteLesson03,
    siteLesson04,
    siteLesson05,
    siteLesson06,
    siteLesson07,
    siteLesson08,
    siteLesson09,
    siteLesson10,
    siteLesson11,
    siteLesson12,
  };
}

/**
 * Estrutura do segundo curso. Registro novo nasce DRAFT e NOT_FOR_SALE.
 * O update preserva commerceStatus e não devolve curso, módulo ou aula para DRAFT.
 * A publicação do curso só acontece depois dos seeds, em publishSitesCourseCatalog.
 * Não cria Tool/LessonResult, LandingPageProject nem marca AVAILABLE.
 */
export async function deploySitesCourseScaffold(options: CatalogCommerceOptions = {}) {
  const prisma = getPrisma();
  const keepSale = preserveCommerce(options);
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
      ...commercePatch(keepSale),
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
        ...commercePatch(keepSale),
      },
    });
    modules += 1;

    await reconcileSiteLesson11Slug(
      {
        findLessons: (moduleId) => prisma.lesson.findMany({ where: { moduleId }, select: { id: true, slug: true, moduleId: true } }),
        renameLesson: async (id, slug) => {
          await prisma.lesson.update({ where: { id }, data: { slug } });
        },
      },
      moduleRow.id,
    );

    for (const lessonSeed of moduleSeed.lessons) {
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
          ...commercePatch(keepSale),
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

/**
 * Publica módulos e curso somente depois que as 12 aulas passaram na prontidão.
 * Não altera commerceStatus.
 */
export async function publishSitesCourseCatalog() {
  const prisma = getPrisma();
  const course = await prisma.course.findUnique({
    where: { slug: sitesCourseSeed.slug },
    include: {
      modules: {
        include: {
          lessons: { include: { blocks: { select: { blockKey: true, retiredAt: true, payload: true } } } },
        },
      },
    },
  });
  if (!course) throw new Error("Curso Sites não encontrado. O scaffold precisa existir antes da publicação.");

  const lessons = course.modules.flatMap((moduleRow) => moduleRow.lessons);
  for (const expected of sitesCourseLessons()) {
    const row = lessons.find((lesson) => lesson.slug === expected.slug);
    if (!row || row.status !== "PUBLISHED" || row.accessType !== expected.accessType) {
      throw new Error(`Aula ${expected.slug} ainda não está pronta para publicar o curso.`);
    }
    const assessment = assessLesson(
      {
        title: row.title,
        summary: row.summary,
        publicPreview: row.publicPreview,
        estimatedMinutes: row.estimatedMinutes,
        accessType: row.accessType,
        status: row.status,
        priceCents: row.priceCents,
        commerceStatus: row.commerceStatus,
      },
      row.blocks,
    );
    if (!assessment.ready) {
      throw new Error(`Aula ${expected.slug} não passou na prontidão editorial. ${assessment.issues.join(" ")}`);
    }
  }

  const now = new Date();
  for (const moduleRow of course.modules) {
    await prisma.module.update({ where: { id: moduleRow.id }, data: { status: "PUBLISHED" } });
  }
  const published = await prisma.course.update({
    where: { id: course.id },
    data: { status: "PUBLISHED", publishedAt: course.publishedAt ?? now },
  });
  const blockCount = await prisma.lessonBlock.count({
    where: { lesson: { module: { courseId: course.id } } },
  });
  return {
    course: published.slug,
    status: published.status,
    commerceStatus: published.commerceStatus,
    modules: course.modules.length,
    lessons: lessons.length,
    blocks: blockCount,
  };
}
