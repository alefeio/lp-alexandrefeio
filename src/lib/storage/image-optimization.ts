import sharp from "sharp";
import { EDITORIAL_IMAGE_LIMIT_BYTES, validateEditorialImage, type EditorialImageFormat } from "@/lib/storage/image-file";
import { imageSizeChangePercent, type ImageOptimizationReport } from "@/lib/storage/image-optimization-note";

sharp.cache(false);
sharp.concurrency(1);

/**
 * Metas de exibição, não tetos rígidos de peso.
 * A qualidade só desce abaixo de 80 quando o arquivo ainda passa da meta.
 * Planilhas de campanha e a mídia da landing page não usam este serviço:
 * a primeira não é imagem, e a segunda já tem inspeção própria para logos e fotos do aluno.
 */
export const WEB_IMAGE_PROFILES = {
  "blog-cover": { maxWidth: 1200, targetBytes: 150 * 1024 },
  editorial: { maxWidth: 1200, targetBytes: 200 * 1024 },
  "course-service": { maxWidth: 1600, targetBytes: 250 * 1024 },
  banner: { maxWidth: 1920, targetBytes: 350 * 1024 },
} as const;

export type WebImageProfileName = keyof typeof WEB_IMAGE_PROFILES;

const MAX_EDGE = 8000;
const MAX_PIXELS = 24_000_000;
const INITIAL_QUALITY = 82;
const GROWTH_TOLERANCE = 1.1;

type Profile = (typeof WEB_IMAGE_PROFILES)[WebImageProfileName];

export type PreparedWebImage = {
  bytes: Uint8Array;
  format: EditorialImageFormat;
  report: ImageOptimizationReport;
};

type EncodedImage = {
  bytes: Uint8Array;
  format: EditorialImageFormat;
  width: number;
  height: number;
};

export async function prepareWebImageForUpload(
  input: {
    bytes: Uint8Array;
    declaredType: string;
    size: number;
    profile: WebImageProfileName;
  },
  encode: (bytes: Uint8Array, profile: Profile, sourceFormat: EditorialImageFormat) => Promise<EncodedImage> = encodeWebImage,
): Promise<{ ok: true } & PreparedWebImage | { ok: false; message: string }> {
  const checked = validateEditorialImage(input.bytes, input.declaredType, input.size);
  if (!checked.ok) return checked;

  try {
    const encoded = await encode(checked.bytes, WEB_IMAGE_PROFILES[input.profile], checked.format);
    const optimizedBytes = encoded.bytes.byteLength;
    if (optimizedBytes > EDITORIAL_IMAGE_LIMIT_BYTES) {
      return { ok: false, message: "A imagem passa de 5 MB." };
    }
    return {
      ok: true,
      bytes: encoded.bytes,
      format: encoded.format,
      report: {
        originalBytes: checked.bytes.byteLength,
        optimizedBytes,
        reductionPercent: imageSizeChangePercent(checked.bytes.byteLength, optimizedBytes),
        width: encoded.width,
        height: encoded.height,
        format: encoded.format,
      },
    };
  } catch (error) {
    console.error("image optimization failed", { name: error instanceof Error ? error.name : "Error" });
    return { ok: false, message: failureMessage(error) };
  }
}

