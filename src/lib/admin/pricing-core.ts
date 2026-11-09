import { formatCentsToBrl, parseBrlToCents, percentOff, savingsCents } from "@/lib/commerce/money";

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
};

export type PricingDrafts = {
  lessons: Record<string, number | null | undefined>;
  modules: Record<string, number | null | undefined>;
  course?: number | null;
};

export type AtomicPriceWrite = {
  target: PricingTarget;
  id: string;
  expectedUpdatedAt: Date;
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  accessType?: "FREE" | "PAID";
  nextPriceCents: number;
  updatedById: string;
};

export const CONFLICT_MESSAGE = "Este preço foi atualizado em outra aba. Recarregue antes de salvar.";

export function parseExpectedUpdatedAt(raw: string): { ok: true; date: Date } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: "Timestamp de concorrência ausente. Recarregue a página." };
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, message: "Timestamp de concorrência inválido. Recarregue a página." };
  }
  if (date.toISOString() !== trimmed) {
    return { ok: false, message: "Timestamp de concorrência inválido. Recarregue a página." };
  }
  return { ok: true, date };
}

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

/** Projeção pura da mesa comercial com rascunhos locais (sem escrita). */
export function projectPricingDesk(desk: PricingCourseDesk, drafts: PricingDrafts = { lessons: {}, modules: {} }): PricingCourseDesk {
  const modules: PricingModuleRow[] = desk.modules.map((moduleRow) => {
    const lessons = moduleRow.lessons.map((lesson) => {
      const draft = drafts.lessons[lesson.id];
      const priceCents = draft === undefined ? lesson.priceCents : draft;
      return { ...lesson, priceCents };
    });
    const paid = lessons.filter((row) => row.accessType === "PAID");
    const paidLessonSumCents = paid.reduce((sum, row) => sum + (row.priceCents ?? 0), 0);
    const draftBundle = drafts.modules[moduleRow.id];
    const bundle = draftBundle === undefined ? moduleRow.bundlePriceCents : draftBundle;
    return {
      ...moduleRow,
      lessons,
      bundlePriceCents: bundle,
      paidLessonCount: paid.length,
      lessonCount: lessons.length,
      paidLessonSumCents,
      savingsCents: bundle == null ? 0 : savingsCents(paidLessonSumCents, bundle),
      percentOff: bundle == null ? null : percentOff(paidLessonSumCents, bundle),
      warnings: coherenceWarnings({ kind: "module", bundlePriceCents: bundle, paidLessonSumCents }),
    };
  });

  const allLessons = modules.flatMap((moduleRow) => moduleRow.lessons);
  const paidLessons = allLessons.filter((row) => row.accessType === "PAID");
  const paidLessonSumCents = paidLessons.reduce((sum, row) => sum + (row.priceCents ?? 0), 0);
  const moduleBundleSumCents = modules.reduce((sum, moduleRow) => sum + (moduleRow.bundlePriceCents ?? 0), 0);
  const bundle = drafts.course === undefined ? desk.bundlePriceCents : drafts.course;
  const freeLessonCount = allLessons.filter((row) => row.accessType === "FREE").length;

  return {
    ...desk,
    modules,
    bundlePriceCents: bundle,
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

/** Monta o filtro compare-and-swap usado no updateMany. */
export function atomicPriceWhere(write: AtomicPriceWrite) {
  if (write.target === "lesson") {
    return {
      id: write.id,
      updatedAt: write.expectedUpdatedAt,
      commerceStatus: write.commerceStatus,
      accessType: "PAID" as const,
    };
  }
  return {
    id: write.id,
    updatedAt: write.expectedUpdatedAt,
    commerceStatus: write.commerceStatus,
  };
}
