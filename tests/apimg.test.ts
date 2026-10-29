import assert from "node:assert/strict";
import test from "node:test";
import { uploadToApimg } from "../src/lib/storage/apimg";

const bytes = new Uint8Array([137, 80, 78, 71]);
const env = {
  APIMG_API_KEY: "server-secret",
  APIMG_UPLOAD_URL: "https://apimg.com.br/v1/upload",
};

test("APIMG sends only the file field and uses X-API-Key", async () => {
  let called = false;
  const result = await uploadToApimg(
    bytes,
    "png",
    env,
    async (input, init) => {
      called = true;
      assert.equal(input, "https://apimg.com.br/v1/upload");
      assert.equal(init.method, "POST");
      assert.equal(new Headers(init.headers).get("X-API-Key"), "server-secret");
      assert.ok(init.body instanceof FormData);
      assert.deepEqual(Array.from(init.body.keys()), ["file"]);
      return new Response(JSON.stringify({
        url: "https://cdn.apimg.com.br/image.png",
        public_id: "image-1",
        format: "png",
        bytes: 42000,
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    "alexandre-feio/blog/covers",
  );

  assert.equal(called, true);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.asset, {
      url: "https://cdn.apimg.com.br/image.png",
      publicId: "image-1",
      width: null,
      height: null,
      format: "png",
      sizeBytes: 42000,
    });
  }
});

test("APIMG accepts the root response contract used by Kale", async () => {
  const result = await uploadToApimg(
    bytes,
    "webp",
    env,
    async () => new Response(JSON.stringify({
      url: "https://cdn.apimg.com.br/hero.webp",
      public_id: "hero-1",
      format: "webp",
      bytes: 98765,
      width: 1600,
      height: 900,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.asset, {
      url: "https://cdn.apimg.com.br/hero.webp",
      publicId: "hero-1",
      width: 1600,
      height: 900,
      format: "webp",
      sizeBytes: 98765,
    });
  }
});

test("APIMG rejects speculative response variants outside the proven contract", async () => {
  const result = await uploadToApimg(
    bytes,
    "webp",
    env,
    async () => new Response(JSON.stringify({
      data: {
        secure_url: "https://cdn.apimg.com.br/nested.webp",
        publicId: "nested-1",
        format: "webp",
        bytes: 42000,
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  assert.equal(result.ok, false);
});

test("APIMG refuses uploads without complete server configuration", async () => {
  for (const incompleteEnv of [
    {},
    { APIMG_API_KEY: "server-secret" },
    { APIMG_UPLOAD_URL: "https://apimg.com.br/v1/upload" },
  ]) {
    let called = false;
    const result = await uploadToApimg(bytes, "jpeg", incompleteEnv, async () => {
      called = true;
      return new Response(null, { status: 500 });
    });

    assert.equal(called, false);
    assert.equal(result.ok, false);
  }
});
