import {
  atomicPriceWhere,
  evaluatePriceChange,
  parseExpectedUpdatedAt,
  CONFLICT_MESSAGE,
  type AtomicPriceWrite,
  type PricingResult,
  type PricingTarget,
} from "@/lib/admin/pricing-core";
import { isAdminRole } from "@/lib/auth/policy";
import { formatCentsToBrl, parseBrlToCents } from "@/lib/commerce/money";

export type PricingActor = { userId: string; role: string };

export const UNCHANGED_PRICE_MESSAGE = "Preço já está atualizado.";

type CommerceStatus = "NOT_FOR_SALE" | "AVAILABLE";
type AccessType = "FREE" | "PAID";

export type PricingLessonRecord = {
  id: string;
  accessType: AccessType;
  commerceStatus: CommerceStatus;
  priceCents: number | null;
  updatedAt: Date;
  updatedById?: string | null;
};

export type PricingBundleRecord = {
  id: string;
  commerceStatus: CommerceStatus;
  bundlePriceCents: number | null;
  updatedAt: Date;
  updatedById?: string | null;
};

export type PricingWriteDb = {
  lesson: {
    findUnique: (args: { where: { id: string } }) => Promise<PricingLessonRecord | null>;
    updateMany: (args: {
      where: ReturnType<typeof atomicPriceWhere>;
      data: { priceCents: number; updatedById: string };
    }) => Promise<{ count: number }>;
  };
  module: {
    findUnique: (args: { where: { id: string } }) => Promise<PricingBundleRecord | null>;
    updateMany: (args: {
      where: ReturnType<typeof atomicPriceWhere>;
      data: { bundlePriceCents: number; updatedById: string };
    }) => Promise<{ count: number }>;
  };
  course: {
    findUnique: (args: { where: { id: string } }) => Promise<PricingBundleRecord | null>;
    updateMany: (args: {
      where: ReturnType<typeof atomicPriceWhere>;
      data: { bundlePriceCents: number; updatedById: string };
    }) => Promise<{ count: number }>;
  };
};

export type UpdateProductPriceInput = {
  target: PricingTarget;
  id: string;
  amountBrl: string;
  expectedUpdatedAt: string;
  confirmAvailable: boolean;
};

function timestampsMatch(actual: Date, expected: Date): boolean {
  return actual.getTime() === expected.getTime();
}

export async function updateProductPriceWithDb(
  db: PricingWriteDb,
  actor: PricingActor,
  input: UpdateProductPriceInput,
): Promise<PricingResult> {
  if (!actor.userId || !isAdminRole(actor.role)) {
    return { ok: false, message: "Sem acesso." };
  }

  const expected = parseExpectedUpdatedAt(input.expectedUpdatedAt);
  if (!expected.ok) return expected;

  const parsed = parseBrlToCents(input.amountBrl);
  if (!parsed.ok) return parsed;

  if (input.target === "lesson") {
    const current = await db.lesson.findUnique({ where: { id: input.id } });
    if (!current) return { ok: false, message: "Aula não encontrada." };
    if (!timestampsMatch(current.updatedAt, expected.date)) {
      return { ok: false, message: CONFLICT_MESSAGE };
    }
    const gate = evaluatePriceChange({
      target: "lesson",
      accessType: current.accessType,
      commerceStatus: current.commerceStatus,
      currentPriceCents: current.priceCents,
      nextPriceCents: parsed.cents,
      confirmAvailable: input.confirmAvailable,
    });
    if (!gate.ok) return gate;
    if (current.priceCents === parsed.cents) {
      return { ok: true, message: UNCHANGED_PRICE_MESSAGE };
    }

    const write: AtomicPriceWrite = {
      target: "lesson",
      id: current.id,
      expectedUpdatedAt: expected.date,
      commerceStatus: current.commerceStatus,
      accessType: current.accessType,
      nextPriceCents: parsed.cents,
      updatedById: actor.userId,
    };
    const result = await db.lesson.updateMany({
      where: atomicPriceWhere(write),
      data: { priceCents: parsed.cents, updatedById: actor.userId },
    });
    if (result.count !== 1) return { ok: false, message: CONFLICT_MESSAGE };
    return { ok: true, message: `Preço da aula atualizado para ${formatCentsToBrl(parsed.cents)}.` };
  }

  if (input.target === "module") {
    const current = await db.module.findUnique({ where: { id: input.id } });
    if (!current) return { ok: false, message: "Módulo não encontrado." };
    if (!timestampsMatch(current.updatedAt, expected.date)) {
      return { ok: false, message: CONFLICT_MESSAGE };
    }
    const gate = evaluatePriceChange({
      target: "module",
      commerceStatus: current.commerceStatus,
      currentPriceCents: current.bundlePriceCents,
      nextPriceCents: parsed.cents,
      confirmAvailable: input.confirmAvailable,
    });
    if (!gate.ok) return gate;
    if (current.bundlePriceCents === parsed.cents) {
      return { ok: true, message: UNCHANGED_PRICE_MESSAGE };
    }

    const write: AtomicPriceWrite = {
      target: "module",
      id: current.id,
      expectedUpdatedAt: expected.date,
      commerceStatus: current.commerceStatus,
      nextPriceCents: parsed.cents,
      updatedById: actor.userId,
    };
    const result = await db.module.updateMany({
      where: atomicPriceWhere(write),
      data: { bundlePriceCents: parsed.cents, updatedById: actor.userId },
    });
    if (result.count !== 1) return { ok: false, message: CONFLICT_MESSAGE };
    return { ok: true, message: `Preço do módulo atualizado para ${formatCentsToBrl(parsed.cents)}.` };
  }

  const current = await db.course.findUnique({ where: { id: input.id } });
  if (!current) return { ok: false, message: "Curso não encontrado." };
  if (!timestampsMatch(current.updatedAt, expected.date)) {
    return { ok: false, message: CONFLICT_MESSAGE };
  }
  const gate = evaluatePriceChange({
    target: "course",
    commerceStatus: current.commerceStatus,
    currentPriceCents: current.bundlePriceCents,
    nextPriceCents: parsed.cents,
    confirmAvailable: input.confirmAvailable,
  });
  if (!gate.ok) return gate;
  if (current.bundlePriceCents === parsed.cents) {
    return { ok: true, message: UNCHANGED_PRICE_MESSAGE };
  }

  const write: AtomicPriceWrite = {
    target: "course",
    id: current.id,
    expectedUpdatedAt: expected.date,
    commerceStatus: current.commerceStatus,
    nextPriceCents: parsed.cents,
    updatedById: actor.userId,
  };
  const result = await db.course.updateMany({
    where: atomicPriceWhere(write),
    data: { bundlePriceCents: parsed.cents, updatedById: actor.userId },
  });
  if (result.count !== 1) return { ok: false, message: CONFLICT_MESSAGE };
  return { ok: true, message: `Preço do curso atualizado para ${formatCentsToBrl(parsed.cents)}.` };
}
