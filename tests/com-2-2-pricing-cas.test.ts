import assert from "node:assert/strict";
import test from "node:test";
import { CONFLICT_MESSAGE } from "../src/lib/admin/pricing-core";
import {
  UNCHANGED_PRICE_MESSAGE,
  updateProductPriceWithDb,
  type PricingActor,
} from "../src/lib/admin/pricing-write";
import { createPricingCasStore } from "./helpers/pricing-cas-store";

const admin: PricingActor = { userId: "admin-1", role: "ADMIN" };
const otherAdmin: PricingActor = { userId: "admin-2", role: "ADMIN" };
const stamp = new Date("2026-01-01T00:00:00.000Z");

function lessonSeed(overrides: Partial<{ priceCents: number | null; commerceStatus: "NOT_FOR_SALE" | "AVAILABLE" }> = {}) {
  return {
    id: "lesson-1",
    accessType: "PAID" as const,
    commerceStatus: overrides.commerceStatus ?? ("AVAILABLE" as const),
    priceCents: overrides.priceCents === undefined ? 1490 : overrides.priceCents,
    updatedAt: stamp,
    updatedById: "seed",
  };
}

test("COM-2.2: dois admins com o mesmo timestamp — só a primeira escrita vence", async () => {
  const store = createPricingCasStore({ lesson: lessonSeed() });
  const payload = {
    target: "lesson" as const,
    id: "lesson-1",
    amountBrl: "19,90",
    expectedUpdatedAt: stamp.toISOString(),
    confirmAvailable: true,
  };

  const first = await updateProductPriceWithDb(store, admin, payload);
  const second = await updateProductPriceWithDb(store, otherAdmin, payload);

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.ok ? "" : second.message, CONFLICT_MESSAGE);
  assert.equal(store.lessonRow()?.priceCents, 1990);
  assert.equal(store.lessonRow()?.writeCount, 1);
  assert.equal(store.lessonRow()?.updatedById, "admin-1");
});

test("COM-2.2: mudança concorrente de commerceStatus impede escrita", async () => {
  const store = createPricingCasStore({ lesson: lessonSeed({ commerceStatus: "AVAILABLE" }) });
  const originalUpdate = store.lesson.updateMany.bind(store.lesson);
  store.lesson.updateMany = async (args) => {
    // Entre o findUnique e o CAS, outra operação altera o status comercial.
    store.forceLessonCommerceStatus("NOT_FOR_SALE");
    return originalUpdate(args);
  };

  const result = await updateProductPriceWithDb(store, admin, {
    target: "lesson",
    id: "lesson-1",
    amountBrl: "25,00",
    expectedUpdatedAt: stamp.toISOString(),
    confirmAvailable: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.ok ? "" : result.message, CONFLICT_MESSAGE);
  assert.equal(store.lessonRow()?.priceCents, 1490);
  assert.equal(store.lessonRow()?.writeCount, 0);
  assert.equal(store.lessonRow()?.commerceStatus, "NOT_FOR_SALE");
});

test("COM-2.2: ausência de timestamp bloqueia gravação", async () => {
  const store = createPricingCasStore({ lesson: lessonSeed() });
  const result = await updateProductPriceWithDb(store, admin, {
    target: "lesson",
    id: "lesson-1",
    amountBrl: "19,90",
    expectedUpdatedAt: "",
    confirmAvailable: true,
  });
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.message, /Timestamp|ausente/i);
  assert.equal(store.lessonRow()?.writeCount, 0);
  assert.equal(store.lessonRow()?.priceCents, 1490);
});

test("COM-2.2: reenvio de preço idêntico não produz escrita", async () => {
  const store = createPricingCasStore({ lesson: lessonSeed({ priceCents: 1990 }) });
  const before = store.lessonRow()!;
  const result = await updateProductPriceWithDb(store, admin, {
    target: "lesson",
    id: "lesson-1",
    amountBrl: "19,90",
    expectedUpdatedAt: stamp.toISOString(),
    confirmAvailable: false,
  });
  assert.equal(result.ok, true);
  assert.equal(result.message, UNCHANGED_PRICE_MESSAGE);
  assert.equal(store.lessonRow()?.writeCount, 0);
  assert.equal(store.lessonRow()?.updatedAt.toISOString(), before.updatedAt.toISOString());
  assert.equal(store.lessonRow()?.updatedById, before.updatedById);
});

test("COM-2.2: preço idêntico com timestamp desatualizado ainda conflita", async () => {
  const store = createPricingCasStore({ lesson: lessonSeed({ priceCents: 1990 }) });
  const result = await updateProductPriceWithDb(store, admin, {
    target: "lesson",
    id: "lesson-1",
    amountBrl: "19,90",
    expectedUpdatedAt: "2025-01-01T00:00:00.000Z",
    confirmAvailable: false,
  });
  assert.equal(result.ok, false);
  assert.equal(result.ok ? "" : result.message, CONFLICT_MESSAGE);
  assert.equal(store.lessonRow()?.writeCount, 0);
});

test("COM-2.2: usuário não autorizado não altera preço", async () => {
  const store = createPricingCasStore({ lesson: lessonSeed() });
  const result = await updateProductPriceWithDb(
    store,
    { userId: "user-1", role: "USER" },
    {
      target: "lesson",
      id: "lesson-1",
      amountBrl: "19,90",
      expectedUpdatedAt: stamp.toISOString(),
      confirmAvailable: true,
    },
  );
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.message, /Sem acesso/);
  assert.equal(store.lessonRow()?.writeCount, 0);
  assert.equal(store.lessonRow()?.priceCents, 1490);
});

test("COM-2.2: módulo — segunda escrita com mesmo timestamp é rejeitada", async () => {
  const store = createPricingCasStore({
    module: {
      id: "mod-1",
      commerceStatus: "NOT_FOR_SALE",
      bundlePriceCents: 5000,
      updatedAt: stamp,
      updatedById: "seed",
    },
  });
  const payload = {
    target: "module" as const,
    id: "mod-1",
    amountBrl: "57,90",
    expectedUpdatedAt: stamp.toISOString(),
    confirmAvailable: false,
  };
  const first = await updateProductPriceWithDb(store, admin, payload);
  const second = await updateProductPriceWithDb(store, otherAdmin, payload);
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(store.moduleRow()?.bundlePriceCents, 5790);
  assert.equal(store.moduleRow()?.writeCount, 1);
});
