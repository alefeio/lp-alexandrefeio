import type { EditorialImageFormat } from "@/lib/storage/image-file";

const VALID_FORMATS = new Set(["jpg", "jpeg", "png", "webp"]);

export type ApimgAsset = {
  url: string;
  publicId: string;
  width: number | null;
  height: number | null;
  format: string;
  sizeBytes: number | null;
};

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export async function uploadToApimg(
  bytes: Uint8Array,
  format: EditorialImageFormat,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: FetchLike = fetch,
  folder?: string,
): Promise<{ ok: true; asset: ApimgAsset } | { ok: false; message: string }> {
  const apiKey = env.APIMG_API_KEY?.trim() ?? "";
  const uploadUrl = env.APIMG_UPLOAD_URL?.trim() ?? "";
  if (!apiKey || !uploadUrl) {
    return { ok: false, message: "O envio de imagens editoriais não está configurado." };
  }

  // APIMG receives only `file`. Folder env vars are logical prefixes used by the app.
  void folder;
  const body = new FormData();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  body.set("file", new Blob([copy], { type: mime(format) }), `editorial.${format === "jpeg" ? "jpg" : format}`);

  let response: Response;
  try {
    response = await fetchImpl(uploadUrl, {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      body,
    });
  } catch (error) {
    console.error("apimg upload failed", { name: error instanceof Error ? error.name : "Error" });
    return { ok: false, message: "Não foi possível enviar a imagem." };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("apimg upload rejected", { status: response.status });
    return { ok: false, message: "O serviço de imagens não aceitou este arquivo." };
  }

  const parsed = parseApimgUploadResponse(payload);
  if (!parsed.ok) {
    console.error("apimg upload rejected", { status: response.status, reason: "invalid-response" });
    return { ok: false, message: "A resposta da imagem veio incompleta." };
  }

  const row = payload as Record<string, unknown>;
  return {
    ok: true,
    asset: {
      url: parsed.url,
      publicId: parsed.publicId,
      width: numberOrNull(row.width),
      height: numberOrNull(row.height),
      format: parsed.format,
      sizeBytes: parsed.bytes,
    },
  };
}

export function apimgConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.APIMG_API_KEY?.trim() && env.APIMG_UPLOAD_URL?.trim());
}

function parseApimgUploadResponse(payload: unknown):
  | { ok: true; url: string; publicId: string; format: string; bytes: number }
  | { ok: false } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { ok: false };

  const row = payload as Record<string, unknown>;
  if (typeof row.url !== "string") return { ok: false };
  if (typeof row.public_id !== "string") return { ok: false };
  if (typeof row.format !== "string" || !VALID_FORMATS.has(row.format.toLowerCase())) return { ok: false };
  if (typeof row.bytes !== "number") return { ok: false };

  return {
    ok: true,
    url: row.url,
    publicId: row.public_id,
    format: row.format.toLowerCase(),
    bytes: row.bytes,
  };
}

function mime(format: EditorialImageFormat): string {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  return "image/webp";
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
