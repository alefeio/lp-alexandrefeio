import assert from "node:assert/strict";
import { crc32 } from "node:zlib";
import { readFileSync } from "node:fs";
import test from "node:test";
import sharp from "sharp";
import { blogPersistFeedback } from "../src/lib/blog/editor-feedback";
import { storeEditorialImage } from "../src/lib/editorial/service";
import { uploadToApimg } from "../src/lib/storage/apimg";
import { EDITORIAL_IMAGE_LIMIT_BYTES, validateEditorialImage } from "../src/lib/storage/image-file";
import { prepareWebImageForUpload, WEB_IMAGE_PROFILES } from "../src/lib/storage/image-optimization";
import { imageOptimizationNote } from "../src/lib/storage/image-optimization-note";

const env = {
  APIMG_API_KEY: "server-secret",
  APIMG_UPLOAD_URL: "https://apimg.com.br/v1/upload",
};

test("os perfis guardam as metas iniciais sem serem um teto rígido de peso", () => {
  assert.deepEqual(WEB_IMAGE_PROFILES["blog-cover"], { maxWidth: 1200, targetBytes: 150 * 1024 });
  assert.deepEqual(WEB_IMAGE_PROFILES.editorial, { maxWidth: 1200, targetBytes: 200 * 1024 });
  assert.deepEqual(WEB_IMAGE_PROFILES["course-service"], { maxWidth: 1600, targetBytes: 250 * 1024 });
  assert.deepEqual(WEB_IMAGE_PROFILES.banner, { maxWidth: 1920, targetBytes: 350 * 1024 });
});

test("JPEG, PNG e WebP válidos preservam a proporção e não são ampliados", async () => {
  const jpeg = await raster("jpeg", 1800, 900);
  const png = await raster("png", 900, 1800);
  const webp = await raster("webp", 80, 40);

  const horizontal = await optimize(jpeg, "image/jpeg", "blog-cover");
  assert.equal(horizontal.report.width, 1200);
  assert.equal(horizontal.report.height, 600);
  assert.equal(horizontal.report.width / horizontal.report.height, 2);

  const vertical = await optimize(png, "image/png", "editorial");
  assert.equal(vertical.report.width, 900);
  assert.equal(vertical.report.height, 1800);
  assert.ok(vertical.report.width <= 900 && vertical.report.height <= 1800);

  const small = await optimize(webp, "image/webp", "banner");
  assert.equal(small.report.width, 80);
  assert.equal(small.report.height, 40);
  assert.ok(small.report.optimizedBytes <= Math.ceil(webp.byteLength * 1.1));
  assertConsistent(small.bytes, small.format);
});

test("PNG com transparência continua com canal alfa", async () => {
  const width = 96;
  const height = 48;
  const raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      raw[index] = 20;
      raw[index + 1] = 90;
      raw[index + 2] = 70;
      raw[index + 3] = x < width / 2 ? 0 : 255;
    }
  }
  const png = new Uint8Array(await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer());
  const optimized = await optimize(png, "image/png", "editorial");
  const meta = await sharp(optimized.bytes).metadata();
  assert.equal(meta.hasAlpha, true);
  assert.ok(optimized.format === "webp" || optimized.format === "png");
  assertConsistent(optimized.bytes, optimized.format);
});

test("a orientação EXIF é corrigida e a localização sai do arquivo", async () => {
  const marker = "gps-secret-do-not-keep";
  const source = new Uint8Array(await sharp({
    create: { width: 40, height: 20, channels: 3, background: "#224466" },
  }).jpeg().withMetadata({
    orientation: 6,
    exif: { IFD0: { ImageDescription: marker } },
  }).toBuffer());

  assert.equal(Buffer.from(source).includes(marker), true);
  const optimized = await optimize(source, "image/jpeg", "blog-cover");
  assert.equal(optimized.report.width, 20);
  assert.equal(optimized.report.height, 40);
  assert.equal(Buffer.from(optimized.bytes).includes(marker), false);
  assert.ok(optimized.report.width <= 40 && optimized.report.height <= 40);
});

test("imagem grande reduz peso e cada perfil respeita a própria largura", async () => {
  const noisy = await noiseJpeg(1400, 900);
  const cover = await optimize(noisy, "image/jpeg", "blog-cover");
  assert.ok(cover.report.width <= WEB_IMAGE_PROFILES["blog-cover"].maxWidth);
  assert.ok(Math.abs(cover.report.width / cover.report.height - 1400 / 900) < 0.02);
  assert.ok(cover.report.optimizedBytes < noisy.byteLength);
  assert.ok(cover.report.reductionPercent >= 15, `${noisy.byteLength} -> ${cover.report.optimizedBytes}`);

  const wide = await raster("jpeg", 2400, 800);
  const course = await optimize(wide, "image/jpeg", "course-service");
  const banner = await optimize(wide, "image/jpeg", "banner");
  assert.equal(course.report.width, 1600);
  assert.equal(banner.report.width, 1920);
  assert.ok(Math.abs(course.report.height - 800 * (1600 / 2400)) <= 1);
  assert.ok(Math.abs(banner.report.height - 800 * (1920 / 2400)) <= 1);
});

