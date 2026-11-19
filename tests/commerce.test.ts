import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { canReadLessonBody, visibleBlocks } from "../src/lib/learning/access";
import { commerceAnalyticsPayload, purchaseDedupeKey } from "../src/lib/commerce/analytics";
import { isCommerceEnabled } from "../src/lib/commerce/config";
import { decidePaymentAttempt, orderPaymentLockSql } from "../src/lib/commerce/orders";
import { amountDueCents, eligibleCreditCents, quoteCart, type CreditSource, type SaleCourse, type SaleLesson, type SaleModule } from "../src/lib/commerce/quote";
import { reconcileDecision, type ProviderPaymentView } from "../src/lib/commerce/reconcile";
import {
  acceptedMethod,
  chargeFingerprint,
  classifyProviderChargeFailure,
  extractProviderChargeDiagnostics,
  hasPresentablePix,
  isAllowedMercadoPagoTicketUrl,
  readPix,
  readProviderPayment,
  readStoredChargeFingerprint,
  sanitizeProviderDiagnosticToken,
  userMessageForProviderRejection,
} from "../src/lib/commerce/provider";
import { decidePurchaseJourney } from "../src/lib/commerce/purchase-journey";
import { verifyMercadoPagoSignature } from "../src/lib/commerce/signature";
import { purchaseEmail } from "../src/lib/email/purchase-mail";
import { needsSession } from "../src/proxy";

loadEnv({ path: ".env.local" });

function lesson(id: string, price: number, patch: Partial<SaleLesson> = {}): SaleLesson {
  return {
    id,
    slug: id,
    title: `Aula ${id}`,
    accessType: "PAID",
    status: "PUBLISHED",
    commerceStatus: "AVAILABLE",
    priceCents: price,
    moduleId: "mod",
    courseId: "course",
    ...patch,
  };
}

function source(id: string, paid: number, lessonIds: string[]): CreditSource {
  return { orderItemId: id, finalPriceCents: paid, lessonIds };
}

const lessons = [lesson("a", 3990), lesson("b", 3990), lesson("c", 2410)];
const moduleRow: SaleModule = {
  id: "mod",
  slug: "google-ads",
  title: "Google Ads",
  status: "PUBLISHED",
  commerceStatus: "AVAILABLE",
  bundlePriceCents: 10390,
  courseId: "course",
  paidLessonIds: ["a", "b", "c"],
  lessonCount: 3,
};
const course: SaleCourse = {
  id: "course",
  slug: "trafego",
  title: "Curso",
  status: "PUBLISHED",
  commerceStatus: "AVAILABLE",
  bundlePriceCents: 24990,
  paidLessonIds: ["a", "b", "c"],
  lessonCount: 3,
};

function view(patch: Partial<ProviderPaymentView>): ProviderPaymentView {
  return {
    id: "mp-1",
    status: "pending",
    statusDetail: null,
    amountCents: 3990,
    currency: "BRL",
    externalReference: "order-1",
    paymentTypeId: "bank_transfer",
    installments: 1,
    refundedCents: 0,
    ...patch,
  };
}

test("preço, crédito e pacote saem do servidor", () => {
  const clientPriceIgnored = quoteCart({
    lines: [{ type: "LESSON", id: "a" }, { type: "LESSON", id: "b" }],
    lessons,
    modules: [moduleRow],
    courses: [course],
    sources: [],
    ownedLessonIds: [],
  });
  assert.equal(clientPriceIgnored.ok, true);
  if (!clientPriceIgnored.ok) return;
  assert.equal(clientPriceIgnored.subtotalCents, 7980);
  assert.equal(clientPriceIgnored.totalCents, 7980);
  assert.equal(clientPriceIgnored.items.length, 2);

  const hidden = quoteCart({
    lines: [{ type: "LESSON", id: "a" }],
    lessons: [lesson("a", 3990, { commerceStatus: "NOT_FOR_SALE" })],
    modules: [],
    courses: [],
    sources: [],
    ownedLessonIds: [],
  });
  assert.equal(hidden.ok, false);

  const moduleQuote = quoteCart({
    lines: [{ type: "MODULE", id: "mod" }],
    lessons,
    modules: [moduleRow],
    courses: [course],
    sources: [source("paid-lesson", 2990, ["a"])],
    ownedLessonIds: ["a"],
  });
  assert.equal(moduleQuote.ok && moduleQuote.creditCents, 2990);
  assert.equal(moduleQuote.ok && moduleQuote.totalCents, 7400);

  const courseQuote = quoteCart({
    lines: [{ type: "COURSE", id: "course" }],
    lessons,
    modules: [moduleRow],
    courses: [course],
    sources: [source("lesson-paid", 3990, ["a"]), source("module-paid", 6400, ["a", "b", "c"])],
    ownedLessonIds: ["a"],
  });
  assert.equal(courseQuote.ok && courseQuote.creditCents, 10390);
  assert.equal(courseQuote.ok && courseQuote.totalCents, 14600);
  assert.equal(eligibleCreditCents(["a", "b", "c"], [source("lesson-paid", 3990, ["a"]), source("module-paid", 10390, ["a", "b", "c"])]), 14380);
  assert.notEqual(eligibleCreditCents(["a", "b", "c"], [source("lesson-paid", 3990, ["a"]), source("module-paid", 6400, ["a", "b", "c"])]), 3990 + 10390);

  const historical = quoteCart({
    lines: [{ type: "MODULE", id: "mod" }],
    lessons: [lesson("a", 4990), lesson("b", 4990), lesson("c", 4990)],
    modules: [{ ...moduleRow, bundlePriceCents: 12000 }],
    courses: [],
    sources: [source("old", 2990, ["a"])],
    ownedLessonIds: ["a"],
  });
  assert.equal(historical.ok && historical.creditCents, 2990);

  assert.equal(amountDueCents(10390, 20000), 0);
  const capped = quoteCart({
    lines: [{ type: "MODULE", id: "mod" }],
    lessons,
    modules: [moduleRow],
    courses: [],
    sources: [source("big", 20000, ["a"])],
    ownedLessonIds: [],
  });
  assert.equal(capped.ok && capped.totalCents, 0);
  assert.equal(capped.ok && capped.kind, "zero_upgrade");
  assert.equal(capped.ok && capped.items[0]?.creditAppliedCents, 10390);

  const owned = quoteCart({
    lines: [{ type: "MODULE", id: "mod" }],
    lessons,
    modules: [moduleRow],
    courses: [],
    sources: [],
    ownedLessonIds: ["a", "b", "c"],
  });
  assert.equal(owned.ok, false);

  const mixed = quoteCart({
    lines: [{ type: "COURSE", id: "course" }, { type: "LESSON", id: "a" }],
    lessons,
    modules: [moduleRow],
    courses: [course],
    sources: [],
    ownedLessonIds: [],
  });
  assert.equal(mixed.ok, true);
  if (mixed.ok) {
    assert.equal(mixed.items.length, 1);
    assert.equal(mixed.itemType, "COURSE");
    assert.deepEqual(mixed.lines, [{ type: "COURSE", id: "course" }]);
  }
});

