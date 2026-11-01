import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryAiLedger } from "../src/lib/ai/ledger";
import { AI_PRICING_VERSION } from "../src/lib/ai/pricing";
import { runEditorialAction } from "../src/lib/blog/ai";
import { BLOG_AI_ACTIONS, BLOG_AI_FEATURE_KEYS, buildEditorialRequest } from "../src/lib/blog/ai-request";
import { buildEditorialInventory, type EditorialInventory } from "../src/lib/blog/inventory";

const SECRET_TITLE = "TituloEditorialSecreto";
const SECRET_QUERY = "consulta-secreta-busca";
const SECRET_URL = "https://segredo.example/resultado";
const SECRET_MARKDOWN = "markdown-secreto-nao-persistir";
const SECRET_FOCUS = "foco-secreto-blog";

const inventory: EditorialInventory = buildEditorialInventory({
  posts: [{
    slug: "artigo-secreto",
    title: SECRET_TITLE,
    excerpt: "Resumo secreto",
    categorySlug: "trafego-pago",
    status: "PUBLISHED",
    publishedAt: new Date("2026-10-20T12:00:00.000Z"),
    contentMarkdown: SECRET_MARKDOWN,
    ctaKey: "TRAFFIC_COURSE",
    seoTitle: "SEO secreto",
    seoDescription: "Descricao secreta",
  }],
  ideas: [],
});

function response(patch: Record<string, unknown> = {}) {
  return {
    id: "resp-blog",
    model: "gpt-6-luna",
    service_tier: "default",
    output_text: JSON.stringify({ titles: ["Como medir a campanha"] }),
    usage: { input_tokens: 1_000, output_tokens: 2 },
    ...patch,
  };
}

test("as oito ações do blog pedem Standard e gravam o admin no ledger", async () => {
  for (const action of BLOG_AI_ACTIONS) {
    const request = buildEditorialRequest({ action, model: "gpt-6-luna", inventory, focus: { note: SECRET_FOCUS } });
    assert.equal(request.service_tier, "default");
    assert.equal(request.store, false);
    assert.equal(request.reasoning?.effort, "none");
    const ledger = createMemoryAiLedger();
    let sentTier: string | undefined;
    const result = await runEditorialAction({
      action,
      inventory,
      userId: "admin-77",
      focus: { note: SECRET_FOCUS },
      client: {
        responses: {
          async create(body: unknown) {
            sentTier = (body as { service_tier?: string }).service_tier;
            return response();
          },
        },
      },
      recordProviderCall: ledger.write,
    });
    assert.equal(result.ok, true);
    assert.equal(sentTier, "default");
    assert.equal(ledger.rows.length, 1);
    assert.equal(ledger.rows[0]?.attempt, 1);
    assert.equal(ledger.rows[0]?.featureKey, BLOG_AI_FEATURE_KEYS[action]);
    assert.equal(ledger.rows[0]?.userId, "admin-77");
    assert.equal(ledger.rows[0]?.operationType, action);
    assert.equal(ledger.rows[0]?.projectId, null);
    assert.equal(ledger.rows[0]?.courseId, null);
    assert.equal(ledger.rows[0]?.landingPageProjectId, null);
    assert.equal(ledger.rows[0]?.webSearchCalls, 0);
    assert.equal(ledger.rows[0]?.estimatedToolCostUsdMicros, 0);
    assert.equal(ledger.rows[0]?.serviceTier, "default");
    assert.equal(ledger.rows[0]?.pricingVersion, AI_PRICING_VERSION);
  }
  assert.equal(new Set(Object.values(BLOG_AI_FEATURE_KEYS)).size, 8);
  assert.equal(Object.values(BLOG_AI_FEATURE_KEYS).includes("landing_page_copy"), false);
});

