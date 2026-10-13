import { parseBlockData } from "@/lib/learning/blocks";
import { assessLesson } from "@/lib/editorial/readiness";
import { LESSON_01_SLUG, lesson01Blocks, lesson01Meta } from "@/lib/learning/lesson-01";
import { getPrisma } from "@/lib/db/prisma";

type Prisma = ReturnType<typeof getPrisma>;

export type Lesson01SeedReport = {
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

export async function seedLesson01Content(prisma: Prisma = getPrisma()): Promise<Lesson01SeedReport> {
  const lesson = await prisma.lesson.findUnique({ where: { slug: LESSON_01_SLUG } });
  if (!lesson) {
    throw new Error("Aula 1 não encontrada. O seed não cria uma segunda aula.");
  }
  const duplicates = await prisma.lesson.count({ where: { slug: LESSON_01_SLUG } });
  if (duplicates !== 1) throw new Error("Aula 1 apareceu mais de uma vez.");

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
  const appliedAlready = blocksMatch(existing) && metadataMatches(lesson);
  if (inUse && !appliedAlready) {
    throw new Error(
      `Aula 1 já tem uso de aluno e o conteúdo ainda não é a versão definitiva. Nada foi alterado. ${JSON.stringify(usage)}`,
    );
  }
  if (inUse && appliedAlready) {
    return report(lesson.status, existing.filter((block) => !block.retiredAt).length, usage, true, true, [], []);
  }

  const assessment = assessLesson(lessonReadyInput(lesson.status), lesson01Blocks.map(readyBlock));
  if (!assessment.ready) {
    throw new Error(`Aula 1 não passou na validação editorial. ${assessment.issues.join(" ")}`);
  }

  await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      title: lesson01Meta.title,
      summary: lesson01Meta.summary,
      publicPreview: lesson01Meta.publicPreview,
      estimatedMinutes: lesson01Meta.estimatedMinutes,
      accessType: "FREE",
      priceCents: null,
      commerceStatus: "NOT_FOR_SALE",
      status: "PUBLISHED",
      publishedAt: lesson.publishedAt ?? new Date(),
    },
  });

  const desiredKeys = new Set(lesson01Blocks.map((block) => block.blockKey));
  for (const block of lesson01Blocks) {
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
  usage: Lesson01SeedReport["usage"],
  ready: boolean,
  skipped: boolean,
  removed: string[],
  retired: string[],
): Lesson01SeedReport {
  return {
    slug: LESSON_01_SLUG,
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

function lessonReadyInput(status: "DRAFT" | "PUBLISHED") {
  return {
    title: lesson01Meta.title,
    summary: lesson01Meta.summary,
    publicPreview: lesson01Meta.publicPreview,
    estimatedMinutes: lesson01Meta.estimatedMinutes,
    accessType: "FREE" as const,
    status,
    priceCents: null,
    commerceStatus: "NOT_FOR_SALE" as const,
  };
}

function readyBlock(block: (typeof lesson01Blocks)[number]) {
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
}) {
  return (
    lesson.title === lesson01Meta.title &&
    lesson.summary === lesson01Meta.summary &&
    lesson.publicPreview === lesson01Meta.publicPreview &&
    lesson.estimatedMinutes === lesson01Meta.estimatedMinutes &&
    lesson.accessType === "FREE" &&
    lesson.priceCents == null &&
    lesson.commerceStatus === "NOT_FOR_SALE" &&
    lesson.status === "PUBLISHED"
  );
}

function blocksMatch(
  existing: Array<{
    blockKey: string;
    position: number;
    countsForProgress: boolean;
    required: boolean;
    retiredAt: Date | null;
    payload: unknown;
    type: string;
  }>,
) {
  const active = existing.filter((block) => !block.retiredAt);
  if (active.length !== lesson01Blocks.length) return false;
  return lesson01Blocks.every((desired) => {
    const current = active.find((block) => block.blockKey === desired.blockKey);
    if (!current || current.type !== desired.data.type) return false;
    if (current.position !== desired.position || current.countsForProgress !== desired.countsForProgress || current.required !== desired.required) {
      return false;
    }
    const parsed = parseBlockData(current.payload);
    return JSON.stringify(parsed) === JSON.stringify(parseBlockData(desired.data));
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
