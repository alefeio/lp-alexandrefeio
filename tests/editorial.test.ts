import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { canIndexLesson, canReadLessonBody, lessonGateKind, visibleBlocks } from "../src/lib/learning/access";
import { parseBlockData, type LessonBlockData } from "../src/lib/learning/blocks";

import { inspectLessonDocument } from "../src/lib/editorial/document";
import { blockFromForm } from "../src/lib/editorial/form-blocks";
import { assessLesson, lessonSaleReady } from "../src/lib/editorial/readiness";
import { editorAllowed, previewBlocksFor } from "../src/lib/editorial/service";
import { uploadToApimg } from "../src/lib/storage/apimg";
import { EDITORIAL_IMAGE_LIMIT_BYTES, validateEditorialImage } from "../src/lib/storage/image-file";
import { needsSession } from "../src/proxy";

loadEnv({ path: ".env.local" });

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

test("gates editoriais, readiness e arquivo de imagem", async () => {
  assert.equal(editorAllowed("USER"), false);
  assert.equal(editorAllowed("ADMIN"), true);
  assert.equal(needsSession("/admin/aulas/aula/preview"), true);
  assert.equal(lessonGateKind({ accessType: "PAID", entitled: true, forSale: true, hasBody: false }), "owned-unavailable");
  assert.equal(lessonGateKind({ accessType: "PAID", entitled: false, forSale: true, hasBody: false }), "buy");
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }, { entitled: true }), true);
  assert.deepEqual(visibleBlocks({ status: "PUBLISHED", accessType: "PAID" }, ["corpo"]), []);
  assert.deepEqual(previewBlocksFor("ADMIN", ["corpo"]), ["corpo"]);
  assert.deepEqual(previewBlocksFor("USER", ["corpo"]), []);
  assert.equal(canIndexLesson({ status: "DRAFT", accessType: "FREE", publicPreview: "texto" }, true), false);

  const thin = assessLesson(
    { title: "Aula", summary: "Resumo", publicPreview: null, estimatedMinutes: 0, accessType: "PAID", status: "DRAFT", priceCents: null, commerceStatus: "NOT_FOR_SALE" },
    [],
  );
  assert.equal(thin.ready, false);
  assert.ok(thin.issues.some((issue) => issue.includes("conclusão")));
  const readyLesson = readyMeta("PAID");
  const ready = assessLesson(readyLesson, readyBlocks());
  assert.equal(ready.ready, true);
  const sale = lessonSaleReady({ ...readyLesson, status: "DRAFT" }, ready);
  assert.equal(sale.ready, false);

  assert.equal(parseBlockData({ type: "TEXT" }), null);
  const form = new FormData();
  form.set("type", "TEXT");
  form.set("blockKey", "texto");
  assert.equal(blockFromForm(form).ok, false);
  assert.equal(inspectLessonDocument({ schemaVersion: 1, lessonId: "outra", blocks: [] }, "aula", []).ok, false);

  const svg = validateEditorialImage(new TextEncoder().encode("<svg></svg>"), "image/svg+xml", 12);
  assert.equal(svg.ok, false);
  const huge = validateEditorialImage(png, "image/png", EDITORIAL_IMAGE_LIMIT_BYTES + 1);
  assert.equal(huge.ok, false);
  const image = validateEditorialImage(png, "image/png", png.byteLength);
  assert.equal(image.ok, true);

  let called = false;
  const uploaded = await uploadToApimg(png, "png", { APIMG_API_KEY: "secret-key", APIMG_UPLOAD_URL: "https://images.example/upload" }, async (url, init) => {
    called = true;
    assert.equal(url, "https://images.example/upload");
    assert.equal((init.headers as Record<string, string>)["X-API-Key"], "secret-key");
    return new Response(JSON.stringify({ url: "https://cdn.example/i/abc", public_id: "abc", width: 1, height: 1, format: "png", bytes: 70 }), { status: 201 });
  });
  assert.equal(called, true);
  assert.equal(uploaded.ok && uploaded.asset.publicId, "abc");
  assert.equal(uploaded.ok && uploaded.asset.width, 1);

  const tree = readFileSync("src/components/editorial/BlockComposer.tsx", "utf8") + readFileSync("src/app/(admin)/admin/aulas/[id]/page.tsx", "utf8");
  assert.equal(tree.includes("APIMG_API_KEY"), false);
  const seed = readFileSync("scripts/seed-learning.ts", "utf8");
  const catalog = readFileSync("src/lib/learning/catalog-deploy.ts", "utf8");
  const commerce = readFileSync("src/lib/learning/catalog-commerce.ts", "utf8");
  assert.match(seed, /assertMigrationTargetAllowed/);
  assert.match(seed, /preserveCommerceStatus: true/);
  assert.match(seed, /CATALOG_DEPLOY_CONFIRM=shared|sharedCatalogWriteAllowed/);
  assert.match(readFileSync("scripts/catalog-deploy.ts", "utf8"), /preserveCommerceStatus: true/);
  assert.match(commerce, /return "NOT_FOR_SALE"/);
  assert.match(catalog, /commercePatch\(keepSale\)/);
  assert.equal(/\.(lessonProgress|lessonResponse|project|diagnostic|order|payment|entitlement)\b/.test(catalog), false);
});

function readyMeta(accessType: "FREE" | "PAID") {
  return {
    title: "Aula pronta",
    summary: "Resumo suficiente.",
    publicPreview: "Um preview público.",
    estimatedMinutes: 8,
    accessType,
    status: "PUBLISHED" as const,
    priceCents: accessType === "PAID" ? 1000 : null,
    commerceStatus: "NOT_FOR_SALE" as const,
  };
}

function readyBlocks() {
  return sampleBlocks().map((block, index) => ({ blockKey: block.blockKey, retiredAt: null, payload: block.data, position: index }));
}

function sampleBlocks(): { blockKey: string; data: LessonBlockData }[] {
  return [
    { blockKey: "texto", data: text("Um parágrafo real da aula.") },
    { blockKey: "secao", data: { type: "HEADING", text: "Seção", level: 2 } },
    { blockKey: "aviso", data: { type: "CALLOUT", body: "Um aviso útil.", tone: "tip" } },
    { blockKey: "exemplo", data: { type: "EXAMPLE", body: "Um exemplo concreto." } },
    { blockKey: "check", data: { type: "CHECKPOINT", question: "Qual caminho?", options: [{ id: "a", label: "Caminho A" }, { id: "b", label: "Caminho B" }], correctOptionId: "a", explanation: "Porque o destino existe." } },
    { blockKey: "atividade", data: { type: "ACTIVITY", prompt: "Escreva o objetivo.", inputType: "short_text" } },
    { blockKey: "lista", data: { type: "CHECKLIST", items: [{ id: "item", label: "Revisar a oferta" }] } },
    { blockKey: "resultado", data: { type: "RESULT", title: "Entrega", prompt: "Registre a decisão.", fields: [{ key: "decisao", label: "Decisão" }] } },
    { blockKey: "fim", data: { type: "CONCLUSION", body: "A aula termina com uma decisão." } },
    { blockKey: "figura", data: { type: "IMAGE", url: "https://cdn.example/i/figura.png", alt: "Diagrama da oferta", publicId: "figura" } },
  ];
}

function text(body: string): LessonBlockData {
  return { type: "TEXT", body };
}
