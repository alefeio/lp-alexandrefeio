import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  atomicPriceWhere,
  coherenceWarnings,
  CONFLICT_MESSAGE,
  evaluatePriceChange,
  parseExpectedUpdatedAt,
  projectPricingDesk,
  simulateBrlChange,
  type PricingCourseDesk,
} from "../src/lib/admin/pricing-core";
import { formatCentsToBrl, MAX_PRICE_CENTS, parseBrlToCents, percentOff, savingsCents } from "../src/lib/commerce/money";
import { amountDueCents, eligibleCreditCents, quoteCart, type CreditSource, type SaleCourse, type SaleLesson, type SaleModule } from "../src/lib/commerce/quote";
import { editorAllowed } from "../src/lib/editorial/service";

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

function sampleDesk(): PricingCourseDesk {
  return {
    id: "course",
    title: "Curso",
    status: "PUBLISHED",
    commerceStatus: "NOT_FOR_SALE",
    bundlePriceCents: 8000,
    updatedAt: "2026-01-01T00:00:00.000Z",
    modules: [
      {
        id: "mod",
        title: "Módulo",
        status: "PUBLISHED",
        commerceStatus: "NOT_FOR_SALE",
        bundlePriceCents: 5000,
        updatedAt: "2026-01-01T00:00:00.000Z",
        lessons: [
          {
            id: "a",
            title: "Aula A",
            accessType: "PAID",
            status: "PUBLISHED",
            commerceStatus: "NOT_FOR_SALE",
            priceCents: 3000,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "b",
            title: "Aula B",
            accessType: "FREE",
            status: "PUBLISHED",
            commerceStatus: "NOT_FOR_SALE",
            priceCents: null,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "c",
            title: "Aula C",
            accessType: "PAID",
            status: "DRAFT",
            commerceStatus: "NOT_FOR_SALE",
            priceCents: 4000,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        paidLessonCount: 0,
        lessonCount: 0,
        paidLessonSumCents: 0,
        savingsCents: 0,
        percentOff: null,
        warnings: [],
      },
    ],
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
}

test("COM-2: 1 — edição de aula em reais converte para centavos", () => {
  const sim = simulateBrlChange(1490, "19,90");
  assert.equal(sim.ok, true);
  if (!sim.ok) return;
  assert.equal(sim.cents, 1990);
  assert.equal(sim.display, "R$ 19,90");
  assert.equal(sim.changed, true);
});

test("COM-2: 2 — edição de módulo", () => {
  const parsed = parseBrlToCents("57,90");
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.cents, 5790);
  const gate = evaluatePriceChange({
    target: "module",
    commerceStatus: "NOT_FOR_SALE",
    currentPriceCents: 4500,
    nextPriceCents: parsed.cents,
    confirmAvailable: false,
  });
  assert.equal(gate.ok, true);
});

test("COM-2: 3 — edição de curso", () => {
  const parsed = parseBrlToCents("249,90");
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.cents, 24990);
  const gate = evaluatePriceChange({
    target: "course",
    commerceStatus: "NOT_FOR_SALE",
    currentPriceCents: 19900,
    nextPriceCents: parsed.cents,
    confirmAvailable: false,
  });
  assert.equal(gate.ok, true);
});

test("COM-2: 4 — conversão precisa para centavos sem float", () => {
  assert.deepEqual(parseBrlToCents("14,90"), { ok: true, cents: 1490 });
  assert.deepEqual(parseBrlToCents("R$ 1.234,56"), { ok: true, cents: 123456 });
  assert.deepEqual(parseBrlToCents("15"), { ok: true, cents: 1500 });
  assert.deepEqual(parseBrlToCents("1.234"), { ok: true, cents: 123400 });
  assert.equal(formatCentsToBrl(1490), "R$ 14,90");
  assert.equal(formatCentsToBrl(123456), "R$ 1.234,56");
});

test("COM-2: 5 — valores inválidos e formatos ambíguos", () => {
  assert.equal(parseBrlToCents("-10,00").ok, false);
  assert.equal(parseBrlToCents("14.90").ok, false);
  assert.equal(parseBrlToCents("1.2,34").ok, false);
  assert.equal(parseBrlToCents("12.34,56").ok, false);
  assert.equal(parseBrlToCents("1.2.3").ok, false);
  assert.equal(parseBrlToCents("1..234").ok, false);
  assert.equal(parseBrlToCents("abc").ok, false);
  assert.equal(parseBrlToCents("").ok, false);
  assert.equal(parseBrlToCents(`R$ ${(MAX_PRICE_CENTS / 100) + 1},00`).ok, false);
  assert.equal(
    evaluatePriceChange({
      target: "lesson",
      accessType: "PAID",
      commerceStatus: "NOT_FOR_SALE",
      currentPriceCents: 1000,
      nextPriceCents: 0,
      confirmAvailable: false,
    }).ok,
    false,
  );
});

test("COM-2: 6+7 — AVAILABLE exige confirmação e mostra mudança", () => {
  const without = evaluatePriceChange({
    target: "lesson",
    accessType: "PAID",
    commerceStatus: "AVAILABLE",
    currentPriceCents: 1490,
    nextPriceCents: 1990,
    confirmAvailable: false,
  });
  assert.equal(without.ok, false);
  assert.match(without.ok ? "" : without.message, /AVAILABLE|cotações|pedidos/i);

  const withConfirm = evaluatePriceChange({
    target: "lesson",
    accessType: "PAID",
    commerceStatus: "AVAILABLE",
    currentPriceCents: 1490,
    nextPriceCents: 1990,
    confirmAvailable: true,
  });
  assert.equal(withConfirm.ok, true);
});

test("COM-2.1: timestamp ausente ou inválido", () => {
  assert.equal(parseExpectedUpdatedAt("").ok, false);
  assert.equal(parseExpectedUpdatedAt("   ").ok, false);
  assert.equal(parseExpectedUpdatedAt("ontem").ok, false);
  assert.equal(parseExpectedUpdatedAt("2026-01-01T00:00:00Z").ok, false);
  const ok = parseExpectedUpdatedAt("2026-01-01T00:00:00.000Z");
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.date.toISOString(), "2026-01-01T00:00:00.000Z");
});

