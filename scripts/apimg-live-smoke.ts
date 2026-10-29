import { uploadToApimg } from "../src/lib/storage/apimg";

async function main() {
  const png = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZihsAAAAASUVORK5CYII=",
      "base64",
    ),
  );

  const result = await uploadToApimg(png, "png");

  if (!result.ok) {
    console.error("APIMG LIVE SMOKE: FAIL", { message: result.message });
    process.exit(1);
  }

  console.log("APIMG LIVE SMOKE: PASS", {
    protocol: new URL(result.asset.url).protocol,
    format: result.asset.format,
    sizeBytes: result.asset.sizeBytes,
    hasPublicId: Boolean(result.asset.publicId),
  });
}

main().catch((error) => {
  console.error("APIMG LIVE SMOKE: FAIL", {
    name: error instanceof Error ? error.name : "Error",
  });
  process.exit(1);
});
