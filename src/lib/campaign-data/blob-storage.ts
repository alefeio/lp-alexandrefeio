import { del, get, put } from "@vercel/blob";
import { CampaignDataError } from "@/lib/campaign-data/errors";
import { CAMPAIGN_DATA_LIMITS } from "@/lib/campaign-data/limits";
import type { PrivateStorage } from "@/lib/campaign-data/storage";

async function readLimited(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    total += next.value.byteLength;
    if (total > CAMPAIGN_DATA_LIMITS.maxFileBytes) {
      await reader.cancel();
      throw new CampaignDataError("FILE_TOO_LARGE");
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

export function createPrivateBlobStorage(): PrivateStorage {
  return {
    async put(pathname, body) {
      try {
        await put(pathname, Buffer.from(body), {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
        });
      } catch {
        throw new CampaignDataError("STORAGE_FAILED");
      }
    },
    async get(pathname) {
      try {
        const result = await get(pathname, { access: "private", useCache: false });
        if (!result || result.statusCode !== 200 || !result.stream) return null;
        return readLimited(result.stream);
      } catch (error) {
        if (error instanceof CampaignDataError) throw error;
        throw new CampaignDataError("STORAGE_FAILED");
      }
    },
    async del(pathname) {
      try {
        await del(pathname);
      } catch (error) {
        if (error instanceof Error && error.name === "BlobNotFoundError") return;
        throw new CampaignDataError("STORAGE_FAILED");
      }
    },
  };
}