test("upgrade do módulo Google usa só o valor pago das aulas 6, 7 e 8", () => {
  const googleLessons = [lesson("l6", 3990), lesson("l7", 3990), lesson("l8", 3490)];
  const googleModule: SaleModule = {
    ...moduleRow,
    id: "google",
    slug: "google-ads-na-pratica",
    bundlePriceCents: 10390,
    paidLessonIds: ["l6", "l7", "l8"],
    lessonCount: 3,
  };
  function due(paid: Array<[string, number]>, owned: string[]) {
    const quote = quoteCart({
      lines: [{ type: "MODULE", id: "google" }],
      lessons: googleLessons,
      modules: [googleModule],
      courses: [],
      sources: paid.map(([id, cents]) => source(id, cents, [id])),
      ownedLessonIds: owned,
    });
    assert.equal(quote.ok, true);
    return quote.ok ? { credit: quote.creditCents, total: quote.totalCents, kind: quote.kind } : null;
  }
  assert.deepEqual(due([], []), { credit: 0, total: 10390, kind: "payment" });
  assert.deepEqual(due([["l6", 3990]], ["l6"]), { credit: 3990, total: 6400, kind: "payment" });
  assert.deepEqual(due([["l7", 3990]], ["l7"]), { credit: 3990, total: 6400, kind: "payment" });
  assert.deepEqual(due([["l8", 3490]], ["l8"]), { credit: 3490, total: 6900, kind: "payment" });
  assert.deepEqual(due([["l6", 3990], ["l7", 3990]], ["l6", "l7"]), { credit: 7980, total: 2410, kind: "payment" });
  assert.deepEqual(due([["l6", 3990], ["l8", 3490]], ["l6", "l8"]), { credit: 7480, total: 2910, kind: "payment" });
  assert.deepEqual(due([["l7", 3990], ["l8", 3490]], ["l7", "l8"]), { credit: 7480, total: 2910, kind: "payment" });
  const ownedAll = quoteCart({
    lines: [{ type: "MODULE", id: "google" }],
    lessons: googleLessons,
    modules: [googleModule],
    courses: [],
    sources: [source("l6", 3990, ["l6"]), source("l7", 3990, ["l7"]), source("l8", 3490, ["l8"])],
    ownedLessonIds: ["l6", "l7", "l8"],
  });
  assert.equal(ownedAll.ok, false);
  const zero = quoteCart({
    lines: [{ type: "MODULE", id: "google" }],
    lessons: googleLessons,
    modules: [googleModule],
    courses: [],
    sources: [source("l6", 3990, ["l6"]), source("l7", 3990, ["l7"]), source("l8", 3490, ["l8"])],
    ownedLessonIds: ["l6"],
  });
  assert.equal(zero.ok && zero.totalCents, 0);
  assert.equal(zero.ok && zero.kind, "zero_upgrade");
  assert.equal(zero.ok && zero.creditCents, 10390);
  const entitlementOnly = quoteCart({
    lines: [{ type: "MODULE", id: "google" }],
    lessons: googleLessons,
    modules: [googleModule],
    courses: [],
    sources: [],
    ownedLessonIds: ["l6"],
  });
  assert.equal(entitlementOnly.ok && entitlementOnly.creditCents, 0);
  assert.equal(entitlementOnly.ok && entitlementOnly.totalCents, 10390);
  const unrelated = quoteCart({
    lines: [{ type: "MODULE", id: "google" }],
    lessons: [...googleLessons, lesson("l4", 2990)],
    modules: [googleModule],
    courses: [],
    sources: [source("l4", 2990, ["l4"])],
    ownedLessonIds: ["l4"],
  });
  assert.equal(unrelated.ok && unrelated.creditCents, 0);
  assert.equal(unrelated.ok && unrelated.totalCents, 10390);
  const repeat = quoteCart({
    lines: [{ type: "LESSON", id: "l6" }],
    lessons: googleLessons,
    modules: [googleModule],
    courses: [],
    sources: [source("l6", 3990, ["l6"])],
    ownedLessonIds: ["l6"],
  });
  assert.equal(repeat.ok, false);
  if (repeat.ok) return;
  assert.match(repeat.message, /já tem esta aula/);
});

test("upgrade do módulo Meta usa só o valor pago das aulas 9 e 10", () => {
  const metaLessons = [lesson("l9", 3990), lesson("l10", 3990)];
  const metaModule: SaleModule = {
    ...moduleRow,
    id: "meta",
    slug: "meta-ads-na-pratica",
    bundlePriceCents: 7190,
    paidLessonIds: ["l9", "l10"],
    lessonCount: 2,
  };
  function due(paid: Array<[string, number]>, owned: string[]) {
    const quote = quoteCart({
      lines: [{ type: "MODULE", id: "meta" }],
      lessons: metaLessons,
      modules: [metaModule],
      courses: [],
      sources: paid.map(([id, cents]) => source(id, cents, [id])),
      ownedLessonIds: owned,
    });
    assert.equal(quote.ok, true);
    return quote.ok ? { credit: quote.creditCents, total: quote.totalCents, kind: quote.kind } : null;
  }
  assert.deepEqual(due([], []), { credit: 0, total: 7190, kind: "payment" });
  assert.deepEqual(due([["l9", 3990]], ["l9"]), { credit: 3990, total: 3200, kind: "payment" });
  assert.deepEqual(due([["l10", 3990]], ["l10"]), { credit: 3990, total: 3200, kind: "payment" });
  const ownedBoth = quoteCart({
    lines: [{ type: "MODULE", id: "meta" }],
    lessons: metaLessons,
    modules: [metaModule],
    courses: [],
    sources: [source("l9", 3990, ["l9"]), source("l10", 3990, ["l10"])],
    ownedLessonIds: ["l9", "l10"],
  });
  assert.equal(ownedBoth.ok, false);
  if (!ownedBoth.ok) assert.match(ownedBoth.message, /já tem este conteúdo/);
  const entitlementOnly = quoteCart({
    lines: [{ type: "MODULE", id: "meta" }],
    lessons: metaLessons,
    modules: [metaModule],
    courses: [],
    sources: [],
    ownedLessonIds: ["l9"],
  });
  assert.equal(entitlementOnly.ok && entitlementOnly.creditCents, 0);
  assert.equal(entitlementOnly.ok && entitlementOnly.totalCents, 7190);
  const countedOnce = eligibleCreditCents(
    ["l9", "l10"],
    [source("l9", 3990, ["l9"]), source("l10", 3990, ["l10"])],
  );
  assert.equal(countedOnce, 7980);
  const unrelated = quoteCart({
    lines: [{ type: "MODULE", id: "meta" }],
    lessons: [...metaLessons, lesson("l6", 3990)],
    modules: [metaModule],
    courses: [],
    sources: [source("l6", 3990, ["l6"])],
    ownedLessonIds: ["l6"],
  });
  assert.equal(unrelated.ok && unrelated.creditCents, 0);
  assert.equal(unrelated.ok && unrelated.totalCents, 7190);
  const repeat = quoteCart({
    lines: [{ type: "LESSON", id: "l9" }],
    lessons: metaLessons,
    modules: [metaModule],
    courses: [],
    sources: [source("l9", 3990, ["l9"])],
    ownedLessonIds: ["l9"],
  });
  assert.equal(repeat.ok, false);
  if (!repeat.ok) assert.match(repeat.message, /já tem esta aula/);
  const refundedNotEligible = eligibleCreditCents(["l9", "l10"], []);
  assert.equal(refundedNotEligible, 0);
  assert.equal(amountDueCents(7190, 3990), 3200);
});

