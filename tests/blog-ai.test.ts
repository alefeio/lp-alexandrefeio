import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BLOG_AI_FAILURE } from "../src/lib/blog/catalog";
import { acceptSuggestion, acceptTrendItem, assessDuplicateRisk, draftFromIdea, equivalentIntro, nextSequenceStage, recommendUpdate } from "../src/lib/blog/editorial";
import { buildEditorialInventory, type EditorialInventory } from "../src/lib/blog/inventory";
import { buildEditorialRequest, requestUsesWebSearch } from "../src/lib/blog/ai-request";
import { runEditorialAction } from "../src/lib/blog/ai";
import { consumeBlogTrendRateLimit, resetBlogRateLimit } from "../src/lib/blog/rate-limit";
import { activeEditorialSignals, FUTURE_EDITORIAL_SIGNAL_SOURCES } from "../src/lib/blog/signals";

const inventory: EditorialInventory = buildEditorialInventory({
  posts: [
    post("google-ads-ou-meta-ads", "Google Ads ou Meta Ads: qual escolher?", "PUBLISHED"),
    post("o-que-e-trafego-pago", "O que é tráfego pago", "PUBLISHED"),
    post("rascunho-orcamento", "Como definir o orçamento inicial", "DRAFT"),
  ],
  ideas: [
    idea("Como medir a primeira campanha", "PLANNED"),
    idea("Meta Ads ou Google Ads: o que é melhor?", "DISMISSED"),
  ],
});

test("inventário leva publicados, rascunhos, pautas e descartes sem id interno", () => {
  assert.equal(inventory.published.length, 2);
  assert.equal(inventory.drafts.length, 1);
  assert.equal(inventory.planned.length, 1);
  assert.equal(inventory.dismissed.length, 1);
  assert.equal(JSON.stringify(inventory).includes("cuid-secret"), false);
  const request = buildEditorialRequest({ action: "coverage", model: "test-model", inventory });
  assert.equal(request.store, false);
  assert.equal(requestUsesWebSearch(request), false);
  const raw = JSON.stringify(request.input);
  assert.match(raw, /Google Ads ou Meta Ads/);
  assert.match(raw, /orçamento inicial/);
  assert.match(raw, /Como medir a primeira campanha/);
  assert.match(raw, /DISMISSED|o que é melhor/i);
});

test("título equivalente recebe risco alto e a sequência não repete a introdução", () => {
  const risk = assessDuplicateRisk("Meta Ads ou Google Ads: o que é melhor?", inventory.published);
  assert.equal(risk.risk, "HIGH");
  assert.equal(risk.overlapping[0]?.slug, "google-ads-ou-meta-ads");
  const suggestion = acceptSuggestion({
    title: "Meta Ads ou Google Ads: o que é melhor?",
    angle: "A mesma pergunta",
    categorySlug: "trafego-pago",
    contentRole: "SATELLITE",
    searchIntent: "COMMERCIAL_INVESTIGATION",
    suggestedCtaKey: "TRAFFIC_COURSE",
    whyNext: "Não deveria nascer outra URL.",
  }, inventory);
  assert.equal(suggestion?.duplicateRisk, "HIGH");
  assert.equal(suggestion?.advice, "ATUALIZAR_ARTIGO_EXISTENTE");
  assert.equal(nextSequenceStage(["O que é tráfego pago"]), "DIAGNOSTICAR");
  assert.equal(equivalentIntro("O que é anúncio pago", ["O que é tráfego pago"]), true);
  assert.equal(equivalentIntro("Como saber se o negócio está pronto para anunciar", ["O que é tráfego pago"]), false);
});

test("mudança atual em assunto já coberto recomenda atualizar", () => {
  assert.equal(recommendUpdate("Mudança no Google Ads para pequenos negócios", [{ slug: "google-ads", title: "Google Ads para pequenos negócios" }]), "UPDATE_EXISTING");
});

