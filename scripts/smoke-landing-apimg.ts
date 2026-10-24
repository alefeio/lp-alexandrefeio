import { config as loadEnv } from "dotenv";
import { createApimgLandingPageMediaStorage, readApimgLandingMediaConfig } from "../src/lib/landing-page/media/apimg-storage";

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
  if (!readApimgLandingMediaConfig()) {
    console.log("NOT_CONFIGURED");
    return;
  }
  const storage = createApimgLandingPageMediaStorage();
  try {
    const created = await storage.put("synthetic", png, "image/png") as { url: string; storageKey?: string; status: number; format: string; bytes: number };
    if (!created.url.startsWith("https://") || !created.storageKey || !created.format || !Number.isFinite(created.bytes)) {
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
    console.log("DELETE_NOT_SUPPORTED");
  } catch (error) {
    console.log(`FAIL ${safeFailure(error)}`);
    process.exitCode = 1;
  }
}

void main();
