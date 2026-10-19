import { commercePatch, commerceStatusMatches, preserveCommerce } from "@/lib/learning/catalog-commerce";
import { planUsedContent } from "@/lib/learning/content-guard";
import { assessLesson } from "@/lib/editorial/readiness";
import { LESSON_08_SLUG, lesson08Blocks, lesson08Meta } from "@/lib/learning/lesson-08";
import { LESSON_08_PUBLIC_PREVIEW_KEYS } from "@/lib/learning/public-preview";
import { getPrisma } from "@/lib/db/prisma";

type Prisma = ReturnType<typeof getPrisma>;

export type Lesson08SeedReport = {
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

export async function seedLesson08Content(
  prisma: Prisma = getPrisma(),
  options: { preserveCommerceStatus?: boolean } = {},
): Promise<Lesson08SeedReport> {
  const lesson = await prisma.lesson.findUnique({ where: { slug: LESSON_08_SLUG } });
  if (!lesson) throw new Error("Aula 8 não encontrada. O seed não cria uma segunda aula.");
  const duplicates = await prisma.lesson.count({ where: { slug: LESSON_08_SLUG } });
  if (duplicates !== 1) throw new Error("Aula 8 apareceu mais de uma vez.");

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
  const blockPlan = planUsedContent(existing, lesson08Blocks, inUse);
  if (blockPlan.kind === "stop") {
    throw new Error(`Aula 8 já tem uso de aluno. ${blockPlan.reason} Nada foi alterado. ${JSON.stringify(usage)}`);
  }
  if (inUse && !metadataMatches(lesson, keepSale)) {
    throw new Error(`Aula 8 já tem uso de aluno e os metadados divergem. Nada foi alterado. ${JSON.stringify(usage)}`);
  }
  if (blockPlan.kind === "skip") {
    await markPublicPreview(prisma, lesson.id, LESSON_08_PUBLIC_PREVIEW_KEYS);
    return report(lesson.status, existing.filter((block) => !block.retiredAt).length, usage, true, true, [], []);
  }
  if (blockPlan.kind === "append") {
    for (const block of lesson08Blocks) {
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
          isPublicPreview: (LESSON_08_PUBLIC_PREVIEW_KEYS as readonly string[]).includes(block.blockKey),
          retiredAt: null,
        },
      });
    }
    await markPublicPreview(prisma, lesson.id, LESSON_08_PUBLIC_PREVIEW_KEYS);
    const active = await prisma.lessonBlock.count({ where: { lessonId: lesson.id, retiredAt: null } });
    return report("PUBLISHED", active, usage, true, false, [], []);
  }

  const assessment = assessLesson(lessonReadyInput(), lesson08Blocks.map(readyBlock));
  if (!assessment.ready) {
    throw new Error(`Aula 8 não passou na validação editorial. ${assessment.issues.join(" ")}`);
  }

  await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      title: lesson08Meta.title,
      summary: lesson08Meta.summary,
      publicPreview: lesson08Meta.publicPreview,
      estimatedMinutes: lesson08Meta.estimatedMinutes,
      accessType: "PAID",
      priceCents: lesson08Meta.priceCents,
      ...commercePatch(keepSale),
      status: "PUBLISHED",
      publishedAt: lesson.publishedAt ?? new Date(),
    },
  });

  const desiredKeys = new Set(lesson08Blocks.map((block) => block.blockKey));
  for (const block of lesson08Blocks) {
    const current = existing.find((item) => item.blockKey === block.blockKey);
    const data = {
      type: block.data.type,
      position: block.position,
      payload: block.data,
      countsForProgress: block.countsForProgress,
      required: block.required,
      isPublicPreview: (LESSON_08_PUBLIC_PREVIEW_KEYS as readonly string[]).includes(block.blockKey),
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
  usage: Lesson08SeedReport["usage"],
  ready: boolean,
  skipped: boolean,
  removed: string[],
  retired: string[],
): Lesson08SeedReport {
  return {
    slug: LESSON_08_SLUG,
    applied: !skipped,
    skipped,
    removed,
    retired,
    usage,
    ready,
    issues: [],
    status,
    activeBlocks,
  };
}

function lessonReadyInput() {
  return {
    title: lesson08Meta.title,
    summary: lesson08Meta.summary,
    publicPreview: lesson08Meta.publicPreview,
    estimatedMinutes: lesson08Meta.estimatedMinutes,
    accessType: "PAID" as const,
    status: "PUBLISHED" as const,
    priceCents: lesson08Meta.priceCents,
    commerceStatus: "NOT_FOR_SALE" as const,
  };
}

function readyBlock(block: (typeof lesson08Blocks)[number]) {
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
    lesson.title === lesson08Meta.title &&
    lesson.summary === lesson08Meta.summary &&
    lesson.publicPreview === lesson08Meta.publicPreview &&
    lesson.estimatedMinutes === lesson08Meta.estimatedMinutes &&
    lesson.accessType === "PAID" &&
    lesson.priceCents === lesson08Meta.priceCents &&
    commerceStatusMatches(lesson.commerceStatus, preserveCommerceStatus) &&
    lesson.status === "PUBLISHED"
  );
}

async function markPublicPreview(prisma: Prisma, lessonId: string, keys: readonly string[]) {
  await prisma.lessonBlock.updateMany({
    where: { lessonId, retiredAt: null, blockKey: { in: [...keys] } },
    data: { isPublicPreview: true },
  });
  await prisma.lessonBlock.updateMany({
    where: { lessonId, retiredAt: null, blockKey: { notIn: [...keys] } },
    data: { isPublicPreview: false },
  });
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
