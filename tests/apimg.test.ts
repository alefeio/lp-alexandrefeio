import assert from "node:assert/strict";
import test from "node:test";
import { uploadToApimg } from "../src/lib/storage/apimg";

const bytes = new Uint8Array([137, 80, 78, 71]);

test("APIMG sends only the file field and uses the default upload endpoint", async () => {
  let called = false;
  const result = await uploadToApimg(
    bytes,
    "png",
    { APIMG_API_KEY: "server-secret" },
    async (input, init) => {
      called = true;
      assert.equal(input, "https://apimg.com.br/v1/upload");
      assert.equal(init.method, "POST");
      assert.equal(new Headers(init.headers).get("X-API-Key"), "server-secret");
      assert.ok(init.body instanceof FormData);
      assert.deepEqual(Array.from(init.body.keys()), ["file"]);
      return new Response(JSON.stringify({ url: "https://cdn.apimg.com.br/image.png", public_id: "image-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    "alexandre-feio/blog/covers",
  );

  assert.equal(called, true);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.asset.url, "https://cdn.apimg.com.br/image.png");
    assert.equal(result.asset.publicId, "image-1");
  }
});

test("APIMG accepts nested secure_url and publicId response variants", async () => {
  const result = await uploadToApimg(
    bytes,
    "webp",
    { APIMG_API_KEY: "server-secret", APIMG_UPLOAD_URL: "https://upload.example.test/v1/upload" },
    async () => new Response(JSON.stringify({
      data: {
        secure_url: "https://cdn.apimg.com.br/nested.webp",
        publicId: "nested-1",
        width: 1200,
        height: 630,
        format: "webp",
        bytes: 42000,
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.asset, {
      url: "https://cdn.apimg.com.br/nested.webp",
      publicId: "nested-1",
      width: 1200,
      height: 630,
      format: "webp",
      sizeBytes: 42000,
    });
  }
});

test("APIMG refuses uploads without a server API key", async () => {
  let called = false;
  const result = await uploadToApimg(bytes, "jpeg", {}, async () => {
    called = true;
    return new Response(null, { status: 500 });
  });

  assert.equal(called, false);
  assert.equal(result.ok, false);
});