test("upgrade do curso completo usa crédito real sem duplicar módulo", () => {
  const paid = [
    lesson("l4", 2990),
    lesson("l5", 3490),
    lesson("l6", 3990),
    lesson("l7", 3990),
    lesson("l8", 3490),
    lesson("l9", 3990),
    lesson("l10", 3990),
    lesson("l11", 3490),
    lesson("l12", 3990),
  ];
  const fullCourse: SaleCourse = {
    ...course,
    id: "course",
    slug: "trafego-pago-na-pratica",
    bundlePriceCents: 24990,
    paidLessonIds: paid.map((item) => item.id),
    lessonCount: 12,
  };
  function due(sources: CreditSource[], owned: string[]) {
    const quote = quoteCart({
      lines: [{ type: "COURSE", id: "course" }],
      lessons: paid,
      modules: [],
      courses: [fullCourse],
      sources,
      ownedLessonIds: owned,
    });
    assert.equal(quote.ok, true);
    return quote.ok ? { credit: quote.creditCents, total: quote.totalCents, kind: quote.kind } : null;
  }
  assert.deepEqual(due([], []), { credit: 0, total: 24990, kind: "payment" });
  assert.deepEqual(due([source("l4", 2990, ["l4"])], ["l4"]), { credit: 2990, total: 22000, kind: "payment" });
  assert.deepEqual(
    due([source("planeje", 5790, ["l4", "l5"])], ["l4", "l5"]),
    { credit: 5790, total: 19200, kind: "payment" },
  );
  assert.deepEqual(
    due([source("l4", 2990, ["l4"]), source("planeje", 2800, ["l4", "l5"])], ["l4", "l5"]),
    { credit: 5790, total: 19200, kind: "payment" },
  );
  assert.deepEqual(
    due([source("l6", 3990, ["l6"]), source("google", 6400, ["l6", "l7", "l8"])], ["l6", "l7", "l8"]),
    { credit: 10390, total: 14600, kind: "payment" },
  );
  assert.deepEqual(
    due(
      [source("planeje", 5790, ["l4", "l5"]), source("google", 10390, ["l6", "l7", "l8"])],
      ["l4", "l5", "l6", "l7", "l8"],
    ),
    { credit: 16180, total: 8810, kind: "payment" },
  );
  const allOwned = quoteCart({
    lines: [{ type: "COURSE", id: "course" }],
    lessons: paid,
    modules: [],
    courses: [fullCourse],
    sources: [
      source("planeje", 5790, ["l4", "l5"]),
      source("google", 10390, ["l6", "l7", "l8"]),
      source("meta", 7190, ["l9", "l10"]),
      source("final", 6790, ["l11", "l12"]),
    ],
    ownedLessonIds: paid.map((item) => item.id),
  });
  assert.equal(allOwned.ok, false);
  if (!allOwned.ok) assert.match(allOwned.message, /já tem este conteúdo/);
  assert.equal(amountDueCents(24990, 33410), 0);
});

test("curso completo exibe 12 aulas e mantém entitlement pago em 9", () => {
  const free = [
    lesson("l1", 0, { accessType: "FREE", priceCents: null, commerceStatus: "NOT_FOR_SALE" }),
    lesson("l2", 0, { accessType: "FREE", priceCents: null, commerceStatus: "NOT_FOR_SALE" }),
    lesson("l3", 0, { accessType: "FREE", priceCents: null, commerceStatus: "NOT_FOR_SALE" }),
  ];
  const paid = [
    lesson("l4", 2990),
    lesson("l5", 3490),
    lesson("l6", 3990),
    lesson("l7", 3990),
    lesson("l8", 3490),
    lesson("l9", 3990),
    lesson("l10", 3990),
    lesson("l11", 3490),
    lesson("l12", 3990),
  ];
  const modules: SaleModule[] = [
    {
      ...moduleRow,
      id: "planeje",
      slug: "planeje-antes-de-anunciar",
      title: "Planeje",
      bundlePriceCents: 5790,
      paidLessonIds: ["l4", "l5"],
      lessonCount: 2,
    },
    {
      ...moduleRow,
      id: "google",
      slug: "google-ads-na-pratica",
      title: "Google",
      bundlePriceCents: 10390,
      paidLessonIds: ["l6", "l7", "l8"],
      lessonCount: 3,
    },
    {
      ...moduleRow,
      id: "meta",
      slug: "meta-ads-na-pratica",
      title: "Meta",
      bundlePriceCents: 7190,
      paidLessonIds: ["l9", "l10"],
      lessonCount: 2,
    },
    {
      ...moduleRow,
      id: "final",
      slug: "entenda-e-melhore",
      title: "Final",
      bundlePriceCents: 6790,
      paidLessonIds: ["l11", "l12"],
      lessonCount: 2,
    },
  ];
  const fullCourse: SaleCourse = {
    ...course,
    id: "course",
    slug: "trafego-pago-na-pratica",
    bundlePriceCents: 24990,
    paidLessonIds: paid.map((item) => item.id),
    lessonCount: free.length + paid.length,
  };

  assert.equal(fullCourse.lessonCount, 12);
  assert.equal(fullCourse.paidLessonIds.length, 9);
  assert.deepEqual(
    modules.map((row) => ({ title: row.title, count: row.lessonCount })),
    [
      { title: "Planeje", count: 2 },
      { title: "Google", count: 3 },
      { title: "Meta", count: 2 },
      { title: "Final", count: 2 },
    ],
  );

  const quote = quoteCart({
    lines: [{ type: "COURSE", id: "course" }],
    lessons: [...free, ...paid],
    modules,
    courses: [fullCourse],
    sources: [source("l4", 2990, ["l4"])],
    ownedLessonIds: ["l4"],
  });
  assert.equal(quote.ok, true);
  if (!quote.ok) return;
  assert.equal(quote.items[0]?.displayLessonCount, 12);
  assert.equal(quote.items[0]?.lessonIds.length, 9);
  assert.equal(quote.creditCents, 2990);
  assert.equal(quote.totalCents, 22000);
});

test("upgrade do módulo final usa só o valor pago das aulas 11 e 12", () => {
  const finalLessons = [lesson("l11", 3490), lesson("l12", 3990)];
  const finalModule: SaleModule = {
    ...moduleRow,
    id: "final",
    slug: "entenda-e-melhore",
    bundlePriceCents: 6790,
    paidLessonIds: ["l11", "l12"],
    lessonCount: 2,
  };
  function due(paid: Array<[string, number]>, owned: string[]) {
    const quote = quoteCart({
      lines: [{ type: "MODULE", id: "final" }],
      lessons: finalLessons,
      modules: [finalModule],
      courses: [],
      sources: paid.map(([id, cents]) => source(id, cents, [id])),
      ownedLessonIds: owned,
    });
    assert.equal(quote.ok, true);
    return quote.ok ? { credit: quote.creditCents, total: quote.totalCents, kind: quote.kind } : null;
  }
  assert.deepEqual(due([], []), { credit: 0, total: 6790, kind: "payment" });
  assert.deepEqual(due([["l11", 3490]], ["l11"]), { credit: 3490, total: 3300, kind: "payment" });
  assert.deepEqual(due([["l12", 3990]], ["l12"]), { credit: 3990, total: 2800, kind: "payment" });
  const ownedBoth = quoteCart({
    lines: [{ type: "MODULE", id: "final" }],
    lessons: finalLessons,
    modules: [finalModule],
    courses: [],
    sources: [source("l11", 3490, ["l11"]), source("l12", 3990, ["l12"])],
    ownedLessonIds: ["l11", "l12"],
  });
  assert.equal(ownedBoth.ok, false);
  if (!ownedBoth.ok) assert.match(ownedBoth.message, /já tem este conteúdo/);
  const entitlementOnly = quoteCart({
    lines: [{ type: "MODULE", id: "final" }],
    lessons: finalLessons,
    modules: [finalModule],
    courses: [],
    sources: [],
    ownedLessonIds: ["l11"],
  });
  assert.equal(entitlementOnly.ok && entitlementOnly.creditCents, 0);
  assert.equal(entitlementOnly.ok && entitlementOnly.totalCents, 6790);
  const countedOnce = eligibleCreditCents(
    ["l11", "l12"],
    [source("l11", 3490, ["l11"]), source("l12", 3990, ["l12"])],
  );
  assert.equal(countedOnce, 7480);
  const unrelated = quoteCart({
    lines: [{ type: "MODULE", id: "final" }],
    lessons: [...finalLessons, lesson("l9", 3990)],
    modules: [finalModule],
    courses: [],
    sources: [source("l9", 3990, ["l9"])],
    ownedLessonIds: ["l9"],
  });
  assert.equal(unrelated.ok && unrelated.creditCents, 0);
  assert.equal(unrelated.ok && unrelated.totalCents, 6790);
  const repeat = quoteCart({
    lines: [{ type: "LESSON", id: "l11" }],
    lessons: finalLessons,
    modules: [finalModule],
    courses: [],
    sources: [source("l11", 3490, ["l11"])],
    ownedLessonIds: ["l11"],
  });
  assert.equal(repeat.ok, false);
  if (!repeat.ok) assert.match(repeat.message, /já tem esta aula/);
  const refundedNotEligible = eligibleCreditCents(["l11", "l12"], []);
  assert.equal(refundedNotEligible, 0);
  assert.equal(amountDueCents(6790, 3490), 3300);
  assert.equal(amountDueCents(6790, 3990), 2800);
});

