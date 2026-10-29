const SAMPLE_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAACvklEQVR4nO3TMQEAIAzAMMC/2ElAxo4mCvr0zsyBqrcdAJsMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYC0D3dZBNBfrtGOAAAAAElFTkSuQmCC";

async function main() {
  const uploadUrl = process.env.APIMG_UPLOAD_URL?.trim();
  const apiKey = process.env.APIMG_API_KEY?.trim();
  if (!uploadUrl || !apiKey) {
    console.error("APIMG LIVE DEBUG: FAIL", { reason: "configuration-missing" });
    process.exit(1);
  }

  const bytes = Uint8Array.from(Buffer.from(SAMPLE_PNG_BASE64, "base64"));
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const body = new FormData();
  body.set("file", new Blob([copy], { type: "image/png" }), "apimg-live-smoke.png");

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body,
  });
  const raw = await response.text();

  if (!response.ok) {
    console.error("APIMG LIVE DEBUG: FAIL", {
      status: response.status,
      body: raw.replace(/[\r\n]/g, " ").slice(0, 300),
    });
    process.exit(1);
  }

  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }
  const row = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};

  console.log("APIMG LIVE DEBUG: PASS", {
    status: response.status,
    keys: Object.keys(row).sort(),
    format: typeof row.format === "string" ? row.format : null,
    bytes: typeof row.bytes === "number" ? row.bytes : null,
    hasUrl: typeof row.url === "string",
    hasPublicId: typeof row.public_id === "string",
  });
}

main().catch((error) => {
  console.error("APIMG LIVE DEBUG: FAIL", {
    name: error instanceof Error ? error.name : "Error",
  });
  process.exit(1);
});
