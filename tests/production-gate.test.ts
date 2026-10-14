import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canReadLessonBody } from "../src/lib/learning/access";
import {
  isCommerceEnabled,
  mercadoPagoProductionConfig,
  mercadoPagoTestConfig,
  webhookLiveModeAllowed,
} from "../src/lib/commerce/config";
import { quoteCart, type SaleCourse, type SaleLesson, type SaleModule } from "../src/lib/commerce/quote";
import { reconcileDecision } from "../src/lib/commerce/reconcile";
import { mergeLessonProgress } from "../src/lib/learning/local-progress";
import { LESSON_01_SLUG } from "../src/lib/learning/lesson-01";
import { LESSON_02_SLUG } from "../src/lib/learning/lesson-02";
import { shouldOfferSaveProgress } from "../src/lib/learning/save-progress";

const creds = {
  NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY: "APP_USR-public",
  MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-token",
  MERCADO_PAGO_WEBHOOK_SECRET: "webhook-secret-production",
};

test("commerce de production fica fechado sem a trava e sem credencial", () => {
  const production = {
    ...creds,
    COMMERCE_ENABLED: "true",
    COMMERCE_PRODUCTION_READY: "true",
    MERCADO_PAGO_ENV: "production",
    DATABASE_ENV: "production",
    VERCEL_ENV: "production",
  };
  assert.equal(mercadoPagoProductionConfig({ ...production, COMMERCE_PRODUCTION_READY: "false" }), null);
  assert.equal(mercadoPagoProductionConfig({ ...production, MERCADO_PAGO_ACCESS_TOKEN: "" }), null);
  assert.equal(mercadoPagoProductionConfig({ ...production, MERCADO_PAGO_WEBHOOK_SECRET: "curto" }), null);
  assert.equal(isCommerceEnabled({ ...production, COMMERCE_PRODUCTION_READY: "false" }), false);
});

test("teste e production não cruzam ambiente", () => {
  const testEnv = {
    ...creds,
    COMMERCE_ENABLED: "true",
    MERCADO_PAGO_ENV: "test",
    DATABASE_ENV: "development",
  };
  assert.equal(mercadoPagoTestConfig(testEnv)?.env, "test");
  assert.equal(mercadoPagoTestConfig({ ...testEnv, VERCEL_ENV: "production" }), null);
  assert.equal(mercadoPagoTestConfig({ ...testEnv, DATABASE_ENV: "production" }), null);
  assert.equal(mercadoPagoTestConfig({ ...testEnv, COMMERCE_PRODUCTION_READY: "true" }), null);
  assert.equal(mercadoPagoTestConfig({ ...testEnv, MERCADO_PAGO_ENV: "production" }), null);

  const production = {
    ...creds,
    COMMERCE_ENABLED: "true",
    COMMERCE_PRODUCTION_READY: "true",
    MERCADO_PAGO_ENV: "production",
    DATABASE_ENV: "production",
    VERCEL_ENV: "production",
  };
  assert.equal(mercadoPagoProductionConfig(production)?.env, "production");
  assert.equal(mercadoPagoProductionConfig({ ...production, DATABASE_ENV: "development" }), null);
  assert.equal(mercadoPagoProductionConfig({ ...production, VERCEL_ENV: "preview" }), null);
  assert.equal(mercadoPagoProductionConfig({ ...production, MERCADO_PAGO_ENV: "test" }), null);
  assert.equal(webhookLiveModeAllowed("test", true), false);
  assert.equal(webhookLiveModeAllowed("test", false), true);
  assert.equal(webhookLiveModeAllowed("production", true), true);
  assert.equal(webhookLiveModeAllowed("production", false), false);
});