test("reconciliação não libera pendente e não duplica aprovado", () => {
  const pending = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PENDING_PAYMENT",
    orderTotalCents: 3990,
    paymentStatus: "PENDING",
    paymentAmountCents: 3990,
    provider: view({ status: "pending" }),
    alreadyGranted: false,
  });
  assert.equal(pending.grant, false);
  assert.equal(pending.paymentStatus, "PENDING");

  const approved = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PENDING_PAYMENT",
    orderTotalCents: 3990,
    paymentStatus: "PENDING",
    paymentAmountCents: 3990,
    provider: view({ status: "approved", paymentTypeId: "credit_card" }),
    alreadyGranted: false,
  });
  assert.equal(approved.grant, true);
  assert.equal(approved.orderStatus, "PAID");

  const repeat = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PAID",
    orderTotalCents: 3990,
    paymentStatus: "APPROVED",
    paymentAmountCents: 3990,
    provider: view({ status: "approved" }),
    alreadyGranted: true,
  });
  assert.equal(repeat.ignore, true);
  assert.equal(repeat.grant, false);

  const secondApproved = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PAID",
    orderTotalCents: 3990,
    paymentStatus: "PENDING",
    paymentAmountCents: 3990,
    provider: view({ status: "approved", id: "mp-2" }),
    alreadyGranted: true,
  });
  assert.equal(secondApproved.orderStatus, "NEEDS_REVIEW");
  assert.equal(secondApproved.grant, false);

  const unknown = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PENDING_PAYMENT",
    orderTotalCents: 3990,
    paymentStatus: "PENDING",
    paymentAmountCents: 3990,
    provider: view({ status: "mystery" }),
    alreadyGranted: false,
  });
  assert.equal(unknown.grant, false);
  assert.equal(unknown.orderStatus, "NEEDS_REVIEW");

  const partial = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PAID",
    orderTotalCents: 3990,
    paymentStatus: "APPROVED",
    paymentAmountCents: 3990,
    provider: view({ status: "approved", refundedCents: 1000 }),
    alreadyGranted: true,
  });
  assert.equal(partial.paymentStatus, "PARTIALLY_REFUNDED");
  assert.equal(partial.orderStatus, "NEEDS_REVIEW");
  assert.equal(partial.revoke, false);

  const refunded = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PAID",
    orderTotalCents: 3990,
    paymentStatus: "APPROVED",
    paymentAmountCents: 3990,
    provider: view({ status: "refunded", refundedCents: 3990 }),
    alreadyGranted: true,
  });
  assert.equal(refunded.revoke, true);
  assert.equal(refunded.orderStatus, "REFUNDED");

  const chargeback = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PAID",
    orderTotalCents: 3990,
    paymentStatus: "APPROVED",
    paymentAmountCents: 3990,
    provider: view({ status: "charged_back" }),
    alreadyGranted: true,
  });
  assert.equal(chargeback.paymentStatus, "CHARGED_BACK");
  assert.equal(chargeback.revoke, true);

  const order = readProviderPayment({
    id: "ORD01EXAMPLE",
    type: "online",
    status: "processed",
    status_detail: "accredited",
    total_amount: "39.90",
    country_code: "BRA",
    external_reference: "order-1",
    transactions: {
      payments: [{ amount: "39.90", status: "processed", status_detail: "accredited", payment_method: { id: "master", type: "credit_card", installments: 1 } }],
    },
  });
  assert.equal(order?.status, "approved");
  assert.equal(order?.amountCents, 3990);
  assert.equal(order?.currency, "BRL");
  assert.equal(order?.paymentTypeId, "credit_card");
  const pix = readProviderPayment({
    id: "ORD01PIX",
    status: "action_required",
    status_detail: "waiting_transfer",
    total_amount: "10.00",
    country_code: "BRA",
    external_reference: "order-2",
    transactions: { payments: [{ amount: "10.00", status: "action_required", status_detail: "waiting_transfer", payment_method: { id: "pix", type: "bank_transfer", qr_code: "000201", qr_code_base64: "aW1n" } }] },
  });
  assert.equal(pix?.status, "pending");
  assert.equal(pix?.paymentTypeId, "bank_transfer");
  const wrapped = readProviderPayment({
    errors: [{ code: "failed", message: "The following transactions failed" }],
    data: {
      id: "ORD01FAIL",
      status: "failed",
      status_detail: "failed",
      total_amount: "10.00",
      currency: "BRL",
      country_code: "BRA",
      external_reference: "order-3",
      transactions: {
        payments: [{ amount: "10.00", status: "failed", status_detail: "rejected_by_issuer", payment_method: { id: "master", type: "credit_card", installments: 1 } }],
      },
    },
  });
  assert.equal(wrapped?.id, "ORD01FAIL");
  assert.equal(wrapped?.status, "rejected");
  assert.equal(wrapped?.statusDetail, "rejected_by_issuer");
});

test("aula gratuita abre e aula paga só abre com direito", () => {
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "FREE" }), true);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }), false);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }, { entitled: true }), true);
  assert.deepEqual(visibleBlocks({ status: "PUBLISHED", accessType: "PAID" }, ["segredo"]), []);
  assert.deepEqual(visibleBlocks({ status: "PUBLISHED", accessType: "PAID" }, ["segredo"], { entitled: true }), ["segredo"]);
});

test("assinatura inválida é recusada e a válida confere o manifesto", () => {
  assert.equal(verifyMercadoPagoSignature({ secret: "segredo-teste", xSignature: null, xRequestId: "req", dataId: "123" }), false);
  const manifest = "id:123;request-id:req-1;ts:1000;";
  const v1 = createHmac("sha256", "segredo-teste").update(manifest).digest("hex");
  assert.equal(
    verifyMercadoPagoSignature({
      secret: "segredo-teste",
      xSignature: `ts=1000,v1=${v1}`,
      xRequestId: "req-1",
      dataId: "123",
    }),
    true,
  );
  assert.equal(
    verifyMercadoPagoSignature({
      secret: "outro-segredo",
      xSignature: `ts=1000,v1=${v1}`,
      xRequestId: "req-1",
      dataId: "123",
    }),
    false,
  );
});

test("e-mail e analytics de compra não levam cartão nem repetem o pedido", () => {
  const message = purchaseEmail({ items: ["Aula A"], totalLabel: "R$ 39,90", learnUrl: "http://localhost:3000/app/aprendizado" });
  assert.equal(message.subject, "Compra confirmada — Alexandre Feio");
  assert.equal(message.text.includes("cartão"), false);
  assert.equal(message.text.includes("CVV"), false);
  const payload = commerceAnalyticsPayload({ totalCents: 3990, orderId: "order-public", itemType: "LESSON", itemSlug: "aula-a" });
  assert.equal(payload.currency, "BRL");
  assert.equal(payload.value, 39.9);
  assert.equal(payload.transaction_id, "order-public");
  assert.equal("email" in payload, false);
  assert.equal(purchaseDedupeKey("order-public"), purchaseDedupeKey("order-public"));
  assert.equal(needsSession("/app/compras"), true);
  assert.equal(needsSession("/app/checkout"), true);
  assert.equal(needsSession("/api/webhooks/mercado-pago"), false);
});

