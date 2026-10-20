import { normalizeCartSelection } from "@/lib/commerce/cart-normalize";

export type CommerceStatusName = "NOT_FOR_SALE" | "AVAILABLE";
export type ProductTypeName = "LESSON" | "MODULE" | "COURSE";

export type SaleLesson = {
  id: string;
  slug: string;
  title: string;
  accessType: "FREE" | "PAID";
  status: "DRAFT" | "PUBLISHED";
  commerceStatus: CommerceStatusName;
  priceCents: number | null;
  moduleId: string;
  courseId: string;
};

export type SaleModule = {
  id: string;
  slug: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  commerceStatus: CommerceStatusName;
  bundlePriceCents: number | null;
  courseId: string;
  paidLessonIds: string[];
};

export type SaleCourse = {
  id: string;
  slug: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  commerceStatus: CommerceStatusName;
  bundlePriceCents: number | null;
  paidLessonIds: string[];
};

export type CreditSource = {
  orderItemId: string;
  finalPriceCents: number;
  lessonIds: string[];
};

export type CartLine = { type: ProductTypeName; id: string };

export type QuoteItem = {
  productType: ProductTypeName;
  productId: string;
  title: string;
  slug: string;
  lessonIds: string[];
  listPriceCents: number;
  creditAppliedCents: number;
  finalPriceCents: number;
};

export type Quote =
  | { ok: false; message: string; code?: "empty" | "invalid" | "not_for_sale" | "already_owned" | "mixed" }
  | {
      ok: true;
      kind: "payment" | "zero_upgrade" | "already_owned";
      items: QuoteItem[];
      subtotalCents: number;
      creditCents: number;
      totalCents: number;
      itemType: ProductTypeName;
      lines: CartLine[];
    };

const MAX_INSTALLMENTS = 3;

export function maxCardInstallments(): number {
  return MAX_INSTALLMENTS;
}

function forSale(status: "DRAFT" | "PUBLISHED", commerceStatus: CommerceStatusName, price: number | null): price is number {
  return status === "PUBLISHED" && commerceStatus === "AVAILABLE" && price != null && Number.isInteger(price) && price > 0;
}

function subset(inner: string[], outer: Set<string>) {
  return inner.every((id) => outer.has(id));
}

/** Crédito é a soma do que foi pago de fato em itens contidos no pacote. Não usa o preço de lista. */
export function eligibleCreditCents(targetLessonIds: string[], sources: CreditSource[]): number {
  const target = new Set(targetLessonIds);
  return sources.reduce((sum, source) => {
    if (source.finalPriceCents < 0 || !Number.isInteger(source.finalPriceCents)) return sum;
    if (source.lessonIds.length === 0 || !subset(source.lessonIds, target)) return sum;
    return sum + source.finalPriceCents;
  }, 0);
}

export function amountDueCents(targetPriceCents: number, creditCents: number): number {
  return Math.max(0, targetPriceCents - Math.max(0, creditCents));
}

function lineItem(input: {
  productType: ProductTypeName;
  productId: string;
  title: string;
  slug: string;
  lessonIds: string[];
  listPriceCents: number;
  ownedLessonIds: Set<string>;
  sources: CreditSource[];
}): QuoteItem {
  const rawCredit = eligibleCreditCents(input.lessonIds, input.sources);
  const creditAppliedCents = Math.min(rawCredit, input.listPriceCents);
  return {
    productType: input.productType,
    productId: input.productId,
    title: input.title,
    slug: input.slug,
    lessonIds: input.lessonIds,
    listPriceCents: input.listPriceCents,
    creditAppliedCents,
    finalPriceCents: input.listPriceCents - creditAppliedCents,
  };
}

