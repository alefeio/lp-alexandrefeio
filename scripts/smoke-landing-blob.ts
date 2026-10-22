import { randomBytes } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { landingPageMediaStorageConfigured } from "../src/lib/landing-page/trust/plan";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

function safeFailure(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : "";
  const redacted = message
    .replace(/vercel_blob_rw_\S+/gi, "[redacted]")
    .replace(/bearer\s+\S+/gi, "[redacted]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .slice(0, 160);
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
  if (!landingPageMediaStorageConfigured(process.env)) {
    console.log("NOT_CONFIGURED");
    return;
  }
  const { createPublicLandingPageMediaStorage } = await import("../src/lib/landing-page/media/blob-storage");
  const storage = createPublicLandingPageMediaStorage();
  const pathname = `landing-media/smoke-${randomBytes(8).toString("hex")}.png`;
  try {
    const created = await storage.put(pathname, png, "image/png");
    if (!created.url.startsWith("https://")) throw new Error("storage response missing public url");
    const read = await storage.get(pathname);
    if (!read || read.bytes.byteLength < 8) throw new Error("stored object was not readable");
    const response = await fetch(created.url);
    if (!response.ok) throw new Error(`public read status ${response.status}`);
    await storage.delete(pathname);
    const after = await storage.get(pathname).catch((error: unknown) => {
      const name = error instanceof Error ? error.name : "";
      if (name.toLowerCase().includes("notfound") || name.toLowerCase().includes("not_found")) return null;
      throw error;
    });
    if (after) throw new Error("object remained after delete");
    console.log("PASS");
  } catch (error) {
    try {
      await storage.delete(pathname);
    } catch {
      // A exclusão de limpeza também falhou. O relatório fica só com a causa do smoke.
    }
    console.log(`FAIL ${safeFailure(error)}`);
    process.exitCode = 1;
  }
}

void main();