test("comércio só abre com ambiente sintético explícito", () => {
  const credentials = {
    NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY: "dummy-public-key",
    MERCADO_PAGO_ACCESS_TOKEN: "dummy-access-token",
    MERCADO_PAGO_WEBHOOK_SECRET: "dummy-webhook-secret",
  };
  assert.equal(isCommerceEnabled({}), false);
  const production = {
    COMMERCE_ENABLED: "true",
    COMMERCE_PRODUCTION_READY: "true",
    MERCADO_PAGO_ENV: "production",
    DATABASE_ENV: "production",
    VERCEL_ENV: "production",
    ...credentials,
  };
  assert.equal(isCommerceEnabled(production), true);
  assert.equal(isCommerceEnabled({ ...production, COMMERCE_PRODUCTION_READY: "false" }), false);
  assert.equal(
    isCommerceEnabled({
      COMMERCE_ENABLED: "true",
      COMMERCE_PRODUCTION_READY: "false",
      MERCADO_PAGO_ENV: "test",
      DATABASE_ENV: "development",
      VERCEL_ENV: "development",
      ...credentials,
    }),
    true,
  );
});

test("lock de pagamento usa a tabela física order e não o model Order", () => {
  const sql = orderPaymentLockSql("order-1", "user-1");
  const text = sql.strings.join("?");
  assert.match(text, /FROM "order"/);
  assert.equal(/FROM "Order"/.test(text), false);
  assert.match(text, /FOR UPDATE/);
  assert.match(text, /"userId"/);
  const ordersSource = readFileSync("src/lib/commerce/orders.ts", "utf8");
  assert.equal(ordersSource.includes('FROM "Order"'), false);
  assert.match(ordersSource, /FROM "order"/);
});

