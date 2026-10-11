/** O APIMG documenta 10 MB. Este site aceita até 5 MB, dentro desse teto. */
export const EDITORIAL_IMAGE_LIMIT_BYTES = 5 * 1024 * 1024;

const TYPES = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export type EditorialImageFormat = keyof typeof TYPES;

export function validateEditorialImage(
  bytes: Uint8Array,
  declaredType: string,
  size: number,
): { ok: true; format: EditorialImageFormat; bytes: Uint8Array } | { ok: false; message: string } {
  if (size <= 0 || bytes.byteLength === 0) return { ok: false, message: "O arquivo está vazio." };
  if (size > EDITORIAL_IMAGE_LIMIT_BYTES || bytes.byteLength > EDITORIAL_IMAGE_LIMIT_BYTES) {
    return { ok: false, message: "A imagem passa de 5 MB." };
  }
  const sniffed = sniff(bytes);
  if (!sniffed) return { ok: false, message: "Use JPEG, PNG ou WebP. SVG não entra nesta versão." };
  const declared = declaredType.trim().toLowerCase();
  if (declared && declared !== TYPES[sniffed] && declared !== "image/jpg") {
    return { ok: false, message: "O tipo do arquivo não confere com o conteúdo." };
  }
  if (declared === "image/jpg" && sniffed !== "jpeg") return { ok: false, message: "O tipo do arquivo não confere com o conteúdo." };
  return { ok: true, format: sniffed, bytes };
}

function sniff(bytes: Uint8Array): EditorialImageFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "webp";
  }
  return null;
}
