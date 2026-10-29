import { uploadToApimg } from "../src/lib/storage/apimg";

const REFERENCE_IMAGE_URL = "https://raw.githubusercontent.com/alefeio/kale/main/public/images/og-casamento.jpg";

async function main() {
  const reference = await fetch(REFERENCE_IMAGE_URL);
  if (!reference.ok) {
    console.error("APIMG LIVE SMOKE: FAIL", {
      reason: "reference-image-fetch",
      status: reference.status,
    });
    process.exit(1);
  }

  const bytes = new Uint8Array(await reference.arrayBuffer());
  const result = await uploadToApimg(bytes, "jpeg");

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
