import { readApimgLandingMediaConfig, type ApimgLandingMediaEnv } from "@/lib/landing-page/media/apimg-config";
import type { LandingPageMediaStorage } from "@/lib/landing-page/media/storage";

export { readApimgLandingMediaConfig } from "@/lib/landing-page/media/apimg-config";

/** Contrato observado no CadastroCursos. A pasta lógica não entra no POST. */
export const APIMG_UPLOAD_TIMEOUT_MS = 30_000;

/** Confirmado ao vivo: DELETE /v1/images/{public_id} remove o arquivo e é idempotente. */
export const APIMG_PHYSICAL_DELETE_SUPPORTED = true;

const APIMG_PUBLIC_ID = /^[a-f0-9]{32}\.[a-z0-9]{1,8}$/;

export const LANDING_PAGE_MEDIA_STORAGE_PROVIDER = "APIMG" as const;

export type ApimgUploadResult = {
  url: string;
  storageKey: string;
  format: string;
  bytes: number;
};

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

export function parseApimgUploadResponse(json: unknown): ApimgUploadResult {
  if (!json || typeof json !== "object") throw new Error("APIMG response is incomplete");
  const body = json as Record<string, unknown>;
  if (Array.isArray(body.detail) || typeof body.message === "string" || typeof body.detail === "string") {
    throw new Error("APIMG response is incomplete");
  }
  const url = typeof body.url === "string" ? body.url : "";
  const storageKey = typeof body.public_id === "string" ? body.public_id.trim() : "";
  const format = typeof body.format === "string" ? body.format.trim() : "";
  const bytes = typeof body.bytes === "number" && Number.isFinite(body.bytes) ? body.bytes : null;
  if (!url || !storageKey || storageKey.length > 200 || !format || bytes === null || bytes < 0) throw new Error("APIMG response is incomplete");
  return { url: assertApimgPublicUrl(url), storageKey, format, bytes };
}

export function assertApimgStorageKey(value: string): string {
  if (!APIMG_PUBLIC_ID.test(value)) throw new Error("APIMG storage key is invalid");
  return value;
}

export function apimgDeleteUrl(uploadUrl: string, storageKey: string): string {
  const key = assertApimgStorageKey(storageKey);
  const upload = new URL(uploadUrl);
  if (upload.protocol !== "https:" || upload.hostname !== "apimg.com.br" || upload.pathname !== "/v1/upload" || upload.username || upload.password) {
    throw new Error("APIMG delete url is invalid");
  }
  return new URL(`/v1/images/${key}`, upload.origin).toString();
}

export function parseApimgDeleteResponse(json: unknown, storageKey: string): { publicId: string; deleted: boolean } {
  if (!json || typeof json !== "object") throw new Error("APIMG delete response is incomplete");
  const body = json as Record<string, unknown>;
  if (body.public_id !== storageKey || typeof body.deleted !== "boolean") throw new Error("APIMG delete response is incomplete");
  return { publicId: storageKey, deleted: body.deleted };
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
 * O DELETE é idempotente: deleted=false significa que o arquivo já não existe. Uma limpeza posterior pode chamá-lo de novo.
 */
export function createApimgLandingPageMediaStorage(options?: {
  env?: ApimgLandingMediaEnv;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): LandingPageMediaStorage {
  const fetchImpl = options?.fetch ?? fetch;
  const timeoutMs = options?.timeoutMs ?? APIMG_UPLOAD_TIMEOUT_MS;
  return {
    async put(_pathname, body, contentType) {
      const config = readApimgLandingMediaConfig(options?.env);
      if (!config?.uploadFolder || !config.landingMediaFolder) throw new Error("APIMG media storage is not configured");
      const form = new FormData();
      form.append("file", new File([Buffer.from(body)], fileName(contentType), { type: contentType }));
      const response = await fetchImpl(config.uploadUrl, {
        method: "POST",
        headers: { "X-API-Key": config.apiKey },
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const raw = await response.text();
      const json = (() => { try { return JSON.parse(raw) as unknown; } catch { return null; } })();
      if (!response.ok) {
        const failure = json && typeof json === "object" ? json as Record<string, unknown> : {};
        const detail = Array.isArray(failure.detail) ? (failure.detail[0] as { msg?: string } | undefined)?.msg : undefined;
        const message = typeof detail === "string" ? detail : typeof failure.message === "string" ? failure.message : typeof failure.detail === "string" ? failure.detail : "";
        const safe = (message || raw).replaceAll(config.apiKey, "").replace(/\s+/g, " ").trim().slice(0, 180);
        throw new Error(`APIMG upload failed (${response.status})${safe ? `: ${safe}` : ""}`);
      }
      return Object.assign(parseApimgUploadResponse(json), { status: response.status });
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
    async delete(storageKey) {
      const config = readApimgLandingMediaConfig(options?.env);
      if (!config) throw new Error("APIMG media storage is not configured");
      const key = assertApimgStorageKey(storageKey);
      const endpoint = apimgDeleteUrl(config.uploadUrl, key);
      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: "DELETE",
          headers: { "X-API-Key": config.apiKey },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        throw new Error(`APIMG delete failed${message ? `: ${message.replaceAll(config.apiKey, "").slice(0, 120)}` : ""}`);
      }
      const raw = await response.text();
      const json = (() => { try { return JSON.parse(raw) as unknown; } catch { return null; } })();
      if (!response.ok) {
        const failure = json && typeof json === "object" ? json as Record<string, unknown> : {};
        const detail = typeof failure.detail === "string" ? failure.detail : typeof failure.message === "string" ? failure.message : "";
        const safe = (detail || raw).replaceAll(config.apiKey, "").replace(/\s+/g, " ").trim().slice(0, 180);
        throw new Error(`APIMG delete failed (${response.status})${safe ? `: ${safe}` : ""}`);
      }
      parseApimgDeleteResponse(json, key);
    },
  };
}
