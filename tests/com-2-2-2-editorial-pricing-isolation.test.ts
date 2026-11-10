import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildLessonSaveData,
  lessonEditorialPriceData,
  LESSON_SAVE_CONFLICT,
  parseLessonSaveUpdatedAt,
} from "../src/lib/editorial/lesson-save";

const stamp = new Date("2026-01-01T00:00:00.000Z");

type LessonRow = {
  id: string;
  accessType: "FREE" | "PAID";
  status: "DRAFT" | "PUBLISHED";
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  priceCents: number | null;
  updatedAt: Date;
  publishedAt: Date | null;
  sortOrder: number;
  estimatedMinutes: number | null;
  title: string;
  summary: string;
  publicPreview: string | null;
  updatedById: string | null;
  writeCount: number;
};

function createLessonStore(seed: LessonRow) {
  let row: LessonRow = { ...seed };
  return {
    snapshot: () => ({ ...row }),
    findUnique: async ({ where }: { where: { id: string } }) => (row.id === where.id ? { ...row } : null),
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; updatedAt: Date };
      data: Record<string, unknown>;
    }) => {
      if (row.id !== where.id || row.updatedAt.getTime() !== where.updatedAt.getTime()) {
        return { count: 0 };
      }
      row = {
        ...row,
        ...data,
        updatedAt: new Date(row.updatedAt.getTime() + 1000),
        writeCount: row.writeCount + 1,
      } as LessonRow;
      return { count: 1 };
    },
    /** Simula update comercial concurrente (preço + updatedAt). */
    applyCommercialPrice: (priceCents: number) => {
      row = {
        ...row,
        priceCents,
        updatedAt: new Date(row.updatedAt.getTime() + 1000),
        updatedById: "pricing-admin",
        writeCount: row.writeCount + 1,
      };
    },
  };
}

async function editorialSave(
  store: ReturnType<typeof createLessonStore>,
  input: {
    accessType: "FREE" | "PAID";
    status: "DRAFT" | "PUBLISHED";
    updatedAt: string;
    title?: string;
  },
) {
  const expected = parseLessonSaveUpdatedAt(input.updatedAt);
  if (!expected.ok) return expected;
  const current = await store.findUnique({ where: { id: "lesson-1" } });
  if (!current) return { ok: false as const, message: "Aula não encontrada." };
  if (current.commerceStatus === "AVAILABLE" && (input.status !== "PUBLISHED" || input.accessType !== "PAID")) {
    return { ok: false as const, message: "Retire a aula da venda antes de mudar publicação ou acesso." };
  }
  if (input.status === "PUBLISHED") {
    const priceForReadiness = input.accessType === "FREE" ? null : current.priceCents;
    if (input.accessType === "PAID" && (priceForReadiness == null || priceForReadiness <= 0)) {
      return { ok: false as const, message: "Informe um preço válido." };
    }
  }
  const data = buildLessonSaveData({
    title: input.title ?? current.title,
    summary: current.summary,
    publicPreview: current.publicPreview,
    estimatedMinutes: current.estimatedMinutes,
    sortOrder: current.sortOrder,
    accessType: input.accessType,
    status: input.status,
    publishedAt: current.publishedAt,
    updatedById: "editor-1",
  });
  const result = await store.updateMany({
    where: { id: current.id, updatedAt: expected.date },
    data,
  });
  if (result.count !== 1) return { ok: false as const, message: LESSON_SAVE_CONFLICT };
  return { ok: true as const, message: "Aula salva." };
}

test("COM-2.2.2: salvar aula PAID não envia priceCents no update", () => {
  const paid = buildLessonSaveData({
    title: "Aula",
    summary: "Resumo",
    publicPreview: null,
    estimatedMinutes: 8,
    sortOrder: 1,
    accessType: "PAID",
    status: "DRAFT",
    publishedAt: null,
    updatedById: "editor-1",
  });
  assert.equal("priceCents" in paid, false);
  assert.deepEqual(lessonEditorialPriceData("PAID"), {});

  const free = buildLessonSaveData({
    title: "Aula",
    summary: "Resumo",
    publicPreview: null,
    estimatedMinutes: 8,
    sortOrder: 1,
    accessType: "FREE",
    status: "DRAFT",
    publishedAt: null,
    updatedById: "editor-1",
  });
  assert.equal(free.priceCents, null);
});