test("tendência só nasce na ação explícita, exige fonte e não inventa volume", () => {
  const trends = buildEditorialRequest({ action: "trends", model: "test-model", inventory });
  const coverage = buildEditorialRequest({ action: "coverage", model: "test-model", inventory });
  assert.equal(requestUsesWebSearch(trends), true);
  assert.equal(requestUsesWebSearch(coverage), false);
  const page = readFileSync(new URL("../src/app/(admin)/admin/blog/planejamento/page.tsx", import.meta.url), "utf8");
  assert.equal(page.includes("researchTrends"), false);
  assert.equal(page.includes("web_search"), false);
  const bare = acceptTrendItem({ topic: "Novo botão", trendStatus: "TREND_SIGNAL", summary: "Assunto recente.", whyRelevant: "Pode interessar.", categorySlug: "trafego-pago", existingCoverage: "", recommendedAction: "MONITOR", suggestedAngle: "", sourceUrls: [], sourceDates: [] });
  assert.equal(bare.trendStatus, "INSUFFICIENT_EVIDENCE");
  const fake = acceptTrendItem({ topic: "Google Ads", trendStatus: "TREND_SIGNAL", summary: "As buscas cresceram 80%.", whyRelevant: "Volume.", categorySlug: "trafego-pago", existingCoverage: "", recommendedAction: "CREATE_NEW", suggestedAngle: "", sourceUrls: ["https://ads.google.com/home/"], sourceDates: ["2026-10-20"] });
  assert.equal(fake.trendStatus, "INSUFFICIENT_EVIDENCE");
  assert.equal(fake.summary.includes("80%"), false);
  const sourced = acceptTrendItem({ topic: "Google Ads", trendStatus: "CURRENT_TOPIC", summary: "O Google documentou uma mudança de interface.", whyRelevant: "Afeta quem anuncia.", categorySlug: "trafego-pago", existingCoverage: "Artigo existente.", recommendedAction: "UPDATE_EXISTING", suggestedAngle: "Atualizar o guia.", sourceUrls: ["https://support.google.com/google-ads"], sourceDates: ["2026-10-20"] });
  assert.equal(sourced.trendStatus, "CURRENT_TOPIC");
  assert.equal(sourced.recommendedAction, "UPDATE_EXISTING");
});

test("nenhuma ação de IA publica e uma resposta inválida não vira pauta", () => {
  const draft = draftFromIdea({ title: "Como definir orçamento inicial", angle: "Depois de saber se está pronto.", categorySlug: "trafego-pago", ctaKey: "TRAFFIC_COURSE" });
  assert.equal(draft.status, "DRAFT");
  assert.equal(acceptSuggestion({ title: "" }, inventory), null);
  const actions = readFileSync(new URL("../src/lib/blog/actions.ts", import.meta.url), "utf8");
  const runner = readFileSync(new URL("../src/lib/blog/ai.ts", import.meta.url), "utf8");
  assert.equal(runner.includes("PUBLISHED"), false);
  assert.match(actions, /intent: "publish"/);
  assert.equal(actions.includes("publishBlogPost"), false);
  const result = awaitFailure();
  return result;
});

test("falha da OpenAI não derruba o CMS e a chave fica no servidor", async () => {
  const failed = await runEditorialAction({
    action: "titles",
    inventory,
    client: { responses: { create: async () => { throw new Error("down"); } } },
  });
  assert.deepEqual(failed, { ok: false, message: BLOG_AI_FAILURE });
  const source = readFileSync(new URL("../src/lib/blog/ai.ts", import.meta.url), "utf8");
  assert.match(source, /readOpenAICopyApiKey/);
  assert.equal(source.includes("NEXT_PUBLIC_"), false);
  assert.match(source, /store: false|buildEditorialRequest/);
  assert.deepEqual(activeEditorialSignals(), ["inventory", "web_search"]);
  assert.equal(FUTURE_EDITORIAL_SIGNAL_SOURCES.includes("search_console"), true);
  const signals = readFileSync(new URL("../src/lib/blog/signals.ts", import.meta.url), "utf8");
  assert.equal(signals.includes("fetch("), false);
});

test("pesquisa de tendência tem limite mais curto que a geração comum", async () => {
  resetBlogRateLimit();
  for (let index = 0; index < 10; index += 1) assert.equal(await consumeBlogTrendRateLimit("admin-secret", 1_700_000_000_000), true);
  assert.equal(await consumeBlogTrendRateLimit("admin-secret", 1_700_000_000_000), false);
});

function post(slug: string, title: string, status: "PUBLISHED" | "DRAFT") {
  return {
    slug,
    title,
    excerpt: "Resumo",
    categorySlug: "trafego-pago",
    status,
    publishedAt: status === "PUBLISHED" ? new Date("2026-10-20T12:00:00.000Z") : null,
    contentMarkdown: "## O que muda\n\nTexto",
    ctaKey: "TRAFFIC_COURSE",
    seoTitle: title,
    seoDescription: "Resumo de SEO",
  };
}

function idea(title: string, status: string) {
  return { id: "cuid-secret", title, angle: "Ângulo", categorySlug: "trafego-pago", status, contentRole: "SATELLITE", searchIntent: "INFORMATIONAL" };
}

async function awaitFailure() {
  const failed = await runEditorialAction({
    action: "next",
    inventory,
    client: { responses: { create: async () => ({ output_text: "não é json" }) } },
  });
  assert.equal(failed.ok, false);
}
