import { config as loadEnv } from "dotenv";
import { apimgDeleteUrl, createApimgLandingPageMediaStorage, readApimgLandingMediaConfig } from "../src/lib/landing-page/media/apimg-storage";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

function safeFailure(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : "";
  const secret = process.env.APIMG_API_KEY ?? "";
  const redacted = message.replace(/https?:\/\/\S+/gi, "[url]").replaceAll(secret, "[redacted]").slice(0, 160);
  return `${name}: ${redacted}`;
}

/** PNG 1x1 conhecido. Não montar estes bytes à mão. */
const VALID_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function syntheticPng(): Buffer {
  const png = Buffer.from(VALID_PNG_BASE64, "base64");
  if (png.length < PNG_SIGNATURE.length || !png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("synthetic png fixture is invalid");
  }
  return png;
}

async function main(): Promise<void> {
  const png = syntheticPng();
  const config = readApimgLandingMediaConfig();
  if (!config) {
    console.log("NOT_CONFIGURED");
    return;
  }
  const storage = createApimgLandingPageMediaStorage();
  let storageKey: string | null = null;
  try {
    const created = await storage.put("synthetic", png, "image/png") as { url: string; storageKey?: string; status: number; format: string; bytes: number };
    storageKey = created.storageKey ?? null;
    if (!created.url.startsWith("https://") || !storageKey || !created.format || !Number.isFinite(created.bytes)) {
      throw new Error("APIMG response is incomplete");
    }
    const read = await fetch(created.url, { method: "GET" });
    if (!read.ok) throw new Error(`public read status ${read.status}`);
    console.log("PASS_UPLOAD");
    console.log(`HTTP_STATUS ${created.status}`);
    console.log("PUBLIC_URL PASS");
    console.log("PUBLIC_ID PASS");
    console.log(`FORMAT ${created.format}`);
    console.log(`BYTES ${created.bytes}`);
    console.log("PUBLIC_READ PASS");
    await storage.delete(storageKey);
    console.log("DELETE PASS");
    const after = await fetch(created.url, { method: "GET" });
    if (after.status !== 404) throw new Error(`read after delete status ${after.status}`);
    console.log("PUBLIC_READ_AFTER_DELETE 404");
    const again = await fetch(apimgDeleteUrl(config.uploadUrl, storageKey), {
      method: "DELETE",
      headers: { "X-API-Key": config.apiKey },
      signal: AbortSignal.timeout(30_000),
    });
    const body = JSON.parse(await again.text()) as { public_id?: unknown; deleted?: unknown };
    if (!again.ok || body.public_id !== storageKey || body.deleted !== false) {
      throw new Error(`idempotent delete status ${again.status}`);
    }
    console.log("IDEMPOTENT_DELETE PASS");
    storageKey = null;
  } catch (error) {
    console.log(`FAIL ${safeFailure(error)}`);
    process.exitCode = 1;
  } finally {
    if (storageKey) {
      try {
        await storage.delete(storageKey);
      } catch {
        process.exitCode = 1;
      }
    }
  }
}

void main();