test("arquivo pequeno não cresce de forma relevante", async () => {
  const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  const optimized = await optimize(png, "image/png", "editorial");
  assert.equal(optimized.report.width, 1);
  assert.equal(optimized.report.height, 1);
  assert.ok(optimized.report.optimizedBytes <= png.byteLength);
});

test("resolução extrema, arquivo corrompido, MIME inconsistente e acima de 5 MB são recusados", async () => {
  const huge = await prepareWebImageForUpload({
    bytes: pngWithDimensions(12000, 12000),
    declaredType: "image/png",
    size: 64,
    profile: "banner",
  });
  assert.equal(huge.ok, false);
  if (!huge.ok) assert.match(huge.message, /grande demais|processar/);

  const corrupt = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x10, 0xff, 0xd9]);
  const broken = await prepareWebImageForUpload({
    bytes: corrupt,
    declaredType: "image/jpeg",
    size: corrupt.byteLength,
    profile: "editorial",
  });
  assert.equal(broken.ok, false);

  const png = await raster("png", 8, 8);
  const mismatched = await prepareWebImageForUpload({
    bytes: png,
    declaredType: "image/jpeg",
    size: png.byteLength,
    profile: "editorial",
  });
  assert.equal(mismatched.ok, false);
  if (!mismatched.ok) assert.match(mismatched.message, /não confere/);

  const oversized = new Uint8Array(EDITORIAL_IMAGE_LIMIT_BYTES + 1);
  oversized.set([0xff, 0xd8, 0xff]);
  const tooBig = await prepareWebImageForUpload({
    bytes: oversized,
    declaredType: "image/jpeg",
    size: oversized.byteLength,
    profile: "editorial",
  });
  assert.equal(tooBig.ok, false);
  if (!tooBig.ok) assert.match(tooBig.message, /5 MB/);

  const svg = new TextEncoder().encode("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
  const rejected = await prepareWebImageForUpload({
    bytes: svg,
    declaredType: "image/svg+xml",
    size: svg.byteLength,
    profile: "banner",
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.match(rejected.message, /SVG/);
});

test("falha do processador não produz arquivo e não chega ao envio", async () => {
  const png = await raster("png", 12, 12);
  let encoded = false;
  const failed = await prepareWebImageForUpload({
    bytes: png,
    declaredType: "image/png",
    size: png.byteLength,
    profile: "editorial",
  }, async () => {
    encoded = true;
    throw new Error("processor down");
  });
  assert.equal(encoded, true);
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.message, "Não foi possível processar a imagem.");

  let uploaded = false;
  const stored = await storeEditorialImage(
    { userId: "admin", role: "ADMIN" },
    { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x10, 0xff, 0xd9]), declaredType: "image/jpeg", size: 7, alt: "Capa", decorative: false },
    async () => {
      uploaded = true;
      return { ok: false, message: "não deveria enviar" };
    },
  );
  assert.equal(uploaded, false);
  assert.equal(stored.ok, false);
});