test("Brick distingue reload de UI e cobrança incerta; painel Pix permanece", () => {
  const brick = readFileSync("src/components/commerce/PaymentBrick.tsx", "utf8");
  assert.match(brick, /onError=/);
  assert.match(brick, /onReady=/);
  assert.match(brick, /submittingRef/);
  assert.match(brick, /Recarregar formulário/);
  assert.match(brick, /reloadBrickUi/);
  assert.match(brick, /payment_uncertain/);
  assert.match(brick, /Abrir o pedido/);
  assert.equal(brick.includes("Tentar novamente"), false);
  assert.equal(/console\.(log|error|info)\(.*token/i.test(brick), false);

  const panel = readFileSync("src/components/commerce/PixPaymentPanel.tsx", "utf8");
  assert.match(panel, /Copiar Pix Copia e Cola/);
  assert.match(panel, /QR Code ainda não está disponível/);
  assert.match(panel, /Não gere outra cobrança/);

  const page = readFileSync("src/app/(app)/app/compras/[id]/page.tsx", "utf8");
  assert.match(page, /PixPaymentPanel/);
  assert.match(page, /awaitingPix/);

  const ordersSource = readFileSync("src/lib/commerce/orders.ts", "utf8");
  assert.equal(ordersSource.includes("20_000"), false);
  // Cancelamento só via cancelAbandonedCheckoutForUser (explícito), nunca por timer.
  assert.match(ordersSource, /cancelAbandonedCheckoutForUser/);
  assert.equal(/setTimeout[\s\S]*CANCELLED|20_000[\s\S]*CANCELLED/.test(ordersSource), false);
});

test("Pix simulado lê QR e cartão continua aceito", () => {
  assert.equal(acceptedMethod("pix"), "PIX");
  assert.equal(acceptedMethod("master", "tok_card"), "CREDIT_CARD");
  const payload = {
    id: "ORD01PIX-SIM",
    status: "action_required",
    status_detail: "waiting_transfer",
    total_amount: "14.90",
    country_code: "BRA",
    external_reference: "order-pix",
    transactions: {
      payments: [
        {
          amount: "14.90",
          status: "action_required",
          status_detail: "waiting_transfer",
          payment_method: { id: "pix", type: "bank_transfer", qr_code: "0002012658", qr_code_base64: "aW1n" },
        },
      ],
    },
  };
  const view = readProviderPayment(payload);
  assert.equal(view?.status, "pending");
  assert.equal(view?.paymentTypeId, "bank_transfer");
  assert.deepEqual(readPix(payload), { copy: "0002012658", image: "aW1n", ticketUrl: null });
  assert.equal(readPix({ ...payload, transactions: { payments: [{ amount: "14.90", payment_method: { id: "pix", type: "bank_transfer" } }] } }), null);
  assert.deepEqual(
    readPix({
      id: "ORD1",
      external_reference: "o1",
      total_amount: "14.90",
      country_code: "BRA",
      transactions: {
        payments: [
          {
            amount: "14.90",
            payment_method: {
              id: "pix",
              type: "bank_transfer",
              qr_code: "000201copia",
              qr_code_base64: "",
              ticket_url: "https://www.mercadopago.com.br/sandbox/payments/1/ticket",
            },
          },
        ],
      },
    }),
    {
      copy: "000201copia",
      image: null,
      ticketUrl: "https://www.mercadopago.com.br/sandbox/payments/1/ticket",
    },
  );
  assert.deepEqual(
    readPix({
      id: "ORD2",
      external_reference: "o2",
      total_amount: "14.90",
      country_code: "BRA",
      transactions: {
        payments: [
          {
            amount: "14.90",
            payment_method: {
              id: "pix",
              type: "bank_transfer",
              ticket_url: "https://evil.example/phish",
            },
          },
        ],
      },
    }),
    null,
  );
});

test("falha de provedor distingue rejeição definitiva de resultado desconhecido", () => {
  assert.equal(classifyProviderChargeFailure({ networkError: true, httpStatus: null, view: null }), "unknown");
  assert.equal(classifyProviderChargeFailure({ httpStatus: 504, view: null }), "unknown");
  assert.equal(classifyProviderChargeFailure({ httpStatus: 502, view: null }), "unknown");
  assert.equal(classifyProviderChargeFailure({ httpStatus: 400, view: null }), "rejected");
  assert.equal(
    classifyProviderChargeFailure({
      httpStatus: 402,
      view: {
        id: "x",
        status: "rejected",
        statusDetail: "failed",
        amountCents: 1490,
        currency: "BRL",
        externalReference: "o1",
        paymentTypeId: "credit_card",
        installments: 1,
        refundedCents: 0,
      },
    }),
    "rejected",
  );
  assert.equal(
    classifyProviderChargeFailure({
      httpStatus: 402,
      view: null,
      remoteOrderIdPresent: true,
    }),
    "unknown",
  );
  assert.equal(
    classifyProviderChargeFailure({
      httpStatus: 200,
      view: {
        id: "x",
        status: "pending",
        statusDetail: null,
        amountCents: 1490,
        currency: "BRL",
        externalReference: "o1",
        paymentTypeId: "bank_transfer",
        installments: null,
        refundedCents: 0,
      },
    }),
    "unknown",
  );
});

test("tentativa aberta nunca gera nova chave enquanto estiver incerta; rejeitada permite nova", () => {
  const base = {
    id: "pay-1",
    idempotencyKey: "idem-1",
    amountCents: 1490,
    providerPaymentId: null as string | null,
    providerStatus: null as string | null,
    providerStatusDetail: null as string | null,
    status: "PENDING",
  };
  assert.equal(decidePaymentAttempt(null).action, "create_new");
  assert.equal(decidePaymentAttempt(base).action, "continue_same");
  assert.equal(decidePaymentAttempt({ ...base, providerStatus: "charge_dispatched" }).action, "resume_idempotent");
  assert.equal(decidePaymentAttempt({ ...base, providerStatus: "outcome_unknown" }).action, "resume_idempotent");
  assert.equal(
    decidePaymentAttempt({ ...base, providerPaymentId: "mp-1", providerStatus: "pending" }).action,
    "reuse_provider",
  );

  // Simula “após 20s”: ainda assim resume_idempotent, sem create_new.
  const aged = { ...base, providerStatus: "outcome_unknown" };
  assert.equal(decidePaymentAttempt(aged).action, "resume_idempotent");

  const fpPix = chargeFingerprint({ orderId: "order-1", amountCents: 1490, paymentMethodId: "pix", payerEmail: "a@test.com" });
  const fpCard = chargeFingerprint({
    orderId: "order-1",
    amountCents: 1490,
    paymentMethodId: "master",
    installments: 1,
    payerEmail: "a@test.com",
  });
  assert.notEqual(fpPix, fpCard);
  assert.equal(readStoredChargeFingerprint(`fp:${fpPix}`), fpPix);
  assert.equal(
    chargeFingerprint({ orderId: "order-1", amountCents: 1490, paymentMethodId: "pix", payerEmail: "a@test.com" }),
    chargeFingerprint({ orderId: "order-1", amountCents: 1490, paymentMethodId: "pix", installments: 3, payerEmail: "a@test.com" }),
  );
  assert.notEqual(
    chargeFingerprint({ orderId: "order-1", amountCents: 1490, paymentMethodId: "pix", payerEmail: "a@test.com" }),
    chargeFingerprint({ orderId: "order-1", amountCents: 1490, paymentMethodId: "pix", payerEmail: "b@test.com" }),
  );
});

test("actions marcam unknown sem REJECTED e exigem fingerprint estável", () => {
  const actions = readFileSync("src/lib/commerce/actions.ts", "utf8");
  assert.match(actions, /PROVIDER_STATUS_UNKNOWN/);
  assert.match(actions, /claimChargeDispatch/);
  assert.match(actions, /fingerprint_mismatch/);
  assert.match(actions, /kind === "unknown"/);
  assert.match(actions, /updateOpenPaymentMarkers/);
  assert.equal(actions.includes('status: "REJECTED", providerStatus: "request_failed"') || actions.includes('providerStatus: "request_failed"'), true);
  // Não rejeita automaticamente em falha desconhecida.
  assert.match(actions, /charge\.kind === "unknown"/);
  assert.equal(/else if \(!charge\.ok\)[\s\S]*REJECTED/.test(actions), false);
  // Timeout/unknown não força status=PENDING.
  assert.equal(/kind === "unknown"[\s\S]*status:\s*"PENDING"/.test(actions), false);
});

test("claim de despacho: virgem, Pix idêntico, divergente e cartão incerto", async () => {
  const { decideChargeDispatchClaim } = await import("../src/lib/commerce/payment-guards");
  const virgin = decideChargeDispatchClaim({
    status: "PENDING",
    providerStatus: null,
    providerStatusDetail: null,
    providerPaymentId: null,
    fingerprintDetail: "fp:aaa",
    method: "PIX",
  });
  assert.equal(virgin.kind, "dispatch");

  const samePix = decideChargeDispatchClaim({
    status: "PENDING",
    providerStatus: "charge_dispatched",
    providerStatusDetail: "fp:aaa",
    providerPaymentId: null,
    fingerprintDetail: "fp:aaa",
    method: "PIX",
  });
  assert.equal(samePix.kind, "resume");

  const diverged = decideChargeDispatchClaim({
    status: "PENDING",
    providerStatus: "charge_dispatched",
    providerStatusDetail: "fp:aaa",
    providerPaymentId: null,
    fingerprintDetail: "fp:bbb",
    method: "PIX",
  });
  assert.equal(diverged.kind, "deny");
  if (diverged.kind === "deny") assert.equal(diverged.reason, "fingerprint_mismatch");

  const card = decideChargeDispatchClaim({
    status: "PENDING",
    providerStatus: "charge_dispatched",
    providerStatusDetail: "fp:aaa",
    providerPaymentId: null,
    fingerprintDetail: "fp:aaa",
    method: "CREDIT_CARD",
  });
  assert.equal(card.kind, "deny");
  if (card.kind === "deny") assert.equal(card.reason, "card_uncertain");

  const apply = readFileSync("src/lib/commerce/apply.ts", "utf8");
  assert.match(apply, /claimChargeDispatch/);
  assert.match(apply, /providerStatus: \{ notIn:/);
});

test("guards de concorrência: APPROVED não regride; overlap de checkout incerto", async () => {
  const {
    mayOverwritePaymentStatus,
    shouldIgnoreStaleProviderStatus,
    planUnknownOutcomeUpdate,
    planRejectedIfOpen,
    cartOverlapsUncertainOrder,
    productKey,
    lessonSetsOverlap,
    collectLessonIdsFromOrderItems,
  } = await import("../src/lib/commerce/payment-guards");
  type PaymentRowLike = {
    id: string;
    status: import("../src/lib/commerce/reconcile").InternalPaymentStatus;
    providerStatus: string | null;
    providerStatusDetail: string | null;
  };
  type InternalPaymentStatus = import("../src/lib/commerce/reconcile").InternalPaymentStatus;

  assert.equal(mayOverwritePaymentStatus("APPROVED", "PENDING"), false);
  assert.equal(mayOverwritePaymentStatus("APPROVED", "REJECTED"), false);
  assert.equal(mayOverwritePaymentStatus("APPROVED", "IN_PROCESS"), false);
  assert.equal(mayOverwritePaymentStatus("APPROVED", "APPROVED"), true);
  assert.equal(mayOverwritePaymentStatus("APPROVED", "REFUNDED"), true);
  assert.equal(mayOverwritePaymentStatus("PENDING", "APPROVED"), true);
  assert.equal(mayOverwritePaymentStatus("REJECTED", "APPROVED"), true);

  assert.equal(shouldIgnoreStaleProviderStatus("APPROVED", "pending"), true);
  assert.equal(shouldIgnoreStaleProviderStatus("APPROVED", "rejected"), true);
  assert.equal(shouldIgnoreStaleProviderStatus("APPROVED", "approved"), false);
  assert.equal(shouldIgnoreStaleProviderStatus("PENDING", "pending"), false);

  const open = planUnknownOutcomeUpdate(
    { id: "p1", status: "PENDING", providerStatus: "charge_dispatched", providerStatusDetail: "fp:x" },
    "fp:x",
  );
  assert.equal(open.apply, true);
  const locked = planUnknownOutcomeUpdate(
    { id: "p1", status: "APPROVED", providerStatus: "approved", providerStatusDetail: null },
    "fp:x",
  );
  assert.equal(locked.apply, false);
  assert.equal(planRejectedIfOpen({ id: "p1", status: "APPROVED", providerStatus: "approved", providerStatusDetail: null }, "fp:x").apply, false);

  assert.equal(
    cartOverlapsUncertainOrder({
      cartKeys: [productKey("LESSON", "a")],
      uncertainOrderKeys: [productKey("LESSON", "a")],
    }),
    true,
  );
  assert.equal(
    cartOverlapsUncertainOrder({
      cartKeys: [productKey("LESSON", "b")],
      uncertainOrderKeys: [productKey("LESSON", "a")],
    }),
    false,
  );

  // Sobreposição real por aulas (não só SKU)
  assert.equal(lessonSetsOverlap(["a"], ["a"]), true);
  assert.equal(lessonSetsOverlap(["a"], ["b"]), false);
  assert.equal(lessonSetsOverlap(["a"], ["a", "b", "c"]), true); // aula → módulo
  assert.equal(lessonSetsOverlap(["a", "b", "c"], ["a"]), true); // módulo → aula
  assert.equal(lessonSetsOverlap(["a", "b"], ["c", "d", "a"]), true); // módulo → curso
  assert.equal(lessonSetsOverlap(["x"], ["a", "b"]), false);
  assert.deepEqual(
    collectLessonIdsFromOrderItems([
      { lessonId: "a", lessons: [{ lessonId: "a" }] },
      { lessonId: null, lessons: [{ lessonId: "a" }, { lessonId: "b" }] },
    ]).sort(),
    ["a", "b"],
  );

  /** Simula a serialização FOR UPDATE de apply/updateOpenPaymentMarkers sem banco. */
  type Row = PaymentRowLike & { orderStatus: "PENDING_PAYMENT" | "PAID" | "NEEDS_REVIEW"; entitlements: number; idempotencyKey: string };
  const mutex = { locked: false };
  async function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    while (mutex.locked) await new Promise((r) => setTimeout(r, 1));
    mutex.locked = true;
    try {
      return await fn();
    } finally {
      mutex.locked = false;
    }
  }

  function markOpen(row: Row, kind: "unknown" | "rejected") {
    return withLock(() => {
      const plan = kind === "unknown" ? planUnknownOutcomeUpdate(row, "fp:x") : planRejectedIfOpen(row, "fp:x");
      if (!plan.apply) return { updated: false as const, status: row.status };
      Object.assign(row, plan.data);
      return { updated: true as const, status: row.status };
    });
  }

  function applyView(row: Row, providerStatus: string, amountCents = 1490) {
    return withLock(() => {
      if (shouldIgnoreStaleProviderStatus(row.status, providerStatus)) {
        return { ignored: true as const };
      }
      const decision = reconcileDecision({
        orderId: "order-1",
        orderStatus: row.orderStatus,
        orderTotalCents: amountCents,
        paymentStatus: row.status as InternalPaymentStatus,
        paymentAmountCents: amountCents,
        provider: view({ status: providerStatus as ProviderPaymentView["status"], amountCents, externalReference: "order-1" }),
        alreadyGranted: row.entitlements > 0,
      });
      if (!mayOverwritePaymentStatus(row.status, decision.paymentStatus)) {
        return { ignored: true as const };
      }
      row.status = decision.paymentStatus;
      row.providerStatus = providerStatus;
      if (!decision.ignore) {
        if (!(row.orderStatus === "PAID" && decision.orderStatus !== "PAID" && decision.orderStatus !== "REFUNDED")) {
          row.orderStatus = decision.orderStatus as Row["orderStatus"];
        }
      }
      if (decision.grant) row.entitlements = 1;
      return { ignored: false as const, decision };
    });
  }

  // Webhook APPROVED antes do timeout
  const a: Row = {
    id: "a",
    status: "PENDING",
    providerStatus: "charge_dispatched",
    providerStatusDetail: "fp:x",
    orderStatus: "PENDING_PAYMENT",
    entitlements: 0,
    idempotencyKey: "idem-a",
  };
  await applyView(a, "approved");
  assert.equal(a.status, "APPROVED");
  assert.equal(a.orderStatus, "PAID");
  assert.equal(a.entitlements, 1);
  assert.equal((await markOpen(a, "unknown")).updated, false);
  assert.equal(a.status, "APPROVED");
  await applyView(a, "pending");
  await applyView(a, "rejected");
  assert.equal(a.status, "APPROVED");
  assert.equal(a.orderStatus, "PAID");
  assert.notEqual(a.orderStatus, "NEEDS_REVIEW");
  await applyView(a, "approved");
  assert.equal(a.entitlements, 1);

  // Timeout antes do webhook APPROVED
  const b: Row = {
    id: "b",
    status: "PENDING",
    providerStatus: null,
    providerStatusDetail: null,
    orderStatus: "PENDING_PAYMENT",
    entitlements: 0,
    idempotencyKey: "idem-b",
  };
  assert.equal((await markOpen(b, "unknown")).updated, true);
  assert.equal(b.providerStatus, "outcome_unknown");
  assert.equal(b.status, "PENDING");
  // novo checkout com overlap incerto bloqueado (por aulas)
  assert.equal(lessonSetsOverlap(["b"], ["b"]), true);
  // mesma chave: decidePaymentAttempt resume_idempotent
  assert.equal(
    decidePaymentAttempt({
      id: b.id,
      idempotencyKey: b.idempotencyKey,
      amountCents: 1490,
      providerPaymentId: null,
      providerStatus: b.providerStatus,
      providerStatusDetail: "fp:x",
      status: b.status,
    }).action,
    "resume_idempotent",
  );
  await Promise.all([applyView(b, "approved"), applyView(b, "approved")]);
  assert.equal(b.status, "APPROVED");
  assert.equal(b.entitlements, 1);
  assert.equal((await markOpen(b, "unknown")).updated, false);

  // HTTP rejected depois de APPROVED
  const c: Row = {
    id: "c",
    status: "APPROVED",
    providerStatus: "approved",
    providerStatusDetail: null,
    orderStatus: "PAID",
    entitlements: 1,
    idempotencyKey: "idem-c",
  };
  assert.equal((await markOpen(c, "rejected")).updated, false);
  await applyView(c, "rejected");
  assert.equal(c.status, "APPROVED");
  assert.equal(c.orderStatus, "PAID");

  const brick = readFileSync("src/components/commerce/PaymentBrick.tsx", "utf8");
  assert.match(brick, /uncertainRef/);
  assert.match(brick, /if \(uncertainRef\.current\) return/);
  const apply = readFileSync("src/lib/commerce/apply.ts", "utf8");
  assert.match(apply, /mayOverwritePaymentStatus/);
  assert.match(apply, /updateOpenPaymentMarkers/);
  assert.match(apply, /FOR UPDATE/);
  const orders = readFileSync("src/lib/commerce/orders.ts", "utf8");
  assert.match(orders, /findOverlappingPendingCheckout/);
  assert.match(orders, /pg_advisory_xact_lock/);
  assert.match(orders, /commerce-checkout:/);
  assert.match(orders, /OrderItemLesson|lessons: \{ select: \{ lessonId/);
});

test("gate database-live de comércio recusa Prisma compartilhado e exige fingerprint isolado", async () => {
  const { evaluateIsolatedCommerceDatabaseLive, fingerprintDatabaseUrl, canCancelAbandonedCheckout } = await import(
    "../src/lib/db/urls"
  ).then(async (urls) => ({
    ...urls,
    canCancelAbandonedCheckout: (await import("../src/lib/commerce/payment-guards")).canCancelAbandonedCheckout,
  }));
  const shared = "postgresql://user:secret@db.prisma.io:5432/postgres";
  const local = "postgresql://u:p@127.0.0.1:55433/commerce_qa";
  assert.equal(fingerprintDatabaseUrl(shared)?.hostClass, "prisma-postgres");
  assert.equal(
    evaluateIsolatedCommerceDatabaseLive({
      ISOLATED_COMMERCE_DATABASE_TEST: "1",
      DATABASE_ENV: "test",
      MERCADO_PAGO_ENV: "test",
      ISOLATED_COMMERCE_DATABASE_URL: shared,
      RUNTIME_DATABASE_URL: shared,
      POSTGRES_URL: shared,
    }).ok,
    false,
  );
  assert.equal(
    evaluateIsolatedCommerceDatabaseLive({
      ISOLATED_COMMERCE_DATABASE_TEST: "1",
      DATABASE_ENV: "test",
      VERCEL_ENV: "production",
      MERCADO_PAGO_ENV: "test",
      ISOLATED_COMMERCE_DATABASE_URL: local,
      RUNTIME_DATABASE_URL: local,
      POSTGRES_URL: local,
    }).ok,
    false,
  );
  assert.equal(
    evaluateIsolatedCommerceDatabaseLive({
      ISOLATED_COMMERCE_DATABASE_TEST: "1",
      DATABASE_ENV: "test",
      MERCADO_PAGO_ENV: "test",
      ISOLATED_COMMERCE_DATABASE_URL: local,
      RUNTIME_DATABASE_URL: local,
      POSTGRES_URL: shared,
    }).ok,
    false,
  );
  const ok = evaluateIsolatedCommerceDatabaseLive({
    ISOLATED_COMMERCE_DATABASE_TEST: "1",
    DATABASE_ENV: "test",
    MERCADO_PAGO_ENV: "test",
    ISOLATED_COMMERCE_DATABASE_URL: local,
    RUNTIME_DATABASE_URL: local,
    POSTGRES_URL: local,
    PRODUCTION_MIGRATE_HOST: "db.prisma.io",
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.identity.host, "127.0.0.1");
    assert.equal(ok.identity.port, "55433");
    assert.equal(ok.identity.database, "commerce_qa");
    assert.equal(ok.identity.hostClass, "localhost");
  }
  assert.equal(
    canCancelAbandonedCheckout({
      orderStatus: "PENDING_PAYMENT",
      payments: [{ status: "PENDING", providerStatus: null, providerPaymentId: null }],
    }),
    true,
  );
  assert.equal(
    canCancelAbandonedCheckout({
      orderStatus: "PENDING_PAYMENT",
      payments: [{ status: "PENDING", providerStatus: "outcome_unknown", providerPaymentId: null }],
    }),
    false,
  );
  assert.equal(
    canCancelAbandonedCheckout({
      orderStatus: "PENDING_PAYMENT",
      payments: [{ status: "PENDING", providerStatus: "charge_dispatched", providerPaymentId: null }],
    }),
    false,
  );
  assert.equal(
    canCancelAbandonedCheckout({
      orderStatus: "PENDING_PAYMENT",
      payments: [{ status: "PENDING", providerStatus: "pending", providerPaymentId: "mp-1" }],
    }),
    false,
  );
  const runner = readFileSync("scripts/run-database-live-tests.ts", "utf8");
  assert.match(runner, /evaluateIsolatedCommerceDatabaseLive/);
  assert.match(runner, /ABORT/);
  assert.match(runner, /assertIsolatedCommerceLiveConnection/);
});

test("HTTP 402 estruturado extrai status_detail e códigos sem dados sensíveis", () => {
  const payload = {
    errors: [{ code: "failed", message: "transaction failed" }],
    data: {
      id: "ORD_REMOTE_402",
      external_reference: "order-local-1",
      total_amount: "14.90",
      country_code: "BRA",
      status: "failed",
      status_detail: "failed",
      transactions: {
        payments: [
          {
            amount: "14.90",
            status: "failed",
            status_detail: "high_risk",
            payment_method: { id: "pix", type: "bank_transfer" },
          },
        ],
      },
    },
  };
  const view = readProviderPayment(payload);
  assert.equal(view?.id, "ORD_REMOTE_402");
  assert.equal(view?.status, "rejected");
  assert.equal(view?.statusDetail, "high_risk");
  const diagnostics = extractProviderChargeDiagnostics({
    httpStatus: 402,
    payload,
    view,
    method: "PIX",
    correlationId: "order-local-1",
  });
  assert.equal(diagnostics.httpStatus, 402);
  assert.equal(diagnostics.errorCode, "failed");
  assert.equal(diagnostics.statusDetail, "high_risk");
  assert.equal(diagnostics.providerStatus, "failed");
  assert.equal(diagnostics.remoteOrderIdPresent, true);
  assert.equal(diagnostics.correlationId, "order-local-1");
  assert.equal(diagnostics.method, "PIX");
  const serialized = JSON.stringify(diagnostics);
  assert.equal(serialized.includes("cpf"), false);
  assert.equal(serialized.includes("@"), false);
  assert.match(userMessageForProviderRejection(diagnostics), /risco|provedor/i);
});

test("jornada do pedido cobre pendente, rejeitado, Pix, incerto, cancelado e pago", () => {
  assert.equal(
    decidePurchaseJourney({
      orderStatus: "PENDING_PAYMENT",
      payments: [],
      abandonable: true,
    }).primaryCta,
    "continue_payment",
  );
  assert.equal(
    decidePurchaseJourney({
      orderStatus: "PENDING_PAYMENT",
      payments: [{ status: "REJECTED", providerStatus: "request_failed", providerPaymentId: "ord_x", paymentMethodType: "PIX" }],
      abandonable: true,
    }).kind,
    "rejected_retry",
  );
  assert.equal(
    decidePurchaseJourney({
      orderStatus: "PENDING_PAYMENT",
      payments: [{ status: "PENDING", providerStatus: "pending", providerPaymentId: "ord_pix", paymentMethodType: "PIX" }],
      abandonable: false,
    }).kind,
    "pix_pending",
  );
  assert.equal(
    decidePurchaseJourney({
      orderStatus: "PENDING_PAYMENT",
      payments: [{ status: "PENDING", providerStatus: "outcome_unknown", providerPaymentId: null, paymentMethodType: null }],
      abandonable: false,
    }).kind,
    "uncertain",
  );
  assert.equal(
    decidePurchaseJourney({
      orderStatus: "CANCELLED",
      payments: [{ status: "CANCELLED", providerStatus: "checkout_abandoned", providerPaymentId: null, paymentMethodType: null }],
      abandonable: false,
    }).primaryCta,
    "buy_again",
  );
  assert.equal(
    decidePurchaseJourney({
      orderStatus: "PAID",
      payments: [{ status: "APPROVED", providerStatus: "approved", providerPaymentId: "ord_ok", paymentMethodType: "PIX" }],
      abandonable: false,
    }).primaryCta,
    "access_content",
  );
});

test("checkout resume e recompra não reutilizam pedido cancelado", () => {
  const ordersSource = readFileSync("src/lib/commerce/orders.ts", "utf8");
  assert.match(ordersSource, /getResumeCheckoutForUser/);
  assert.match(ordersSource, /repurchaseCancelledOrderForUser/);
  assert.match(ordersSource, /getRepurchasePriceNoticeForUser/);
  assert.match(ordersSource, /Só é possível comprar novamente a partir de um pedido cancelado/);
  assert.match(ordersSource, /previousTotalCents/);
  assert.equal(ordersSource.includes('data: { status: "PENDING_PAYMENT" }'), false);
  const actions = readFileSync("src/lib/commerce/actions.ts", "utf8");
  assert.match(actions, /resumeCheckoutAction/);
  assert.match(actions, /repurchaseCancelledOrderAction/);
  const checkout = readFileSync("src/components/commerce/CheckoutScreen.tsx", "utf8");
  assert.match(checkout, /resumeOrderId/);
  assert.match(checkout, /resumeCheckoutAction/);
  assert.match(checkout, /Recarregar formulário/);
  assert.match(checkout, /não há conclusão automática/i);
  const checkoutPage = readFileSync("src/app/(app)/app/checkout/page.tsx", "utf8");
  assert.match(checkoutPage, /getRepurchasePriceNoticeForUser/);
  assert.match(checkoutPage, /fromOrderId/);
  assert.equal(checkoutPage.includes("params.previous"), false);
  assert.equal(checkoutPage.includes("params.current"), false);
  const buyAgain = readFileSync("src/components/commerce/PurchaseJourneyActions.tsx", "utf8");
  assert.match(buyAgain, /fromOrderId/);
  assert.equal(buyAgain.includes("previous="), false);
  assert.equal(buyAgain.includes("current="), false);
});

test("diagnóstico e ticket_url rejeitam conteúdo livre ou host estranho", () => {
  assert.equal(sanitizeProviderDiagnosticToken("waiting_transfer"), "waiting_transfer");
  assert.equal(sanitizeProviderDiagnosticToken("failed"), "failed");
  assert.equal(sanitizeProviderDiagnosticToken("cpf 123.456.789-00"), "opaque");
  assert.equal(sanitizeProviderDiagnosticToken("user@example.com"), "opaque");
  assert.equal(isAllowedMercadoPagoTicketUrl("https://www.mercadopago.com.br/sandbox/payments/1/ticket")?.includes("mercadopago.com.br"), true);
  assert.equal(isAllowedMercadoPagoTicketUrl("https://evil.example/ticket"), null);
  assert.equal(isAllowedMercadoPagoTicketUrl("http://www.mercadopago.com.br/ticket"), null);
  assert.equal(
    hasPresentablePix({ copy: "000201", image: null, ticketUrl: null }),
    true,
  );
  assert.equal(hasPresentablePix({ copy: null, image: null, ticketUrl: null }), false);
});

