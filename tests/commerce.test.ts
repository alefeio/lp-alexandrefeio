import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { canReadLessonBody, visibleBlocks } from "../src/lib/learning/access";
import { commerceAnalyticsPayload, purchaseDedupeKey } from "../src/lib/commerce/analytics";
import { isCommerceEnabled } from "../src/lib/commerce/config";
import { amountDueCents, eligibleCreditCents, quoteCart, type CreditSource, type SaleCourse, type SaleLesson, type SaleModule } from "../src/lib/commerce/quote";
import { reconcileDecision, type ProviderPaymentView } from "../src/lib/commerce/reconcile";
import { readProviderPayment } from "../src/lib/commerce/provider";
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
  if (process.env.VERCEL_ENV === "production" || process.env.DATABASE_ENV === "production") {
    assert.equal(isCommerceEnabled(), false);
  }
});

