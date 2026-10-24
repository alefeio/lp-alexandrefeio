import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createLandingPageProject } from "../src/lib/landing-page/service";
import { createMemoryLandingPageStore } from "../src/lib/landing-page/memory-store";
import { inspectLandingPageImage } from "../src/lib/landing-page/media/bytes";
import {
  APIMG_PHYSICAL_DELETE_SUPPORTED,
  assertApimgPublicUrl,
  createApimgLandingPageMediaStorage,
  LANDING_PAGE_MEDIA_STORAGE_PROVIDER,
  parseApimgUploadResponse,
  readApimgLandingMediaConfig,
} from "../src/lib/landing-page/media/apimg-storage";
import { cleanupLandingPageMediaOrphans } from "../src/lib/landing-page/media/orphan-cleanup";
import { createMemoryLandingPageMediaStore } from "../src/lib/landing-page/media/memory-store";
import type { LandingPageMediaRecord } from "../src/lib/landing-page/media/record";
import { resetLandingPageMediaRateLimit } from "../src/lib/landing-page/media/rate-limit";
import { beginLandingPageMediaUpload, completeLandingPageMediaUpload, deleteLandingPageMedia } from "../src/lib/landing-page/media/service";
import { evaluateLandingPageProductionReadinessConfig } from "../src/lib/landing-page/publication/release-readiness";
import { landingPagePublicRuntimeEnabled } from "../src/lib/landing-page/publication/gate";
import { LANDING_PAGE_MEDIA_LIMITS } from "../src/lib/landing-page/media/limits";

const env = {
  APIMG_UPLOAD_URL: "https://apimg.com.br/v1/upload",
  APIMG_API_KEY: "apimg-secret-not-for-logs",
  APIMG_UPLOAD_FOLDER: "alexandre-feio/uploads",
  APIMG_SITE_UPLOAD_FOLDER: "alexandre-feio/site",
};
const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0x00, 0x00, 0x00, 0x00,
]);

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("adapter APIMG envia file, autentica e valida a resposta", async () => {
  const seen = { method: "", key: null as string | null, field: "", type: "" };
  const storage = createApimgLandingPageMediaStorage({
    env,
    fetch: async (input, init) => {
      const form = init?.body as FormData;
      const file = form.get("file");
      const headers = new Headers(init?.headers);
      seen.method = init?.method ?? "";
      seen.key = headers.get("X-API-Key");
      seen.field = file instanceof Blob ? "file" : "";
      seen.type = file instanceof Blob ? file.type : "";
      assert.deepEqual([...form.keys()], ["file"]);
      assert.deepEqual([...headers.keys()], ["x-api-key"]);
      assert.equal(form.get("folder"), null);
      assert.equal(String(input), env.APIMG_UPLOAD_URL);
      return response({ url: "https://apimg.com.br/igh/image.png", public_id: "igh/image", format: "png", bytes: png.byteLength });
    },
  });
  const stored = await storage.put("landing-media/local", png, "image/png");
  assert.equal(stored.url, "https://apimg.com.br/igh/image.png");
  assert.equal(stored.storageKey, "igh/image");
  assert.equal(seen.method, "POST");
  assert.equal(seen.key, env.APIMG_API_KEY);
  assert.equal(seen.field, "file");
  assert.equal(seen.type, "image/png");
  const config = readApimgLandingMediaConfig(env);
  assert.equal(config?.uploadFolder, "alexandre-feio/uploads");
  assert.equal(config?.siteUploadFolder, "alexandre-feio/site");
  assert.equal(config?.landingMediaFolder, "alexandre-feio/site/landing-pages");
  assert.equal(readApimgLandingMediaConfig({ APIMG_UPLOAD_URL: env.APIMG_UPLOAD_URL, APIMG_API_KEY: env.APIMG_API_KEY }), null);
  assert.equal(APIMG_PHYSICAL_DELETE_SUPPORTED, false);
  assert.equal(LANDING_PAGE_MEDIA_STORAGE_PROVIDER, "APIMG");
  await assert.rejects(() => storage.delete("igh/image"), /not supported/);
});