async function encodeWebImage(bytes: Uint8Array, profile: Profile, sourceFormat: EditorialImageFormat): Promise<EncodedImage> {
  const meta = await sharp(bytes, {
    failOn: "error",
    limitInputPixels: MAX_PIXELS,
    animated: true,
  }).metadata();

  if ((meta.pages ?? 1) > 1) throw new Error("animated image is not accepted");
  if (meta.format !== "jpeg" && meta.format !== "png" && meta.format !== "webp") {
    throw new Error("unsupported image format");
  }
  if (!meta.width || !meta.height) throw new Error("image dimensions are missing");
  if (meta.width > MAX_EDGE || meta.height > MAX_EDGE || meta.width * meta.height > MAX_PIXELS) {
    throw new Error("image exceeds pixel limit");
  }

  const swapsAxes = (meta.orientation ?? 1) >= 5;
  const orientedWidth = swapsAxes ? meta.height : meta.width;
  const orientedHeight = swapsAxes ? meta.width : meta.height;
  const resized = orientedWidth > profile.maxWidth;
  const hasMetadata = Boolean(meta.exif || meta.iptc || meta.xmp) || (meta.orientation != null && meta.orientation !== 1);

  let chosen = await encodeWebp(bytes, profile.maxWidth, INITIAL_QUALITY);
  if (chosen.data.length > profile.targetBytes) {
    const softer = await encodeWebp(bytes, profile.maxWidth, 80);
    if (softer.data.length < chosen.data.length) chosen = softer;
  }
  if (chosen.data.length > profile.targetBytes) {
    for (const quality of [76, 72]) {
      const next = await encodeWebp(bytes, profile.maxWidth, quality);
      if (next.data.length < chosen.data.length) chosen = next;
      if (chosen.data.length <= profile.targetBytes) break;
    }
  }

  let output = toEncoded(chosen, "webp");
  const grew = output.bytes.byteLength > bytes.byteLength * GROWTH_TOLERANCE;
  if (!resized && !hasMetadata && grew) {
    output = { bytes: new Uint8Array(bytes), format: sourceFormat, width: orientedWidth, height: orientedHeight };
  } else if (grew) {
    const sameFormat = await encodeOriginalFormat(bytes, profile.maxWidth, sourceFormat);
    if (sameFormat.data.length < output.bytes.byteLength) output = toEncoded(sameFormat, sourceFormat);
  }
  output = await fitUploadLimit(bytes, output, {
    maxWidth: profile.maxWidth,
    resized,
    hasMetadata,
    sourceFormat,
    orientedWidth,
    orientedHeight,
  });

  if (output.width > profile.maxWidth) throw new Error("image exceeds pixel limit");
  if (output.width > orientedWidth || output.height > orientedHeight) throw new Error("image was enlarged");
  return output;
}

function toEncoded(
  encoded: { data: Buffer; info: { width: number; height: number } },
  format: EditorialImageFormat,
): EncodedImage {
  return {
    bytes: new Uint8Array(encoded.data),
    format,
    width: encoded.info.width,
    height: encoded.info.height,
  };
}

function fitted(bytes: Uint8Array, maxWidth: number) {
  return sharp(bytes, {
    failOn: "error",
    limitInputPixels: MAX_PIXELS,
    sequentialRead: true,
    animated: false,
  })
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true, fit: "inside" });
}

function encodeWebp(bytes: Uint8Array, maxWidth: number, quality: number) {
  return fitted(bytes, maxWidth)
    .webp({ quality, alphaQuality: 100, effort: 4, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });
}

function encodeOriginalFormat(bytes: Uint8Array, maxWidth: number, format: EditorialImageFormat) {
  const pipeline = fitted(bytes, maxWidth);
  if (format === "jpeg") return pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  if (format === "png") return pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
  return pipeline.webp({ quality: INITIAL_QUALITY, alphaQuality: 100, effort: 4 }).toBuffer({ resolveWithObject: true });
}

async function fitUploadLimit(
  source: Uint8Array,
  output: EncodedImage,
  context: {
    maxWidth: number;
    resized: boolean;
    hasMetadata: boolean;
    sourceFormat: EditorialImageFormat;
    orientedWidth: number;
    orientedHeight: number;
  },
): Promise<EncodedImage> {
  if (output.bytes.byteLength <= EDITORIAL_IMAGE_LIMIT_BYTES) return output;
  if (!context.resized && !context.hasMetadata && source.byteLength <= EDITORIAL_IMAGE_LIMIT_BYTES) {
    return {
      bytes: new Uint8Array(source),
      format: context.sourceFormat,
      width: context.orientedWidth,
      height: context.orientedHeight,
    };
  }
  for (const quality of [60, 48, 36]) {
    const next = toEncoded(await encodeWebp(source, context.maxWidth, quality), "webp");
    if (next.bytes.byteLength <= EDITORIAL_IMAGE_LIMIT_BYTES) return next;
  }
  throw new Error("output exceeds upload limit");
}

function failureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/upload limit/i.test(message)) return "A imagem passa de 5 MB.";
  if (/pixel limit|exceeds pixel|too large|enlarged/i.test(message)) {
    return "A imagem é grande demais para ser processada com segurança.";
  }
  if (/animated/i.test(message)) return "Use uma imagem estática.";
  if (/unsupported image format/i.test(message)) return "Use JPEG, PNG ou WebP. SVG não entra nesta versão.";
  return "Não foi possível processar a imagem.";
}
