import type { LandingPageMediaStorage } from "@/lib/landing-page/media/storage";

/** Contrato observado no CadastroCursos. A pasta lógica não entra no POST. */
export const APIMG_UPLOAD_TIMEOUT_MS = 30_000;

/** Os repositórios de referência não têm endpoint de exclusão. */
export const APIMG_PHYSICAL_DELETE_SUPPORTED = false;

export const LANDING_PAGE_MEDIA_STORAGE_PROVIDER = "APIMG" as const;

type ApimgEnv = {
  APIMG_UPLOAD_URL?: string;
  APIMG_API_KEY?: string;
};

export function readApimgLandingMediaConfig(env?: ApimgEnv): { uploadUrl: string; apiKey: string } | null {
  const source = env ?? (process.env as ApimgEnv);
  const uploadUrl = source.APIMG_UPLOAD_URL?.trim() ?? "";
  const apiKey = source.APIMG_API_KEY?.trim() ?? "";
  if (!uploadUrl || !apiKey) return null;
  try {
    const url = new URL(uploadUrl);
    if (url.protocol !== "https:" || url.hostname !== "apimg.com.br" || url.username || url.password) return null;
  } catch {
    return null;
  }
  return { uploadUrl, apiKey };
}

export function assertApimgPublicUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("APIMG public url is invalid");
  }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("APIMG public url is invalid");
  if (url.hostname !== "apimg.com.br" && !url.hostname.endsWith(".apimg.com.br")) throw new Error("APIMG public url is invalid");
  return url.toString();
}

export function parseApimgUploadResponse(json: unknown): { url: string; storageKey: string } {
  if (!json || typeof json !== "object") throw new Error("APIMG response is incomplete");
  const body = json as Record<string, unknown>;
  if (Array.isArray(body.detail) || typeof body.message === "string" || typeof body.detail === "string") {
    throw new Error("APIMG response is incomplete");
  }
  const url = typeof body.url === "string" ? body.url : "";
  const storageKey = typeof body.public_id === "string" ? body.public_id.trim() : "";
  if (!url || !storageKey || storageKey.length > 200) throw new Error("APIMG response is incomplete");
  return { url: assertApimgPublicUrl(url), storageKey };
}

function fileName(contentType: string): string {
  if (contentType === "image/jpeg") return "image.jpg";
  if (contentType === "image/png") return "image.png";
  if (contentType === "image/webp") return "image.webp";
  throw new Error("APIMG content type is not accepted");
}

/**
 * Adapter de produção da landing page.
 * O browser não recebe a credencial. Um segundo POST pode criar outro arquivo, então a falha não é reenviada.
 * A exclusão física não existe no contrato observado.
 */
export function createApimgLandingPageMediaStorage(options?: {
  env?: ApimgEnv;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): LandingPageMediaStorage {
  const fetchImpl = options?.fetch ?? fetch;
  const timeoutMs = options?.timeoutMs ?? APIMG_UPLOAD_TIMEOUT_MS;
  return {
    async put(_pathname, body, contentType) {
      const config = readApimgLandingMediaConfig(options?.env);
      if (!config) throw new Error("APIMG media storage is not configured");
      const form = new FormData();
      form.append("file", new Blob([Buffer.from(body)], { type: contentType }), fileName(contentType));
      const response = await fetchImpl(config.uploadUrl, {
        method: "POST",
        headers: { "X-API-Key": config.apiKey },
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        const failure = json && typeof json === "object" ? json as Record<string, unknown> : {};
        const detail = Array.isArray(failure.detail) ? (failure.detail[0] as { msg?: string } | undefined)?.msg : undefined;
        const message = typeof detail === "string" ? detail : typeof failure.message === "string" ? failure.message : typeof failure.detail === "string" ? failure.detail : "";
        const safe = message.replaceAll(config.apiKey, "").slice(0, 120);
        throw new Error(`APIMG upload failed (${response.status})${safe ? `: ${safe}` : ""}`);
      }
      return parseApimgUploadResponse(json);
    },
    async get(pathname) {
      let url: string;
      try {
        url = assertApimgPublicUrl(pathname);
      } catch {
        return null;
      }
      const response = await fetchImpl(url, { method: "GET", signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { bytes, url };
    },
    async delete() {
      throw new Error("APIMG physical delete is not supported");
    },
  };
}