test("COM-2.2.2: alteração comercial concorrente não é sobrescrita", async () => {
  const store = createLessonStore({
    id: "lesson-1",
    accessType: "PAID",
    status: "DRAFT",
    commerceStatus: "NOT_FOR_SALE",
    priceCents: 1490,
    updatedAt: stamp,
    publishedAt: null,
    sortOrder: 1,
    estimatedMinutes: 8,
    title: "Aula",
    summary: "Resumo suficiente.",
    publicPreview: "Preview",
    updatedById: "seed",
    writeCount: 0,
  });

  store.applyCommercialPrice(1990);
  const stale = await editorialSave(store, {
    accessType: "PAID",
    status: "DRAFT",
    updatedAt: stamp.toISOString(),
    title: "Aula editada",
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.ok ? "" : stale.message, LESSON_SAVE_CONFLICT);
  assert.equal(store.snapshot().priceCents, 1990);
  assert.equal(store.snapshot().title, "Aula");

  // Mesmo com stamp fresco, PAID não reescreve o preço comercial.
  const fresh = await editorialSave(store, {
    accessType: "PAID",
    status: "DRAFT",
    updatedAt: store.snapshot().updatedAt.toISOString(),
    title: "Aula editada",
  });
  assert.equal(fresh.ok, true);
  assert.equal(store.snapshot().title, "Aula editada");
  assert.equal(store.snapshot().priceCents, 1990);
});

test("COM-2.2.2: FREE limpa preço quando permitido", async () => {
  const store = createLessonStore({
    id: "lesson-1",
    accessType: "PAID",
    status: "DRAFT",
    commerceStatus: "NOT_FOR_SALE",
    priceCents: 1490,
    updatedAt: stamp,
    publishedAt: null,
    sortOrder: 1,
    estimatedMinutes: 8,
    title: "Aula",
    summary: "Resumo",
    publicPreview: null,
    updatedById: "seed",
    writeCount: 0,
  });
  const result = await editorialSave(store, {
    accessType: "FREE",
    status: "DRAFT",
    updatedAt: stamp.toISOString(),
  });
  assert.equal(result.ok, true);
  assert.equal(store.snapshot().priceCents, null);
  assert.equal(store.snapshot().accessType, "FREE");
});

test("COM-2.2.2: FREE em AVAILABLE continua bloqueado", async () => {
  const store = createLessonStore({
    id: "lesson-1",
    accessType: "PAID",
    status: "PUBLISHED",
    commerceStatus: "AVAILABLE",
    priceCents: 1490,
    updatedAt: stamp,
    publishedAt: stamp,
    sortOrder: 1,
    estimatedMinutes: 8,
    title: "Aula",
    summary: "Resumo",
    publicPreview: "Preview",
    updatedById: "seed",
    writeCount: 0,
  });
  const result = await editorialSave(store, {
    accessType: "FREE",
    status: "PUBLISHED",
    updatedAt: stamp.toISOString(),
  });
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.message, /Retire a aula da venda/);
  assert.equal(store.snapshot().priceCents, 1490);
  assert.equal(store.snapshot().writeCount, 0);
});

test("COM-2.2.2: timestamp desatualizado produz conflito sem escrita", async () => {
  const store = createLessonStore({
    id: "lesson-1",
    accessType: "PAID",
    status: "DRAFT",
    commerceStatus: "NOT_FOR_SALE",
    priceCents: 1490,
    updatedAt: stamp,
    publishedAt: null,
    sortOrder: 1,
    estimatedMinutes: 8,
    title: "Aula",
    summary: "Resumo",
    publicPreview: null,
    updatedById: "seed",
    writeCount: 0,
  });
  const result = await editorialSave(store, {
    accessType: "PAID",
    status: "DRAFT",
    updatedAt: "2025-01-01T00:00:00.000Z",
    title: "Novo título",
  });
  assert.equal(result.ok, false);
  assert.equal(result.ok ? "" : result.message, LESSON_SAVE_CONFLICT);
  assert.equal(store.snapshot().title, "Aula");
  assert.equal(store.snapshot().writeCount, 0);
});

test("COM-2.2.2: timestamp ausente ou inválido bloqueia", () => {
  assert.equal(parseLessonSaveUpdatedAt("").ok, false);
  assert.equal(parseLessonSaveUpdatedAt("   ").ok, false);
  assert.equal(parseLessonSaveUpdatedAt("ontem").ok, false);
  assert.equal(parseLessonSaveUpdatedAt("2026-01-01T00:00:00Z").ok, false);
});

test("COM-2.2.2: publicação PAID sem preço continua bloqueada", async () => {
  const store = createLessonStore({
    id: "lesson-1",
    accessType: "PAID",
    status: "DRAFT",
    commerceStatus: "NOT_FOR_SALE",
    priceCents: null,
    updatedAt: stamp,
    publishedAt: null,
    sortOrder: 1,
    estimatedMinutes: 8,
    title: "Aula pronta",
    summary: "Resumo suficiente.",
    publicPreview: "Preview público",
    updatedById: "seed",
    writeCount: 0,
  });
  const result = await editorialSave(store, {
    accessType: "PAID",
    status: "PUBLISHED",
    updatedAt: stamp.toISOString(),
  });
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.message, /preço/i);
  assert.equal(store.snapshot().status, "DRAFT");
  assert.equal(store.snapshot().writeCount, 0);
});

test("COM-2.2.2: serviço usa updateMany e omite priceCents em PAID", () => {
  const service = readFileSync(new URL("../src/lib/editorial/service.ts", import.meta.url), "utf8");
  assert.match(service, /updateMany/);
  assert.match(service, /buildLessonSaveData/);
  assert.match(service, /parseLessonSaveUpdatedAt/);
  assert.equal(/priceCents,\s*\n\s*status/.test(service), false);
  const helper = readFileSync(new URL("../src/lib/editorial/lesson-save.ts", import.meta.url), "utf8");
  assert.match(helper, /accessType === "FREE"/);
});
