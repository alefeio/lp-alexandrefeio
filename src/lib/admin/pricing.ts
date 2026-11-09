import { getPrisma } from "@/lib/db/prisma";
import { formatCentsToBrl, parseBrlToCents, percentOff, savingsCents } from "@/lib/commerce/money";

export type PricingActor = { userId: string; role: string };
export type PricingTarget = "lesson" | "module" | "course";
export type PricingResult = { ok: true; message: string } | { ok: false; message: string };

export type PricingLessonRow = {
  id: string;
  title: string;
  accessType: "FREE" | "PAID";
  status: "DRAFT" | "PUBLISHED";
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  priceCents: number | null;
  updatedAt: string;
};

export type PricingModuleRow = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  bundlePriceCents: number | null;
  updatedAt: string;
  lessons: PricingLessonRow[];
  paidLessonCount: number;
  lessonCount: number;
  paidLessonSumCents: number;
  savingsCents: number;
  percentOff: number | null;
  warnings: string[];
};

export type PricingCourseDesk = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  bundlePriceCents: number | null;
  updatedAt: string;
  modules: PricingModuleRow[];
  paidLessonCount: number;
  lessonCount: number;
  freeLessonCount: number;
  paidLessonSumCents: number;
  moduleBundleSumCents: number;
  savingsVsLessonsCents: number;
  percentOffVsLessons: number | null;
  savingsVsModulesCents: number;
  percentOffVsModules: number | null;
  warnings: string[];
};

export type PricingCourseSummary = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  bundlePriceCents: number | null;
  paidLessonCount: number;
  lessonCount: number;
  moduleCount: number;
};

export type PriceChangeInput = {
  target: PricingTarget;
  accessType?: "FREE" | "PAID";
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  currentPriceCents: number | null;
  nextPriceCents: number;
  confirmAvailable: boolean;
  expectedUpdatedAt: string;
  actualUpdatedAt: Date;
};

export function evaluatePriceChange(input: PriceChangeInput): PricingResult {
  if (input.target === "lesson" && input.accessType === "FREE") {
    return { ok: false, message: "Aulas gratuitas não recebem preço comercial." };
  }
  if (!Number.isSafeInteger(input.nextPriceCents) || input.nextPriceCents < 0) {
    return { ok: false, message: "Valor monetário inválido." };
  }
  if (input.nextPriceCents === 0) {
    return { ok: false, message: "Produto pago precisa de preço maior que zero." };
  }
  if (input.commerceStatus === "AVAILABLE" && input.nextPriceCents <= 0) {
    return { ok: false, message: "Produto à venda não pode ficar com preço zero." };
  }
  if (stale(input.actualUpdatedAt, input.expectedUpdatedAt)) {
    return { ok: false, message: "Este preço foi atualizado em outra aba. Recarregue antes de salvar." };
  }
  const changed = input.currentPriceCents !== input.nextPriceCents;
  if (input.commerceStatus === "AVAILABLE" && changed && !input.confirmAvailable) {
    return {
      ok: false,
      message:
        "Confirme a alteração: o produto está AVAILABLE. Novas cotações usarão o novo preço; pedidos já criados permanecem com o snapshot anterior.",
    };
  }
  return { ok: true, message: "ok" };
}

export function coherenceWarnings(input: {
  kind: "module" | "course";
  bundlePriceCents: number | null;
  paidLessonSumCents: number;
  moduleBundleSumCents?: number;
  freeLessonCount?: number;
}): string[] {
  const warnings: string[] = [];
  const bundle = input.bundlePriceCents;
  if (bundle == null) return warnings;
  if (input.paidLessonSumCents > 0 && bundle > input.paidLessonSumCents) {
    warnings.push(
      input.kind === "module"
        ? "O pacote do módulo está mais caro que a soma das aulas pagas."
        : "O pacote do curso está mais caro que a soma das aulas pagas.",
    );
  }
  if (input.paidLessonSumCents > 0 && bundle === input.paidLessonSumCents) {
    warnings.push("Não há economia em relação à soma das aulas individuais.");
  }
  if (input.kind === "course" && input.moduleBundleSumCents != null && input.moduleBundleSumCents > 0 && bundle > input.moduleBundleSumCents) {
    warnings.push("O pacote do curso está mais caro que a soma dos módulos.");
  }
  if ((input.freeLessonCount ?? 0) > 0) {
    warnings.push("Há aulas gratuitas neste curso; elas não entram na soma de aulas pagas.");
  }
  return warnings;
}

