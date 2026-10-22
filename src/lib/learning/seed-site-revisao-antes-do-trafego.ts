import { commerceStatusMatches, preserveCommerce } from "@/lib/learning/catalog-commerce";
import { planUsedContent } from "@/lib/learning/content-guard";
import { assessLesson } from "@/lib/editorial/readiness";
import { getPrisma } from "@/lib/db/prisma";
import { SITE_LESSON_12_SLUG, siteLesson12Blocks, siteLesson12Meta } from "@/lib/learning/site-revisao-antes-do-trafego";

type Prisma = ReturnType<typeof getPrisma>;

export type SiteLesson12SeedReport = {
  slug: string;
  applied: boolean;
  skipped: boolean;
  removed: string[];
  retired: string[];
  usage: Record<string, number>;
  ready: boolean;
  issues: string[];
  status: "DRAFT" | "PUBLISHED";
  activeBlocks: number;
};

/**
 * Conteúdo definitivo da Aula 12. Publica a Lesson PAID internamente.
 * Course permanece DRAFT e commerce permanece NOT_FOR_SALE.
 * Não publica a landing page e não ativa a venda da aula.
 */
export async function seedSiteRevisaoAntesDoTrafegoContent(
  prisma: Prisma = getPrisma(),
  options: { preserveCommerceStatus?: boolean } = {},
): Promise<SiteLesson12SeedReport> {
  const lesson = await prisma.lesson.findUnique({ where: { slug: SITE_LESSON_12_SLUG } });
  if (!lesson) {
    throw new Error("Aula revisao-antes-do-trafego não encontrada. O scaffold precisa existir antes do seed de conteúdo.");
  }

  const where = { lessonId: lesson.id };
  const usage = {
    progress: await prisma.lessonProgress.count({ where }),
    blockProgress: await prisma.lessonBlockProgress.count({ where }),
    responses: await prisma.lessonResponse.count({ where }),
    notes: await prisma.lessonNote.count({ where }),
    bookmarks: await prisma.lessonBookmark.count({ where }),
    results: await prisma.lessonResult.count({ where }),
  };
  const inUse = Object.values(usage).some((count) => count > 0);
  const existing = await prisma.lessonBlock.findMany({ where, orderBy: { position: "asc" } });
  const keepSale = preserveCommerce(options);
  const blockPlan = planUsedContent(existing, siteLesson12Blocks, inUse);
  if (blockPlan.kind === "stop") {
    throw new Error(`Aula Sites 12 já tem uso de aluno. ${blockPlan.reason} Nada foi alterado. ${JSON.stringify(usage)}`);
  }
  if (inUse && !metadataMatches(lesson, keepSale)) {
    throw new Error(`Aula Sites 12 já tem uso de aluno e os metadados divergem. Nada foi alterado. ${JSON.stringify(usage)}`);
  }
  if (blockPlan.kind === "skip") {
    return report(lesson.status, existing.filter((block) => !block.retiredAt).length, usage, true, true, [], []);
  }
  if (blockPlan.kind === "append") {
    for (const block of siteLesson12Blocks) {
      if (!blockPlan.keys.includes(block.blockKey)) continue;
      await prisma.lessonBlock.create({
        data: {
          lessonId: lesson.id,
          blockKey: block.blockKey,
          type: block.data.type,
          position: block.position,
          payload: block.data,
          countsForProgress: block.countsForProgress,
          required: block.required,
          retiredAt: null,
        },
      });
    }
    const active = await prisma.lessonBlock.count({ where: { lessonId: lesson.id, retiredAt: null } });
    return report("PUBLISHED", active, usage, true, false, [], []);
  }

  const assessment = assessLesson(lessonReadyInput(), siteLesson12Blocks.map(readyBlock));
  if (!assessment.ready) {
    throw new Error(`Aula Sites 12 não passou na validação editorial. ${assessment.issues.join(" ")}`);
  }

  await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      title: siteLesson12Meta.title,
      summary: siteLesson12Meta.summary,
      publicPreview: siteLesson12Meta.publicPreview,
      estimatedMinutes: siteLesson12Meta.estimatedMinutes,
      accessType: "PAID",
      priceCents: siteLesson12Meta.priceCents,
      commerceStatus: "NOT_FOR_SALE",
      status: "PUBLISHED",
      publishedAt: lesson.publishedAt ?? new Date(),
    },
  });

  const desiredKeys = new Set(siteLesson12Blocks.map((block) => block.blockKey));
  for (const block of siteLesson12Blocks) {
    const current = existing.find((item) => item.blockKey === block.blockKey);
    const data = {
      type: block.data.type,
      position: block.position,
      payload: block.data,
      countsForProgress: block.countsForProgress,
      required: block.required,
      retiredAt: null,
    };
    if (!current) {
      await prisma.lessonBlock.create({ data: { lessonId: lesson.id, blockKey: block.blockKey, ...data } });
    } else {
      await prisma.lessonBlock.update({ where: { id: current.id }, data });
    }
  }

  const removed: string[] = [];
  const retired: string[] = [];
  for (const current of existing) {
    if (desiredKeys.has(current.blockKey)) continue;
    const dependents = await blockDependents(prisma, lesson.id, current.blockKey);
    if (dependents > 0) {
      await prisma.lessonBlock.update({ where: { id: current.id }, data: { retiredAt: current.retiredAt ?? new Date() } });
      retired.push(current.blockKey);
    } else {
      await prisma.lessonBlock.delete({ where: { id: current.id } });
      removed.push(current.blockKey);
    }
  }

  const active = await prisma.lessonBlock.count({ where: { lessonId: lesson.id, retiredAt: null } });
  return report("PUBLISHED", active, usage, true, false, removed, retired);
}