test("o APIMG recebe o arquivo final e uma falha dele não grava asset", async () => {
  const source = await raster("jpeg", 1600, 800);
  const prepared = await prepareWebImageForUpload({
    bytes: source,
    declaredType: "image/jpeg",
    size: source.byteLength,
    profile: "course-service",
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assertConsistent(prepared.bytes, prepared.format);
  assert.ok(prepared.report.width <= 1600);

  const captured: { file?: File } = {};
  const uploaded = await uploadToApimg(prepared.bytes, prepared.format, env, async (url, init) => {
    assert.equal(url, env.APIMG_UPLOAD_URL);
    assert.equal(new Headers(init.headers).get("X-API-Key"), env.APIMG_API_KEY);
    assert.ok(init.body instanceof FormData);
    const file = init.body.get("file");
    assert.ok(file instanceof File);
    captured.file = file;
    return new Response(JSON.stringify({
      url: "https://apimg.com.br/curso.webp",
      public_id: "curso",
      format: prepared.format === "jpeg" ? "jpg" : prepared.format,
      bytes: prepared.bytes.byteLength,
      width: prepared.report.width,
      height: prepared.report.height,
    }), { status: 200, headers: { "content-type": "application/json" } });
  });
  assert.equal(uploaded.ok, true);
  const sent = captured.file;
  if (!sent) throw new Error("O APIMG não recebeu o arquivo.");
  assert.equal(sent.type, mime(prepared.format));
  assert.equal(sent.name, `editorial.${prepared.format === "jpeg" ? "jpg" : prepared.format}`);
  assert.deepEqual(new Uint8Array(await sent.arrayBuffer()), prepared.bytes);

  const refused = await uploadToApimg(prepared.bytes, prepared.format, env, async () => new Response("no", { status: 502 }));
  assert.equal(refused.ok, false);

  const editorial = await storeEditorialImage(
    { userId: "admin", role: "ADMIN" },
    { bytes: source, declaredType: "image/jpeg", size: source.byteLength, alt: "Oficina", decorative: false },
    async () => ({ ok: false as const, message: "O serviço de imagens não aceitou este arquivo." }),
  );
  assert.equal(editorial.ok, false);
  if (!editorial.ok) assert.equal(editorial.message, "O serviço de imagens não aceitou este arquivo.");
});

test("capa e imagem editorial passam pela otimização; planilha e landing page não", () => {
  const blog = readFileSync("src/lib/blog/service.ts", "utf8");
  const editorial = readFileSync("src/lib/editorial/service.ts", "utf8");
  assert.match(blog, /prepareWebImageForUpload/);
  assert.match(blog, /"blog-cover"/);
  assert.match(blog, /uploadToApimg/);
  assert.match(editorial, /prepareWebImageForUpload/);
  assert.match(editorial, /profile: "editorial"/);
  assert.equal(readFileSync("src/lib/campaign-data/service.ts", "utf8").includes("prepareWebImageForUpload"), false);
  assert.equal(readFileSync("src/lib/landing-page/media/service.ts", "utf8").includes("prepareWebImageForUpload"), false);
  assert.equal(readFileSync("src/lib/landing-page/media/apimg-storage.ts", "utf8").includes("prepareWebImageForUpload"), false);
});

test("o editor informa origem, resultado e redução sem nova etapa", () => {
  const report = { originalBytes: 2_400_000, optimizedBytes: 140 * 1024, reductionPercent: 94, width: 1200, height: 675, format: "webp" as const };
  const feedback = blogPersistFeedback({
    intent: "save",
    status: "PUBLISHED",
    isNew: false,
    result: { ok: true, post: { id: "post-1" }, coverOptimization: report },
  });
  assert.equal(feedback.href, null);
  assert.match(feedback.message, /Alterações salvas/);
  assert.match(feedback.message, /2,3 MB|2,4 MB/);
  assert.match(feedback.message, /140 KB/);
  assert.match(feedback.message, /94% menor/);
  assert.equal(imageOptimizationNote({ originalBytes: 1200, optimizedBytes: 1200, reductionPercent: 0 }), "1,2 KB mantidos, já em tamanho adequado.");
});

async function optimize(bytes: Uint8Array, declaredType: string, profile: keyof typeof WEB_IMAGE_PROFILES) {
  const result = await prepareWebImageForUpload({ bytes, declaredType, size: bytes.byteLength, profile });
  if (!result.ok) throw new Error(result.message);
  return result;
}

function assertConsistent(bytes: Uint8Array, format: "jpeg" | "png" | "webp") {
  const checked = validateEditorialImage(bytes, mime(format), bytes.byteLength);
  assert.equal(checked.ok, true);
  if (checked.ok) assert.equal(checked.format, format);
}

function mime(format: "jpeg" | "png" | "webp"): string {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  return "image/webp";
}

async function raster(format: "jpeg" | "png" | "webp", width: number, height: number): Promise<Uint8Array> {
  const image = sharp({
    create: { width, height, channels: 3, background: "#3d6b58" },
  });
  const buffer = format === "jpeg"
    ? await image.jpeg({ quality: 90 }).toBuffer()
    : format === "png"
      ? await image.png().toBuffer()
      : await image.webp({ quality: 90 }).toBuffer();
  return new Uint8Array(buffer);
}

async function noiseJpeg(width: number, height: number): Promise<Uint8Array> {
  const raw = Buffer.alloc(width * height * 3);
  let seed = 1_234_567;
  for (let index = 0; index < raw.length; index += 1) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    raw[index] = seed & 255;
  }
  return new Uint8Array(await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90 }).toBuffer());
}

function pngWithDimensions(width: number, height: number): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IEND", Buffer.alloc(0)),
  ]));
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([length, body, crc]);
}
