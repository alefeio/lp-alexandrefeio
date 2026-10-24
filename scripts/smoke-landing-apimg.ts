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

const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
  0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01,
  0x00, 0x05, 0xfe, 0x02, 0xfe,
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

async function main(): Promise<void> {
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