function report(
  status: "DRAFT" | "PUBLISHED",
  activeBlocks: number,
  usage: SiteLesson12SeedReport["usage"],
  ready: boolean,
  skipped: boolean,
  removed: string[],
  retired: string[],
): SiteLesson12SeedReport {
  return { slug: SITE_LESSON_12_SLUG, applied: !skipped, skipped, removed, retired, usage, ready, issues: [], status, activeBlocks };
}

function lessonReadyInput() {
  return {
    title: siteLesson12Meta.title,
    summary: siteLesson12Meta.summary,
    publicPreview: siteLesson12Meta.publicPreview,
    estimatedMinutes: siteLesson12Meta.estimatedMinutes,
    accessType: "PAID" as const,
    status: "PUBLISHED" as const,
    priceCents: siteLesson12Meta.priceCents,
    commerceStatus: "NOT_FOR_SALE" as const,
  };
}

function readyBlock(block: (typeof siteLesson12Blocks)[number]) {
  return { blockKey: block.blockKey, retiredAt: null, payload: block.data };
}

function metadataMatches(
  lesson: {
    title: string;
    summary: string;
    publicPreview: string | null;
    estimatedMinutes: number | null;
    accessType: string;
    priceCents: number | null;
    commerceStatus: string;
    status: string;
  },
  preserveCommerceStatus: boolean,
) {
  return (
    lesson.title === siteLesson12Meta.title &&
    lesson.summary === siteLesson12Meta.summary &&
    lesson.publicPreview === siteLesson12Meta.publicPreview &&
    lesson.estimatedMinutes === siteLesson12Meta.estimatedMinutes &&
    lesson.accessType === "PAID" &&
    lesson.priceCents === siteLesson12Meta.priceCents &&
    commerceStatusMatches(lesson.commerceStatus, preserveCommerceStatus) &&
    lesson.status === "PUBLISHED"
  );
}

async function blockDependents(prisma: Prisma, lessonId: string, blockKey: string) {
  const where = { lessonId, blockKey };
  const [progress, responses, notes, bookmarks] = await Promise.all([
    prisma.lessonBlockProgress.count({ where }),
    prisma.lessonResponse.count({ where }),
    prisma.lessonNote.count({ where }),
    prisma.lessonBookmark.count({ where }),
  ]);
  return progress + responses + notes + bookmarks;
}