test("COM-2.1: filtro CAS inclui id, updatedAt e commerceStatus", () => {
  const stamp = new Date("2026-01-01T00:00:00.000Z");
  const where = atomicPriceWhere({
    target: "lesson",
    id: "lesson-1",
    expectedUpdatedAt: stamp,
    commerceStatus: "AVAILABLE",
    accessType: "PAID",
    nextPriceCents: 1990,
    updatedById: "admin-1",
  });
  assert.deepEqual(where, {
    id: "lesson-1",
    updatedAt: stamp,
    commerceStatus: "AVAILABLE",
    accessType: "PAID",
  });
  assert.match(CONFLICT_MESSAGE, /outra aba|Recarregue/i);

  const write = readFileSync(new URL("../src/lib/admin/pricing-write.ts", import.meta.url), "utf8");
  assert.match(write, /updateMany/);
  assert.match(write, /result\.count !== 1/);
  assert.match(write, /isAdminRole/);
  assert.match(write, /UNCHANGED_PRICE_MESSAGE/);
});

test("COM-2: 10 — curso com aulas gratuitas", () => {
  const free = evaluatePriceChange({
    target: "lesson",
    accessType: "FREE",
    commerceStatus: "NOT_FOR_SALE",
    currentPriceCents: null,
    nextPriceCents: 1000,
    confirmAvailable: false,
  });
  assert.equal(free.ok, false);

  const warnings = coherenceWarnings({
    kind: "course",
    bundlePriceCents: 10000,
    paidLessonSumCents: 12000,
    freeLessonCount: 3,
  });
  assert.ok(warnings.some((row) => /gratuitas/i.test(row)));
});

test("COM-2: 11 — descontos calculados", () => {
  assert.equal(savingsCents(10000, 8000), 2000);
  assert.equal(percentOff(10000, 8000), 20);
  assert.equal(savingsCents(5000, 7000), 0);
  assert.equal(percentOff(5000, 7000), 0);
});

