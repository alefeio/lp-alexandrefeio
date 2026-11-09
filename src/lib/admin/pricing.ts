import "server-only";

import {
  atomicPriceWhere,
  evaluatePriceChange,
  parseExpectedUpdatedAt,
  projectPricingDesk,
  CONFLICT_MESSAGE,
  type AtomicPriceWrite,
  type PricingCourseDesk,
  type PricingCourseSummary,
  type PricingResult,
  type PricingTarget,
} from "@/lib/admin/pricing-core";
import { getPrisma } from "@/lib/db/prisma";
import { formatCentsToBrl, parseBrlToCents } from "@/lib/commerce/money";

export type PricingActor = { userId: string; role: string };

export {
  atomicPriceWhere,
  coherenceWarnings,
  CONFLICT_MESSAGE,
  evaluatePriceChange,
  parseExpectedUpdatedAt,
  projectPricingDesk,
  simulateBrlChange,
  type AtomicPriceWrite,
  type PriceChangeInput,
  type PricingCourseDesk,
  type PricingCourseSummary,
  type PricingDrafts,
  type PricingLessonRow,
  type PricingModuleRow,
  type PricingResult,
  type PricingTarget,
} from "@/lib/admin/pricing-core";

export async function listPricingCourses(): Promise<PricingCourseSummary[]> {
  const rows = await getPrisma().course.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      modules: {
        include: { lessons: { select: { accessType: true } } },
      },
    },
  });
  return rows.map((course) => {
    const lessons = course.modules.flatMap((moduleRow) => moduleRow.lessons);
    return {
      id: course.id,
      title: course.title,
      status: course.status,
      commerceStatus: course.commerceStatus,
      bundlePriceCents: course.bundlePriceCents,
      paidLessonCount: lessons.filter((lesson) => lesson.accessType === "PAID").length,
      lessonCount: lessons.length,
      moduleCount: course.modules.length,
    };
  });
}

export async function loadPricingCourseDesk(courseId: string): Promise<PricingCourseDesk | null> {
  const course = await getPrisma().course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { sortOrder: "asc" },
        include: { lessons: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!course) return null;

  const base: PricingCourseDesk = {
    id: course.id,
    title: course.title,
    status: course.status,
    commerceStatus: course.commerceStatus,
    bundlePriceCents: course.bundlePriceCents,
    updatedAt: course.updatedAt.toISOString(),
    modules: course.modules.map((moduleRow) => ({
      id: moduleRow.id,
      title: moduleRow.title,
      status: moduleRow.status,
      commerceStatus: moduleRow.commerceStatus,
      bundlePriceCents: moduleRow.bundlePriceCents,
      updatedAt: moduleRow.updatedAt.toISOString(),
      lessons: moduleRow.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        accessType: lesson.accessType,
        status: lesson.status,
        commerceStatus: lesson.commerceStatus,
        priceCents: lesson.priceCents,
        updatedAt: lesson.updatedAt.toISOString(),
      })),
      paidLessonCount: 0,
      lessonCount: 0,
      paidLessonSumCents: 0,
      savingsCents: 0,
      percentOff: null,
      warnings: [],
    })),
    paidLessonCount: 0,
    lessonCount: 0,
    freeLessonCount: 0,
    paidLessonSumCents: 0,
    moduleBundleSumCents: 0,
    savingsVsLessonsCents: 0,
    percentOffVsLessons: null,
    savingsVsModulesCents: 0,
    percentOffVsModules: null,
    warnings: [],
  };

  return projectPricingDesk(base);
}

export async function updateProductPrice(
  actor: PricingActor,
  input: {
    target: PricingTarget;
    id: string;
    amountBrl: string;
    expectedUpdatedAt: string;
    confirmAvailable: boolean;
  },
): Promise<PricingResult> {
  if (!actor.userId) return { ok: false, message: "Sem acesso." };

  const expected = parseExpectedUpdatedAt(input.expectedUpdatedAt);
  if (!expected.ok) return expected;

  const parsed = parseBrlToCents(input.amountBrl);
  if (!parsed.ok) return parsed;

  const prisma = getPrisma();

  if (input.target === "lesson") {
    const current = await prisma.lesson.findUnique({ where: { id: input.id } });
    if (!current) return { ok: false, message: "Aula não encontrada." };
    const gate = evaluatePriceChange({
      target: "lesson",
      accessType: current.accessType,
      commerceStatus: current.commerceStatus,
      currentPriceCents: current.priceCents,
      nextPriceCents: parsed.cents,
      confirmAvailable: input.confirmAvailable,
    });
    if (!gate.ok) return gate;

    const write: AtomicPriceWrite = {
      target: "lesson",
      id: current.id,
      expectedUpdatedAt: expected.date,
      commerceStatus: current.commerceStatus,
      accessType: current.accessType,
      nextPriceCents: parsed.cents,
      updatedById: actor.userId,
    };
    const result = await prisma.lesson.updateMany({
      where: atomicPriceWhere(write),
      data: { priceCents: parsed.cents, updatedById: actor.userId },
    });
    if (result.count !== 1) return { ok: false, message: CONFLICT_MESSAGE };
    return { ok: true, message: `Preço da aula atualizado para ${formatCentsToBrl(parsed.cents)}.` };
  }

  if (input.target === "module") {
    const current = await prisma.module.findUnique({ where: { id: input.id } });
    if (!current) return { ok: false, message: "Módulo não encontrado." };
    const gate = evaluatePriceChange({
      target: "module",
      commerceStatus: current.commerceStatus,
      currentPriceCents: current.bundlePriceCents,
      nextPriceCents: parsed.cents,
      confirmAvailable: input.confirmAvailable,
    });
    if (!gate.ok) return gate;

    const write: AtomicPriceWrite = {
      target: "module",
      id: current.id,
      expectedUpdatedAt: expected.date,
      commerceStatus: current.commerceStatus,
      nextPriceCents: parsed.cents,
      updatedById: actor.userId,
    };
    const result = await prisma.module.updateMany({
      where: atomicPriceWhere(write),
      data: { bundlePriceCents: parsed.cents, updatedById: actor.userId },
    });
    if (result.count !== 1) return { ok: false, message: CONFLICT_MESSAGE };
    return { ok: true, message: `Preço do módulo atualizado para ${formatCentsToBrl(parsed.cents)}.` };
  }

  const current = await prisma.course.findUnique({ where: { id: input.id } });
  if (!current) return { ok: false, message: "Curso não encontrado." };
  const gate = evaluatePriceChange({
    target: "course",
    commerceStatus: current.commerceStatus,
    currentPriceCents: current.bundlePriceCents,
    nextPriceCents: parsed.cents,
    confirmAvailable: input.confirmAvailable,
  });
  if (!gate.ok) return gate;

  const write: AtomicPriceWrite = {
    target: "course",
    id: current.id,
    expectedUpdatedAt: expected.date,
    commerceStatus: current.commerceStatus,
    nextPriceCents: parsed.cents,
    updatedById: actor.userId,
  };
  const result = await prisma.course.updateMany({
    where: atomicPriceWhere(write),
    data: { bundlePriceCents: parsed.cents, updatedById: actor.userId },
  });
  if (result.count !== 1) return { ok: false, message: CONFLICT_MESSAGE };
  return { ok: true, message: `Preço do curso atualizado para ${formatCentsToBrl(parsed.cents)}.` };
}