export function quoteCart(input: {
  lines: CartLine[];
  lessons: SaleLesson[];
  modules: SaleModule[];
  courses: SaleCourse[];
  sources: CreditSource[];
  ownedLessonIds: string[];
}): Quote {
  const lines = normalizeCartSelection(dedupe(input.lines), input);
  if (lines.length === 0) return { ok: false, message: "O carrinho está vazio.", code: "empty" };

  const moduleLines = lines.filter((line) => line.type === "MODULE");
  const courseLines = lines.filter((line) => line.type === "COURSE");
  const lessonLines = lines.filter((line) => line.type === "LESSON");
  if (courseLines.length > 1 || moduleLines.length > 1 || (courseLines.length > 0 && (moduleLines.length > 0 || lessonLines.length > 0))) {
    return { ok: false, message: "Revise os itens do carrinho e tente de novo.", code: "mixed" };
  }

  const owned = new Set(input.ownedLessonIds);
  const items: QuoteItem[] = [];

  for (const line of lessonLines) {
    const lesson = input.lessons.find((item) => item.id === line.id);
    if (!lesson || lesson.accessType !== "PAID" || !forSale(lesson.status, lesson.commerceStatus, lesson.priceCents)) {
      return { ok: false, message: "Esta aula não está à venda.", code: "not_for_sale" };
    }
    if (owned.has(lesson.id)) return { ok: false, message: "Você já tem esta aula.", code: "already_owned" };
    if (moduleLines[0]) {
      const moduleRow = input.modules.find((item) => item.id === moduleLines[0]?.id);
      if (moduleRow?.paidLessonIds.includes(lesson.id)) {
        continue;
      }
    }
    items.push({
      productType: "LESSON",
      productId: lesson.id,
      title: lesson.title,
      slug: lesson.slug,
      lessonIds: [lesson.id],
      listPriceCents: lesson.priceCents,
      creditAppliedCents: 0,
      finalPriceCents: lesson.priceCents,
    });
  }

  if (moduleLines[0]) {
    const moduleRow = input.modules.find((item) => item.id === moduleLines[0]?.id);
    if (!moduleRow || !forSale(moduleRow.status, moduleRow.commerceStatus, moduleRow.bundlePriceCents)) {
      return { ok: false, message: "Este módulo não está à venda.", code: "not_for_sale" };
    }
    if (!compositionReady(moduleRow.paidLessonIds, input.lessons)) {
      return { ok: false, message: "Este módulo ainda não está à venda.", code: "not_for_sale" };
    }
    items.push(
      lineItem({
        productType: "MODULE",
        productId: moduleRow.id,
        title: moduleRow.title,
        slug: moduleRow.slug,
        lessonIds: moduleRow.paidLessonIds,
        listPriceCents: moduleRow.bundlePriceCents,
        ownedLessonIds: owned,
        sources: input.sources,
      }),
    );
  }

  if (courseLines[0]) {
    const course = input.courses.find((item) => item.id === courseLines[0]?.id);
    if (!course || !forSale(course.status, course.commerceStatus, course.bundlePriceCents)) {
      return { ok: false, message: "Este curso não está à venda.", code: "not_for_sale" };
    }
    if (!compositionReady(course.paidLessonIds, input.lessons)) {
      return { ok: false, message: "Este curso ainda não está à venda.", code: "not_for_sale" };
    }
    items.push(
      lineItem({
        productType: "COURSE",
        productId: course.id,
        title: course.title,
        slug: course.slug,
        lessonIds: course.paidLessonIds,
        listPriceCents: course.bundlePriceCents,
        ownedLessonIds: owned,
        sources: input.sources,
      }),
    );
  }

  if (items.length === 0) return { ok: false, message: "O carrinho está vazio.", code: "empty" };

  const subtotalCents = items.reduce((sum, item) => sum + item.listPriceCents, 0);
  const creditCents = items.reduce((sum, item) => sum + item.creditAppliedCents, 0);
  const totalCents = items.reduce((sum, item) => sum + item.finalPriceCents, 0);
  const targetLessons = items.flatMap((item) => item.lessonIds);
  if (targetLessons.length > 0 && targetLessons.every((id) => owned.has(id))) {
    return { ok: false, message: "Você já tem este conteúdo.", code: "already_owned" };
  }
  const kind = totalCents === 0 ? "zero_upgrade" : "payment";
  const itemType =
    courseLines.length > 0 ? "COURSE" : moduleLines.length > 0 ? "MODULE" : "LESSON";
  return { ok: true, kind, items, subtotalCents, creditCents, totalCents, itemType, lines };
}

function compositionReady(lessonIds: string[], lessons: SaleLesson[]) {
  if (lessonIds.length === 0) return false;
  return lessonIds.every((id) => {
    const lesson = lessons.find((item) => item.id === id);
    return Boolean(lesson && lesson.accessType === "PAID" && forSale(lesson.status, lesson.commerceStatus, lesson.priceCents));
  });
}

function dedupe(lines: CartLine[]): CartLine[] {
  const seen = new Set<string>();
  const result: CartLine[] = [];
  for (const line of lines) {
    const key = `${line.type}:${line.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result;
}