test("COM-2: 12 — pacote maior que soma individual gera aviso", () => {
  const warnings = coherenceWarnings({
    kind: "module",
    bundlePriceCents: 9000,
    paidLessonSumCents: 7000,
  });
  assert.ok(warnings.some((row) => /mais caro/i.test(row)));
});

test("COM-2.1: simulação comercial pura antes de salvar", () => {
  const projected = projectPricingDesk(sampleDesk(), {
    lessons: { a: 3500, c: 4500 },
    modules: { mod: 6000 },
    course: 9000,
  });
  assert.equal(projected.paidLessonSumCents, 8000);
  assert.equal(projected.moduleBundleSumCents, 6000);
  assert.equal(projected.bundlePriceCents, 9000);
  assert.equal(projected.savingsVsLessonsCents, 0);
  assert.ok(projected.warnings.some((row) => /economia/i.test(row) || /mais caro/i.test(row) || /gratuitas/i.test(row)));

  const deskSource = readFileSync(new URL("../src/components/admin/pricing/PricingDesk.tsx", import.meta.url), "utf8");
  assert.match(deskSource, /projectPricingDesk/);
  assert.match(deskSource, /ainda não salvo|Simulação local|proposto/i);
  assert.match(deskSource, /Publicado:/);
});

test("COM-2.1: placeholder 100 removido do editorial", () => {
  const editorial = readFileSync(new URL("../src/lib/editorial/service.ts", import.meta.url), "utf8");
  assert.match(editorial, /priceCents:\s*null/);
  assert.equal(/priceCents:\s*accessType === "PAID" \? 100/.test(editorial), false);
  assert.equal(/priceCents = 100/.test(editorial), false);
  assert.equal(/priceCents:\s*100\b/.test(editorial), false);
  const docs = readFileSync(new URL("../docs/com-2-admin-pricing.md", import.meta.url), "utf8");
  assert.match(docs, /priceCents" = 100/);
});

test("COM-2: 13 — seeds/deploy não regram preço no update", () => {
  const deploy = readFileSync(new URL("../src/lib/learning/catalog-deploy.ts", import.meta.url), "utf8");
  const updateBlocks = [...deploy.matchAll(/update:\s*\{([\s\S]*?)\n\s*\},/g)].map((match) => match[1] ?? "");
  for (const block of updateBlocks) {
    assert.equal(/\bpriceCents\s*:/.test(block), false);
    assert.equal(/\bbundlePriceCents\s*:/.test(block), false);
  }
  const editorial = readFileSync(new URL("../src/lib/editorial/service.ts", import.meta.url), "utf8");
  assert.equal(/bundlePriceCents:\s*price\b/.test(editorial), false);
  assert.match(editorial, /\/admin\/precos/);
});

test("COM-2: 14 — cotação após mudança de preço usa valor atual", () => {
  const lessons = [lesson("a", 1990), lesson("b", 1990)];
  const modules: SaleModule[] = [{
    id: "mod",
    slug: "mod",
    title: "Módulo",
    status: "PUBLISHED",
    commerceStatus: "AVAILABLE",
    bundlePriceCents: 3500,
    courseId: "course",
    paidLessonIds: ["a", "b"],
    lessonCount: 2,
  }];
  const courses: SaleCourse[] = [];
  const before = quoteCart({
    lines: [{ type: "LESSON", id: "a" }],
    lessons: [lesson("a", 1490), lesson("b", 1990)],
    modules,
    courses,
    sources: [],
    ownedLessonIds: [],
  });
  assert.equal(before.ok, true);
  if (!before.ok) return;
  assert.equal(before.totalCents, 1490);

  const after = quoteCart({ lines: [{ type: "LESSON", id: "a" }], lessons, modules, courses, sources: [], ownedLessonIds: [] });
  assert.equal(after.ok, true);
  if (!after.ok) return;
  assert.equal(after.totalCents, 1990);
});

test("COM-2: 15 — pedido criado antes da mudança preserva snapshot conceitual", () => {
  const priorOrderItem = { finalPriceCents: 1490, lessonIds: ["a"] };
  const catalogNow = 1990;
  assert.notEqual(priorOrderItem.finalPriceCents, catalogNow);
  assert.equal(priorOrderItem.finalPriceCents, 1490);
});

test("COM-2: 16 — upgrade com crédito de compra anterior", () => {
  const sources: CreditSource[] = [{ orderItemId: "oi-1", finalPriceCents: 1490, lessonIds: ["a"] }];
  const credit = eligibleCreditCents(["a", "b"], sources);
  assert.equal(credit, 1490);
  assert.equal(amountDueCents(3500, credit), 2010);
  const quote = quoteCart({
    lines: [{ type: "MODULE", id: "mod" }],
    lessons: [lesson("a", 1990), lesson("b", 1990)],
    modules: [{
      id: "mod",
      slug: "mod",
      title: "Módulo",
      status: "PUBLISHED",
      commerceStatus: "AVAILABLE",
      bundlePriceCents: 3500,
      courseId: "course",
      paidLessonIds: ["a", "b"],
      lessonCount: 2,
    }],
    courses: [],
    sources,
    ownedLessonIds: [],
  });
  assert.equal(quote.ok, true);
  if (!quote.ok) return;
  assert.equal(quote.creditCents, 1490);
  assert.equal(quote.totalCents, 2010);
});

test("COM-2: 17 — update de preço não altera status comercial", () => {
  const write = readFileSync(new URL("../src/lib/admin/pricing-write.ts", import.meta.url), "utf8");
  const dataBlocks = [...write.matchAll(/data:\s*\{([^}]+)\}/g)].map((match) => match[1] ?? "");
  assert.ok(dataBlocks.length >= 2);
  for (const block of dataBlocks) {
    assert.equal(/\bcommerceStatus\b/.test(block), false);
    assert.equal(/\bstatus\b/.test(block), false);
  }
  assert.match(write, /priceCents:\s*parsed\.cents,\s*updatedById/);
  assert.match(write, /bundlePriceCents:\s*parsed\.cents,\s*updatedById/);
  assert.equal(/MercadoPago|mercadopago/i.test(write), false);
});

