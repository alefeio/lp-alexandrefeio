import { del, get, put } from "@vercel/blob";
import { LANDING_PAGE_MEDIA_LIMITS } from "@/lib/landing-page/media/limits";
import type { LandingPageMediaStorage } from "@/lib/landing-page/media/storage";

async function readLimited(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    total += next.value.byteLength;
    if (total > LANDING_PAGE_MEDIA_LIMITS.maxImageBytes) {
      await reader.cancel();
      throw new Error("landing media too large");
    }
    chunks.push(next.value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/**
 * PUBLIC_LANDING_PAGE_MEDIA.
 * Acesso público e prefixo opaco `landing-media/`.
 * Não usa o adapter privado de planilhas de campanha.
 */
export function createPublicLandingPageMediaStorage(): LandingPageMediaStorage {
  return {
    async put(pathname, body, contentType) {
      const created = await put(pathname, Buffer.from(body), {
        access: "public",
        contentType,
        addRandomSuffix: false,
        allowOverwrite: false,
      });
      return { url: created.url };
    },
    async get(pathname) {
      const result = await get(pathname, { access: "public" });
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      const bytes = await readLimited(result.stream);
      const url = "url" in result && typeof result.url === "string" ? result.url : null;
      return url ? { bytes, url } : { bytes, url: "" };
    },
    async delete(pathname) {
      await del(pathname);
    },
  };
}