test("resposta APIMG incompleta, insegura ou com erro não vira mídia", async () => {
  assert.throws(() => parseApimgUploadResponse({ public_id: "only-id" }));
  assert.throws(() => parseApimgUploadResponse({ url: "http://apimg.com.br/a.png", public_id: "a" }));
  assert.throws(() => parseApimgUploadResponse({ url: "https://evil.example/a.png", public_id: "a" }));
  assert.throws(() => parseApimgUploadResponse({ url: "javascript:alert(1)", public_id: "a" }));
  assert.throws(() => parseApimgUploadResponse({ url: "https://apimg.com.br/a.png", public_id: "a" }));
  assert.throws(() => parseApimgUploadResponse({ detail: [{ msg: "invalid" }] }));
  assert.equal(assertApimgPublicUrl("https://cdn.apimg.com.br/a.png"), "https://cdn.apimg.com.br/a.png");
  const cases = [response({ url: "https://apimg.com.br/a.png" }, 422), response({ message: "no" }, 500), response({ url: "https://apimg.com.br/a.png" }, 200)];
  for (const item of cases) {
    const storage = createApimgLandingPageMediaStorage({
      env,
      fetch: async () => item,
    });
    await assert.rejects(() => storage.put("local", png, "image/png"), (error: unknown) => {
      assert.equal(String(error).includes(env.APIMG_API_KEY), false);
      return true;
    });
  }
});

test("timeout não repete o upload e a credencial não aparece no erro", async () => {
  const source = readFileSync("src/lib/landing-page/media/apimg-storage.ts", "utf8");
  assert.equal(source.includes("console."), false);
  assert.equal(source.includes("retry"), false);
  const storage = createApimgLandingPageMediaStorage({
    env,
    timeoutMs: 20,
    fetch: (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      }),
  });
  await assert.rejects(() => storage.put("local", png, "image/png"), (error: unknown) => {
    assert.equal(String(error).includes(env.APIMG_API_KEY), false);
    return true;
  });
});

test("upload real do serviço fica READY só com resposta válida", async () => {
  const projects = createMemoryLandingPageStore({ courseIdBySlug: { "sites-que-convertem": "course-sites" } });
  const media = createMemoryLandingPageMediaStore();
  const created = await createLandingPageProject(projects, { userId: "owner", title: "Oficina", slug: "oficina-apimg" });
  if (!created.ok) throw new Error(created.code);
  resetLandingPageMediaRateLimit();
  const started = await beginLandingPageMediaUpload(projects, media, {
    userId: "owner",
    landingPageProjectId: created.value.id,
    type: "GENERAL_IMAGE",
    mimeType: "image/png",
    fileSize: png.byteLength,
  });
  if (!started.ok) throw new Error(started.code);
  const storage = createApimgLandingPageMediaStorage({
    env,
    fetch: async () => response({ url: "https://apimg.com.br/igh/sintetico.png", public_id: "igh/sintetico", format: "png", bytes: png.byteLength }),
  });
  const saved = await completeLandingPageMediaUpload(projects, media, storage, { userId: "owner", mediaId: started.value.id, bytes: png });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.value.status, "READY");
  assert.equal(saved.value.publicUrl, "https://apimg.com.br/igh/sintetico.png");
  assert.equal(saved.value.storageKey, "igh/sintetico");
  const foreign = await completeLandingPageMediaUpload(projects, media, storage, { userId: "outro", mediaId: started.value.id, bytes: png });
  assert.equal(foreign.ok, false);
  const broken = createApimgLandingPageMediaStorage({ env, fetch: async () => response({ message: "down" }, 502) });
  const again = await beginLandingPageMediaUpload(projects, media, {
    userId: "owner",
    landingPageProjectId: created.value.id,
    type: "GENERAL_IMAGE",
    mimeType: "image/png",
    fileSize: png.byteLength,
  });
  if (!again.ok) throw new Error(again.code);
  const failed = await completeLandingPageMediaUpload(projects, media, broken, { userId: "owner", mediaId: again.value.id, bytes: png });
  assert.equal(failed.ok, false);
  assert.equal((await media.findById(again.value.id))?.status, "FAILED");
  assert.equal((await media.findById(again.value.id))?.publicUrl, null);
});