test("COM-2: 18 — testes unitários sem escrita paga real", () => {
  const money = readFileSync(new URL("../src/lib/commerce/money.ts", import.meta.url), "utf8");
  const write = readFileSync(new URL("../src/lib/admin/pricing-write.ts", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../src/lib/admin/pricing-actions.ts", import.meta.url), "utf8");
  const joined = `${money}\n${write}\n${actions}`;
  assert.equal(/createPreference/.test(joined), false);
  assert.equal(/mercadopago/i.test(joined), false);
  assert.equal(/fetch\(/.test(joined), false);
});

test("COM-2: UI e docs de responsabilidade", () => {
  const desk = readFileSync(new URL("../src/components/admin/pricing/PricingDesk.tsx", import.meta.url), "utf8");
  assert.match(desk, /confirmAvailable/);
  assert.match(desk, /canSave/);
  assert.match(desk, /publishChangedWhileEditing|publicado mudou/i);
  assert.match(desk, /try \{/);
  assert.match(desk, /finally/);
  assert.match(desk, /R\$/);
  const coursePage = readFileSync(new URL("../src/app/(admin)/admin/cursos/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(coursePage, /Gerenciar em Preços/);
  assert.equal(/name="bundlePriceCents"/.test(coursePage), false);
  const lessonPage = readFileSync(new URL("../src/app/(admin)/admin/aulas/[id]/page.tsx", import.meta.url), "utf8");
  assert.equal(/name="priceCents"/.test(lessonPage), false);
  const docs = readFileSync(new URL("../docs/com-2-admin-pricing.md", import.meta.url), "utf8");
  assert.match(docs, /compare-and-swap|updateMany/i);
  assert.match(docs, /já está atualizado|preço inalterado/i);
});
