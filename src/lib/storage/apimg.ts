import type { EditorialImageFormat } from "@/lib/storage/image-file";

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
  if (!apiKey || !uploadUrl) return { ok: false, message: "O envio de imagens editoriais não está configurado." };
  const body = new FormData();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  body.set("file", new Blob([copy], { type: mime(format) }), `editorial.${format === "jpeg" ? "jpg" : format}`);
  if (folder) body.set("folder", folder);
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
  if (!response.ok || !payload || typeof payload !== "object") {
    console.error("apimg upload rejected", { status: response.status });
    return { ok: false, message: "O serviço de imagens não aceitou este arquivo." };
  }
  const row = payload as Record<string, unknown>;
  const url = typeof row.url === "string" ? row.url : "";
  const publicId = typeof row.public_id === "string" ? row.public_id : "";
  if (!url.startsWith("https://") || !publicId) return { ok: false, message: "A resposta da imagem veio incompleta." };
  return {
    ok: true,
    asset: {
      url,
      publicId,
      width: numberOrNull(row.width),
      height: numberOrNull(row.height),
      format: typeof row.format === "string" ? row.format : format,
      sizeBytes: numberOrNull(row.bytes ?? row.size),
    },
  };
}

export function apimgConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.APIMG_API_KEY?.trim() && env.APIMG_UPLOAD_URL?.trim());
}

function mime(format: EditorialImageFormat): string {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  return "image/webp";
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