export function simulateBrlChange(currentCents: number | null, brl: string): {
  ok: true;
  cents: number;
  display: string;
  changed: boolean;
} | { ok: false; message: string } {
  const parsed = parseBrlToCents(brl);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    cents: parsed.cents,
    display: formatCentsToBrl(parsed.cents),
    changed: currentCents !== parsed.cents,
  };
}

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

  const modules: PricingModuleRow[] = course.modules.map((moduleRow) => {
    const lessons: PricingLessonRow[] = moduleRow.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      accessType: lesson.accessType,
      status: lesson.status,
      commerceStatus: lesson.commerceStatus,
      priceCents: lesson.priceCents,
      updatedAt: lesson.updatedAt.toISOString(),
    }));
    const paid = lessons.filter((lesson) => lesson.accessType === "PAID");
    const paidLessonSumCents = paid.reduce((sum, lesson) => sum + (lesson.priceCents ?? 0), 0);
    const bundle = moduleRow.bundlePriceCents;
    return {
      id: moduleRow.id,
      title: moduleRow.title,
      status: moduleRow.status,
      commerceStatus: moduleRow.commerceStatus,
      bundlePriceCents: bundle,
      updatedAt: moduleRow.updatedAt.toISOString(),
      lessons,
      paidLessonCount: paid.length,
      lessonCount: lessons.length,
      paidLessonSumCents,
      savingsCents: bundle == null ? 0 : savingsCents(paidLessonSumCents, bundle),
      percentOff: bundle == null ? null : percentOff(paidLessonSumCents, bundle),
      warnings: coherenceWarnings({ kind: "module", bundlePriceCents: bundle, paidLessonSumCents }),
    };
  });

  const allLessons = modules.flatMap((moduleRow) => moduleRow.lessons);
  const paidLessons = allLessons.filter((lesson) => lesson.accessType === "PAID");
  const paidLessonSumCents = paidLessons.reduce((sum, lesson) => sum + (lesson.priceCents ?? 0), 0);
  const moduleBundleSumCents = modules.reduce((sum, moduleRow) => sum + (moduleRow.bundlePriceCents ?? 0), 0);
  const bundle = course.bundlePriceCents;
  const freeLessonCount = allLessons.filter((lesson) => lesson.accessType === "FREE").length;

  return {
    id: course.id,
    title: course.title,
    status: course.status,
    commerceStatus: course.commerceStatus,
    bundlePriceCents: bundle,
    updatedAt: course.updatedAt.toISOString(),
    modules,
    paidLessonCount: paidLessons.length,
    lessonCount: allLessons.length,
    freeLessonCount,
    paidLessonSumCents,
    moduleBundleSumCents,
    savingsVsLessonsCents: bundle == null ? 0 : savingsCents(paidLessonSumCents, bundle),
    percentOffVsLessons: bundle == null ? null : percentOff(paidLessonSumCents, bundle),
    savingsVsModulesCents: bundle == null ? 0 : savingsCents(moduleBundleSumCents, bundle),
    percentOffVsModules: bundle == null ? null : percentOff(moduleBundleSumCents, bundle),
    warnings: coherenceWarnings({
      kind: "course",
      bundlePriceCents: bundle,
      paidLessonSumCents,
      moduleBundleSumCents,
      freeLessonCount,
    }),
  };
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
      expectedUpdatedAt: input.expectedUpdatedAt,
      actualUpdatedAt: current.updatedAt,
    });
    if (!gate.ok) return gate;
    await prisma.lesson.update({
      where: { id: current.id },
      data: { priceCents: parsed.cents, updatedById: actor.userId },
    });
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
      expectedUpdatedAt: input.expectedUpdatedAt,
      actualUpdatedAt: current.updatedAt,
    });
    if (!gate.ok) return gate;
    await prisma.module.update({
      where: { id: current.id },
      data: { bundlePriceCents: parsed.cents, updatedById: actor.userId },
    });
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
    expectedUpdatedAt: input.expectedUpdatedAt,
    actualUpdatedAt: current.updatedAt,
  });
  if (!gate.ok) return gate;
  await prisma.course.update({
    where: { id: current.id },
    data: { bundlePriceCents: parsed.cents, updatedById: actor.userId },
  });
  return { ok: true, message: `Preço do curso atualizado para ${formatCentsToBrl(parsed.cents)}.` };
}

function stale(updatedAt: Date, expected: string): boolean {
  return expected.trim().length > 0 && updatedAt.toISOString() !== expected;
}