test("EXIF, SVG, tamanho e limitador continuam na frente da APIMG", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x58, 0x49, 0x46, 0x00, 0x00, 0xff, 0xd9]);
  const inspected = inspectLandingPageImage(jpeg, "image/jpeg");
  assert.ok(inspected);
  assert.equal(Buffer.from(inspected.bytes).includes(Buffer.from("EXIF")), false);
  assert.equal(inspectLandingPageImage(Uint8Array.from([0x3c, 0x73, 0x76, 0x67]), "image/svg+xml"), null);
  assert.equal(LANDING_PAGE_MEDIA_LIMITS.maxLogoBytes, 5 * 1024 * 1024);
  assert.equal(LANDING_PAGE_MEDIA_LIMITS.maxImageBytes, 10 * 1024 * 1024);
  const tool = readFileSync("src/components/learning/LandingPageTrustTool.tsx", "utf8");
  assert.equal(tool.includes("uploadPresigned"), false);
  assert.equal(tool.includes("X-API-Key"), false);
  assert.equal(tool.includes("APIMG_API_KEY"), false);
});

test("exclusão física não marca a mídia como removida e publicação histórica protege", async () => {
  const projects = createMemoryLandingPageStore({ courseIdBySlug: { "sites-que-convertem": "course-sites" } });
  const media = createMemoryLandingPageMediaStore();
  const created = await createLandingPageProject(projects, { userId: "owner", title: "Oficina", slug: "oficina-delete" });
  if (!created.ok) throw new Error(created.code);
  const row: LandingPageMediaRecord = {
    id: "mid",
    landingPageProjectId: created.value.id,
    userId: "owner",
    type: "GENERAL_IMAGE",
    status: "READY",
    storageKey: "igh/sintetico",
    publicUrl: "https://apimg.com.br/igh/sintetico.png",
    mimeType: "image/png",
    fileSize: 32,
    width: 1,
    height: 1,
    altText: "Sintética",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
  };
  await media.insert(row);
  const storage = createApimgLandingPageMediaStorage({ env, fetch: async () => response({}) });
  const removed = await deleteLandingPageMedia(projects, media, storage, { userId: "owner", mediaId: "mid" });
  assert.equal(removed.ok, false);
  assert.equal((await media.findById("mid"))?.status, "READY");
  const cleanup = await cleanupLandingPageMediaOrphans({
    records: [row],
    drafts: [],
    publicationReferencesMedia: () => false,
    dryRun: false,
    storage,
    save: async (record) => {
      record.status = "DELETED";
    },
  });
  assert.equal(cleanup.failed, 1);
  assert.equal(cleanup.deleted, 0);
  assert.equal(row.status, "READY");
  const historical = await cleanupLandingPageMediaOrphans({
    records: [row],
    drafts: [],
    publicationReferencesMedia: () => true,
    dryRun: false,
    storage,
  });
  assert.equal(historical.eligible, 0);
});

test("configuração de release exige APIMG e não exige Blob", () => {
  const missing = evaluateLandingPageProductionReadinessConfig({});
  assert.equal(missing.checks.find((item) => item.id === "MEDIA_STORAGE_CONFIG")?.status, "BLOCKED");
  const blobOnly = evaluateLandingPageProductionReadinessConfig({ BLOB_READ_WRITE_TOKEN: "blob-secret" } as never);
  assert.equal(blobOnly.checks.find((item) => item.id === "MEDIA_STORAGE_CONFIG")?.status, "BLOCKED");
  assert.equal(JSON.stringify(blobOnly).includes("blob-secret"), false);
  const ready = evaluateLandingPageProductionReadinessConfig({
    APIMG_UPLOAD_URL: "https://apimg.com.br/v1/upload",
    APIMG_API_KEY: "apimg-secret-not-for-logs",
    APIMG_UPLOAD_FOLDER: "alexandre-feio/uploads",
    APIMG_SITE_UPLOAD_FOLDER: "alexandre-feio/site",
    LANDING_PAGE_RATE_LIMIT_SECRET: "x".repeat(32),
  });
  assert.equal(ready.checks.find((item) => item.id === "MEDIA_STORAGE_CONFIG")?.status, "PASS");
  assert.equal(JSON.stringify(ready).includes("apimg-secret-not-for-logs"), false);
  assert.equal(readApimgLandingMediaConfig({ APIMG_UPLOAD_URL: "http://apimg.com.br/v1/upload", APIMG_API_KEY: "x" }), null);
  assert.equal(landingPagePublicRuntimeEnabled({}), false);
});