test("resposta rejeitada continua no ledger e falha do writer não derruba o blog", async () => {
  const rejected = createMemoryAiLedger();
  const invalid = await runEditorialAction({
    action: "draft",
    inventory,
    userId: "admin-77",
    client: { responses: { create: async () => response({ output_text: "não é json", id: "resp-invalid" }) } },
    recordProviderCall: rejected.write,
  });
  assert.equal(invalid.ok, false);
  assert.equal(rejected.rows[0]?.status, "responded");
  assert.equal(rejected.rows[0]?.providerResponseId, "resp-invalid");
  assert.equal(rejected.rows[0]?.inputTokens, 1_000);
  assert.equal(rejected.rows[0]?.estimatedModelCostUsdMicros, 101);

  const failed = createMemoryAiLedger();
  const down = await runEditorialAction({
    action: "seo",
    inventory,
    userId: "admin-77",
    client: { responses: { create: async () => { throw new Error("sk-chave-nao-persistir"); } } },
    recordProviderCall: failed.write,
  });
  assert.equal(down.ok, false);
  assert.equal(failed.rows[0]?.status, "failed");
  assert.equal(failed.rows[0]?.errorCode, "PROVIDER_ERROR");
  assert.equal(failed.rows[0]?.webSearchCalls, null);
  assert.equal(failed.rows[0]?.estimatedCostUsdMicros, null);
  assert.equal(JSON.stringify(failed.rows).includes("sk-chave-nao-persistir"), false);

  const notices: number[] = [];
  const broken = await runEditorialAction({
    action: "titles",
    inventory,
    userId: "admin-77",
    client: { responses: { create: async () => response() } },
    recordProviderCall: async () => "failed",
    onLedgerFailure: (notice) => notices.push(notice.attempt),
  });
  assert.equal(broken.ok, true);
  assert.deepEqual(notices, [1]);

  const thrown: number[] = [];
  const exploded = await runEditorialAction({
    action: "titles",
    inventory,
    userId: "admin-77",
    client: { responses: { create: async () => response() } },
    recordProviderCall: async () => { throw new Error("ledger-boom"); },
    onLedgerFailure: (notice) => thrown.push(notice.attempt),
  });
  assert.equal(exploded.ok, true);
  assert.deepEqual(thrown, [1]);

  const hung: number[] = [];
  const started = Date.now();
  const stalled = await runEditorialAction({
    action: "titles",
    inventory,
    userId: "admin-77",
    client: { responses: { create: async () => response() } },
    recordProviderCall: () => new Promise(() => undefined),
    ledgerTimeoutMs: 30,
    onLedgerFailure: (notice) => hung.push(notice.attempt),
  });
  assert.equal(stalled.ok, true);
  assert.deepEqual(hung, [1]);
  assert.equal(Date.now() - started < 1_000, true);
});

test("web search soma a tarifa da ferramenta e não grava a busca", async () => {
  const one = createMemoryAiLedger();
  const single = await runEditorialAction({
    action: "trends",
    inventory,
    userId: "admin-77",
    focus: { note: SECRET_FOCUS },
    client: {
      responses: {
        create: async () => response({
          output: [{ type: "web_search_call", action: { query: SECRET_QUERY, url: SECRET_URL } }],
        }),
      },
    },
    recordProviderCall: one.write,
  });
  assert.equal(single.ok, true);
  assert.equal(one.rows[0]?.featureKey, "blog_trends");
  assert.equal(one.rows[0]?.webSearchCalls, 1);
  assert.equal(one.rows[0]?.estimatedModelCostUsdMicros, 101);
  assert.equal(one.rows[0]?.estimatedToolCostUsdMicros, 10_000);
  assert.equal(one.rows[0]?.estimatedCostUsdMicros, 10_101);

  const two = createMemoryAiLedger();
  await runEditorialAction({
    action: "trends",
    inventory,
    userId: "admin-77",
    client: {
      responses: {
        create: async () => response({
          output_text: JSON.stringify({ items: [], markdown: SECRET_MARKDOWN }),
          output: [
            { type: "web_search_call", action: { query: SECRET_QUERY, sources: [{ url: SECRET_URL }] } },
            { type: "web_search_call", action: { query: SECRET_QUERY } },
            { type: "message", content: [{ type: "output_text", text: SECRET_MARKDOWN }] },
          ],
        }),
      },
    },
    recordProviderCall: two.write,
  });
  assert.equal(two.rows[0]?.webSearchCalls, 2);
  assert.equal(two.rows[0]?.estimatedToolCostUsdMicros, 20_000);
  assert.equal(two.rows[0]?.estimatedCostUsdMicros, 20_101);

  const flex = createMemoryAiLedger();
  await runEditorialAction({
    action: "trends",
    inventory,
    userId: "admin-77",
    client: {
      responses: {
        create: async () => response({
          service_tier: "flex",
          output: [{ type: "web_search_call", action: { query: SECRET_QUERY } }],
        }),
      },
    },
    recordProviderCall: flex.write,
  });
  assert.equal(flex.rows[0]?.serviceTier, "flex");
  assert.equal(flex.rows[0]?.estimatedModelCostUsdMicros, null);
  assert.equal(flex.rows[0]?.estimatedToolCostUsdMicros, 10_000);
  assert.equal(flex.rows[0]?.estimatedCostUsdMicros, null);
  assert.equal(flex.rows[0]?.pricingVersion, null);

  const missing = createMemoryAiLedger();
  await runEditorialAction({
    action: "coverage",
    inventory,
    userId: "admin-77",
    client: {
      responses: {
        create: async () => {
          const body = response();
          delete (body as { service_tier?: string }).service_tier;
          return body;
        },
      },
    },
    recordProviderCall: missing.write,
  });
  assert.equal(missing.rows[0]?.serviceTier, null);
  assert.equal(missing.rows[0]?.estimatedCostUsdMicros, null);
  assert.equal(missing.rows[0]?.webSearchCalls, 0);

  const serialized = JSON.stringify([...one.rows, ...two.rows, ...flex.rows, ...missing.rows]);
  for (const secret of [SECRET_TITLE, SECRET_QUERY, SECRET_URL, SECRET_MARKDOWN, SECRET_FOCUS, "Resumo secreto", "SEO secreto"]) {
    assert.equal(serialized.includes(secret), false);
  }
});