test("aula gratuita segue anônima e o merge não volta progresso nem duplica resposta", () => {
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "FREE" }), true);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }), false);
  const order = ["a", "b", "resultado-primeiro-mapa"];
  const merged = mergeLessonProgress(
    {
      updatedAt: "2026-10-14T00:00:00.000Z",
      lastBlockKey: "b",
      viewedBlockKeys: ["a", "b"],
      responses: { checkpoint: { optionId: "certo" } },
      result: { oferta: "servidor" },
    },
    {
      updatedAt: "2026-10-14T01:00:00.000Z",
      lastBlockKey: "a",
      viewedBlockKeys: ["a", "resultado-primeiro-mapa"],
      responses: { checkpoint: { optionId: "outro" } },
      result: { oferta: "local" },
    },
    order,
  );
  assert.equal(merged.write, true);
  assert.equal(merged.progress?.lastBlockKey, "b");
  assert.equal(merged.progress?.viewedBlockKeys.includes("resultado-primeiro-mapa"), true);
  assert.deepEqual(merged.progress?.responses.checkpoint, { optionId: "certo" });
  assert.equal(merged.progress?.result?.oferta, "servidor");
  assert.equal(shouldOfferSaveProgress({ slug: LESSON_01_SLUG, authenticated: false, completedBlockKeys: [] }), false);
  assert.equal(
    shouldOfferSaveProgress({ slug: LESSON_01_SLUG, authenticated: false, completedBlockKeys: ["resultado-primeiro-mapa"] }),
    true,
  );
  assert.equal(
    shouldOfferSaveProgress({ slug: LESSON_02_SLUG, authenticated: true, completedBlockKeys: ["resultado-indicacao-canal"] }),
    false,
  );
  assert.equal(shouldOfferSaveProgress({ slug: "objetivo-oferta-orcamento", authenticated: false, completedBlockKeys: ["x"] }), false);
  const reader = readFileSync(new URL("../src/components/learning/LessonReader.tsx", import.meta.url), "utf8");
  assert.match(reader, /Salve seu progresso na sua conta/);
  assert.equal(reader.includes("required={true}"), false);
});

test("NOT_FOR_SALE não gera checkout e AVAILABLE futuro gera", () => {
  const lesson = (status: "NOT_FOR_SALE" | "AVAILABLE"): SaleLesson => ({
    id: "lesson-4",
    slug: "objetivo-oferta-orcamento",
    title: "Aula 4",
    accessType: "PAID",
    status: "PUBLISHED",
    commerceStatus: status,
    priceCents: 2990,
    moduleId: "module-1",
    courseId: "course",
  });
  const moduleRow: SaleModule = {
    id: "module-1",
    slug: "planeje-antes-de-anunciar",
    title: "Módulo 1",
    status: "PUBLISHED",
    commerceStatus: "NOT_FOR_SALE",
    bundlePriceCents: 5790,
    courseId: "course",
    paidLessonIds: ["lesson-4"],
  };
  const course: SaleCourse = {
    id: "course",
    slug: "trafego-pago-na-pratica",
    title: "Curso",
    status: "PUBLISHED",
    commerceStatus: "NOT_FOR_SALE",
    bundlePriceCents: 24990,
    paidLessonIds: ["lesson-4"],
  };
  const closed = quoteCart({ lines: [{ type: "LESSON", id: "lesson-4" }], lessons: [lesson("NOT_FOR_SALE")], modules: [], courses: [], sources: [], ownedLessonIds: [] });
  assert.equal(closed.ok, false);
  const open = quoteCart({ lines: [{ type: "LESSON", id: "lesson-4" }], lessons: [lesson("AVAILABLE")], modules: [], courses: [], sources: [], ownedLessonIds: [] });
  assert.equal(open.ok, true);
  if (open.ok) assert.equal(open.totalCents, 2990);
  const fullCourse = quoteCart({
    lines: [{ type: "COURSE", id: "course" }],
    lessons: [lesson("AVAILABLE")],
    modules: [moduleRow],
    courses: [course],
    sources: [],
    ownedLessonIds: [],
  });
  assert.equal(fullCourse.ok, false);
  const provider = { id: "pay", status: "pending", statusDetail: null, amountCents: 2990, currency: "BRL", externalReference: "order", paymentTypeId: "pix", installments: 1, refundedCents: 0 };
  assert.equal(reconcileDecision({ orderId: "order", orderStatus: "PENDING_PAYMENT", orderTotalCents: 2990, paymentStatus: "PENDING", paymentAmountCents: 2990, provider, alreadyGranted: false }).grant, false);
  assert.equal(reconcileDecision({ orderId: "order", orderStatus: "PENDING_PAYMENT", orderTotalCents: 2990, paymentStatus: "PENDING", paymentAmountCents: 2990, provider: { ...provider, status: "approved" }, alreadyGranted: false }).grant, true);
  assert.equal(reconcileDecision({ orderId: "order", orderStatus: "PENDING_PAYMENT", orderTotalCents: 2990, paymentStatus: "PENDING", paymentAmountCents: 2990, provider: { ...provider, status: "rejected" }, alreadyGranted: false }).grant, false);
});
