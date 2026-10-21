import { LANDING_PAGE_MEDIA_CONTENT_TYPES, type LandingPageMediaContentType } from "@/lib/landing-page/media/limits";

export type InspectedLandingPageImage = {
  mimeType: LandingPageMediaContentType;
  bytes: Uint8Array;
  width: number | null;
  height: number | null;
};

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let text = "";
  for (let index = 0; index < length && start + index < bytes.length; index += 1) {
    text += String.fromCharCode(bytes[start + index] ?? 0);
  }
  return text;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function looksActive(bytes: Uint8Array): boolean {
  const sample = ascii(bytes.subarray(0, Math.min(bytes.length, 256)), 0, Math.min(bytes.length, 256)).trim().toLowerCase();
  return sample.startsWith("<svg")
    || sample.startsWith("<?xml")
    || sample.startsWith("<!doctype")
    || sample.startsWith("<html")
    || sample.startsWith("<script")
    || sample.startsWith("%pdf")
    || sample.startsWith("gif87a")
    || sample.startsWith("gif89a");
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && ascii(bytes, 0, 8) === "\u0089PNG\r\n\u001a\n";
}

function isWebp(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
}

function webpHasExif(bytes: Uint8Array): boolean {
  const marker = [0x45, 0x58, 0x49, 0x46];
  for (let index = 12; index <= bytes.length - marker.length; index += 1) {
    if (marker.every((value, offset) => bytes[index + offset] === value)) return true;
  }
  return false;
}

function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [bytes.subarray(0, 2)];
  let index = 2;
  while (index + 1 < bytes.length) {
    if (bytes[index] !== 0xff) {
      chunks.push(bytes.subarray(index));
      return concat(chunks);
    }
    let markerAt = index;
    while (markerAt < bytes.length && bytes[markerAt] === 0xff) markerAt += 1;
    if (markerAt >= bytes.length) break;
    const marker = bytes[markerAt] ?? 0;
    if (marker === 0xda || marker === 0xd9) {
      chunks.push(bytes.subarray(index));
      return concat(chunks);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      chunks.push(bytes.subarray(index, markerAt + 1));
      index = markerAt + 1;
      continue;
    }
    if (markerAt + 2 >= bytes.length) break;
    const length = ((bytes[markerAt + 1] ?? 0) << 8) | (bytes[markerAt + 2] ?? 0);
    if (length < 2 || markerAt + 1 + length > bytes.length) break;
    const end = markerAt + 1 + length;
    if (marker !== 0xe1 && marker !== 0xed) chunks.push(bytes.subarray(index, end));
    index = end;
  }
  return concat(chunks);
}

function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = ((bytes[offset] ?? 0) << 24) | ((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    const type = ascii(bytes, offset + 4, 4);
    const total = length + 12;
    if (length < 0 || offset + total > bytes.length) break;
    if (type !== "eXIf" && type !== "tEXt" && type !== "zTXt" && type !== "iTXt") {
      chunks.push(bytes.subarray(offset, offset + total));
    }
    offset += total;
    if (type === "IEND") break;
  }
  return concat(chunks);
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let index = 2;
  while (index + 8 < bytes.length) {
    if (bytes[index] !== 0xff) return null;
    const marker = bytes[index + 1] ?? 0;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      index += 2;
      continue;
    }
    const length = ((bytes[index + 2] ?? 0) << 8) | (bytes[index + 3] ?? 0);
    const startOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (startOfFrame && index + 8 < bytes.length) {
      const height = ((bytes[index + 5] ?? 0) << 8) | (bytes[index + 6] ?? 0);
      const width = ((bytes[index + 7] ?? 0) << 8) | (bytes[index + 8] ?? 0);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (length < 2) return null;
    index += 2 + length;
  }
  return null;
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (!isPng(bytes) || ascii(bytes, 12, 4) !== "IHDR" || bytes.length < 24) return null;
  const width = ((bytes[16] ?? 0) << 24) | ((bytes[17] ?? 0) << 16) | ((bytes[18] ?? 0) << 8) | (bytes[19] ?? 0);
  const height = ((bytes[20] ?? 0) << 24) | ((bytes[21] ?? 0) << 16) | ((bytes[22] ?? 0) << 8) | (bytes[23] ?? 0);
  return width > 0 && height > 0 ? { width, height } : null;
}

export function inspectLandingPageImage(bytes: Uint8Array, declaredMime: string): InspectedLandingPageImage | null {
  if (!LANDING_PAGE_MEDIA_CONTENT_TYPES.includes(declaredMime as LandingPageMediaContentType)) return null;
  if (looksActive(bytes)) return null;
  let mimeType: LandingPageMediaContentType | null = null;
  if (isJpeg(bytes)) mimeType = "image/jpeg";
  else if (isPng(bytes)) mimeType = "image/png";
  else if (isWebp(bytes)) mimeType = "image/webp";
  if (!mimeType || mimeType !== declaredMime) return null;
  if (mimeType === "image/webp" && webpHasExif(bytes)) return null;
  const stripped = mimeType === "image/jpeg" ? stripJpegMetadata(bytes) : mimeType === "image/png" ? stripPngMetadata(bytes) : bytes;
  const size = mimeType === "image/jpeg" ? jpegSize(stripped) : mimeType === "image/png" ? pngSize(stripped) : null;
  return { mimeType, bytes: stripped, width: size?.width ?? null, height: size?.height ?? null };
}
