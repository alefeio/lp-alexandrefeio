import { commercePatch, commerceStatusMatches, preserveCommerce } from "@/lib/learning/catalog-commerce";
import { planUsedContent } from "@/lib/learning/content-guard";
import { assessLesson } from "@/lib/editorial/readiness";
import { LESSON_06_SLUG, lesson06Blocks, lesson06Meta } from "@/lib/learning/lesson-06";
import { LESSON_06_PUBLIC_PREVIEW_KEYS } from "@/lib/learning/public-preview";
import { getPrisma } from "@/lib/db/prisma";

type Prisma = ReturnType<typeof getPrisma>;

export type Lesson06SeedReport = {
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

export async function seedLesson06Content(
  prisma: Prisma = getPrisma(),
  options: { preserveCommerceStatus?: boolean } = {},
): Promise<Lesson06SeedReport> {
  const lesson = await prisma.lesson.findUnique({ where: { slug: LESSON_06_SLUG } });
  if (!lesson) {
    throw new Error("Aula 6 não encontrada. O seed não cria uma segunda aula.");
  }
  const duplicates = await prisma.lesson.count({ where: { slug: LESSON_06_SLUG } });
  if (duplicates !== 1) throw new Error("Aula 6 apareceu mais de uma vez.");

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
  const blockPlan = planUsedContent(existing, lesson06Blocks, inUse);
  if (blockPlan.kind === "stop") {
    throw new Error(`Aula 6 já tem uso de aluno. ${blockPlan.reason} Nada foi alterado. ${JSON.stringify(usage)}`);
  }
  if (inUse && !metadataMatches(lesson, keepSale)) {
    throw new Error(`Aula 6 já tem uso de aluno e os metadados divergem. Nada foi alterado. ${JSON.stringify(usage)}`);
  }
  if (blockPlan.kind === "skip") {
    await markPublicPreview(prisma, lesson.id, LESSON_06_PUBLIC_PREVIEW_KEYS);
    return report(lesson.status, existing.filter((block) => !block.retiredAt).length, usage, true, true, [], []);
  }
  if (blockPlan.kind === "append") {
    for (const block of lesson06Blocks) {
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
          isPublicPreview: (LESSON_06_PUBLIC_PREVIEW_KEYS as readonly string[]).includes(block.blockKey),
          retiredAt: null,
        },
      });
    }
    await markPublicPreview(prisma, lesson.id, LESSON_06_PUBLIC_PREVIEW_KEYS);
    const active = await prisma.lessonBlock.count({ where: { lessonId: lesson.id, retiredAt: null } });
    return report("PUBLISHED", active, usage, true, false, [], []);
  }

  const assessment = assessLesson(lessonReadyInput(), lesson06Blocks.map(readyBlock));
  if (!assessment.ready) {
    throw new Error(`Aula 6 não passou na validação editorial. ${assessment.issues.join(" ")}`);
  }

  await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      title: lesson06Meta.title,
      summary: lesson06Meta.summary,
      publicPreview: lesson06Meta.publicPreview,
      estimatedMinutes: lesson06Meta.estimatedMinutes,
      accessType: "PAID",
      priceCents: lesson06Meta.priceCents,
      ...commercePatch(keepSale),
      status: "PUBLISHED",
      publishedAt: lesson.publishedAt ?? new Date(),
    },
  });

  const desiredKeys = new Set(lesson06Blocks.map((block) => block.blockKey));
  for (const block of lesson06Blocks) {
    const current = existing.find((item) => item.blockKey === block.blockKey);
    const data = {
      type: block.data.type,
      position: block.position,
      payload: block.data,
      countsForProgress: block.countsForProgress,
      required: block.required,
      isPublicPreview: (LESSON_06_PUBLIC_PREVIEW_KEYS as readonly string[]).includes(block.blockKey),
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
  usage: Lesson06SeedReport["usage"],
  ready: boolean,
  skipped: boolean,
  removed: string[],
  retired: string[],
): Lesson06SeedReport {
  return {
    slug: LESSON_06_SLUG,
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
    title: lesson06Meta.title,
    summary: lesson06Meta.summary,
    publicPreview: lesson06Meta.publicPreview,
    estimatedMinutes: lesson06Meta.estimatedMinutes,
    accessType: "PAID" as const,
    status: "PUBLISHED" as const,
    priceCents: lesson06Meta.priceCents,
    commerceStatus: "NOT_FOR_SALE" as const,
  };
}

function readyBlock(block: (typeof lesson06Blocks)[number]) {
  return { blockKey: block.blockKey, retiredAt: null, payload: block.data };
}

function metadataMatches(lesson: {
  title: string;
  summary: string;
  publicPreview: string | null;
  estimatedMinutes: number | null;
  accessType: string;
  priceCents: number | null;
  commerceStatus: string;
  status: string;
}, preserveCommerceStatus: boolean) {
  return (
    lesson.title === lesson06Meta.title &&
    lesson.summary === lesson06Meta.summary &&
    lesson.publicPreview === lesson06Meta.publicPreview &&
    lesson.estimatedMinutes === lesson06Meta.estimatedMinutes &&
    lesson.accessType === "PAID" &&
    lesson.priceCents === lesson06Meta.priceCents &&
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
