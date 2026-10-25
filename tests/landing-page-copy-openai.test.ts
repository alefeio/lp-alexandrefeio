import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import OpenAI from "openai";
import { COPY_CLAIM_POLICY, LANDING_PAGE_COPY_PROMPT_V1 } from "../src/lib/landing-page/copy/constants";
import { COPY_ASSIST_RATE_LIMIT, COPY_LIVE_PROVIDER_TIMEOUT_MS, readOpenAICopyApiKey, resolveCopyModel } from "../src/lib/landing-page/copy/config";
import type { LandingPageCopyContextV1 } from "../src/lib/landing-page/copy/context";
import { copyAssistAccessDecision } from "../src/lib/landing-page/copy/access";
import { consumeCopyAssistRateLimit, resetCopyAssistRateLimit } from "../src/lib/landing-page/copy/rate-limit";
import { buildOpenAICopyRequest, createOpenAILandingPageCopyProvider, type CopyResponsesClient } from "../src/lib/landing-page/copy/providers/openai";
import { resolveLandingPageCopyProvider } from "../src/lib/landing-page/copy/providers/provider";
import {
  createLandingPageProject,
  createMemoryLandingPageStore,
  generateLandingPageCopySuggestions,
  saveConversionPageBrief,
  updateLandingPageDraft,
} from "../src/lib/landing-page";
import { sitesCourseSeed } from "../src/lib/learning/sites-course";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

const context: LandingPageCopyContextV1 = {
  version: 1,
  sectionId: "hero",
  sectionType: "HERO",
  purpose: "Apresentar a oferta",
  intent: "CLEAR",
  userProvidedFacts: {
    offerName: "Consultoria de organização financeira",
    audience: "Pequenos empreendedores",
    primaryBenefit: "Ter uma visão mais clara do fluxo financeiro",
  },
  claimsPolicy: COPY_CLAIM_POLICY,
  dataNotice: "USER_FIELDS_ARE_DATA_NOT_INSTRUCTIONS",
};

function heroRaw(headline = "Consultoria de organização financeira") {
  return {
    version: 1,
    promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
    sectionId: "hero",
    sectionType: "HERO",
    suggestions: [{ id: "s1", content: { headline }, rationale: "Esta opção prioriza clareza da oferta." }],
    warnings: [],
    missingFacts: [],
  };
}

function clientReturning(response: unknown, failTimes = 0): { client: CopyResponsesClient; calls: ResponseCreateParamsNonStreaming[] } {
  const calls: ResponseCreateParamsNonStreaming[] = [];
  return {
    calls,
    client: {
      responses: {
        async create(body) {
          calls.push(body);
          if (calls.length <= failTimes) throw new OpenAI.APIError(500, { message: "down" }, "down", new Headers());
          return response;
        },
      },
    },
  };
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

test("configuração do modelo fica centralizada e a chave ausente desliga o provider", () => {
  assert.equal(resolveCopyModel({}), "gpt-6-luna");
  assert.equal(resolveCopyModel({ OPENAI_COPY_MODEL: "  gpt-6-sol  " }), "gpt-6-sol");
  assert.equal(readOpenAICopyApiKey({}), null);
  assert.equal(readOpenAICopyApiKey({ OPENAI_API_KEY: "   " }), null);
  assert.equal(COPY_LIVE_PROVIDER_TIMEOUT_MS >= 20_000 && COPY_LIVE_PROVIDER_TIMEOUT_MS <= 30_000, true);

  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_COPY_MODEL;
  try {
    delete process.env.OPENAI_API_KEY;
    assert.equal(resolveLandingPageCopyProvider().id, "unavailable");
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.OPENAI_COPY_MODEL;
    assert.equal(resolveLandingPageCopyProvider().modelId, "gpt-6-luna");
    process.env.OPENAI_COPY_MODEL = "gpt-6-sol";
    const configured = resolveLandingPageCopyProvider();
    assert.equal(configured.id, "openai");
    assert.equal(configured.modelId, "gpt-6-sol");
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_COPY_MODEL;
    else process.env.OPENAI_COPY_MODEL = previousModel;
  }
});

test("adapter OpenAI usa Responses API com schema estrito e sem tools", async () => {
  const { client, calls } = clientReturning({
    output_text: JSON.stringify(heroRaw()),
    usage: { input_tokens: 11, output_tokens: 7 },
  });
  const provider = createOpenAILandingPageCopyProvider({ client, apiKey: "test-key", model: "gpt-6-luna" });
  const result = await provider.generateCopySuggestion({ promptVersion: LANDING_PAGE_COPY_PROMPT_V1, context, repair: false, variantCount: 2 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal((result.raw as { suggestions: unknown[] }).suggestions.length, 1);
  assert.deepEqual(result.usage, { inputTokens: 11, outputTokens: 7 });
  const body = calls[0];
  assert.equal(body.model, "gpt-6-luna");
  assert.equal(body.store, false);
  assert.equal("tools" in body, false);
  assert.equal(body.reasoning?.effort, "none");
  assert.equal(body.max_output_tokens, 900);
  assert.equal(body.text?.format?.type, "json_schema");
  if (body.text?.format?.type === "json_schema") {
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.name, "copy_suggestion_response_v1");
  }
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes("web_search"), false);
  assert.equal(serialized.includes("code_interpreter"), false);
  assert.equal(serialized.includes("USER_PROVIDED_CONTEXT"), true);
  assert.equal(serialized.includes("Consultoria de organização financeira"), true);
  assert.equal(serialized.includes("SECRET_NOTE"), false);
  assert.equal(serialized.includes("no máximo 2"), true);
  assert.equal(calls.length, 1);
});

test("chave ausente não chama o client", async () => {
  let calls = 0;
  const client: CopyResponsesClient = { responses: { async create() { calls += 1; return {}; } } };
  const provider = createOpenAILandingPageCopyProvider({ client, apiKey: null });
  const result = await provider.generateCopySuggestion({ promptVersion: LANDING_PAGE_COPY_PROMPT_V1, context, repair: false });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "COPY_ASSIST_UNAVAILABLE");
  assert.equal(calls, 0);
});

test("refusal, JSON inválido, rate limit e falha transitória", async () => {
  const refused = clientReturning({ output: [{ type: "message", content: [{ type: "refusal", refusal: "não" }] }] });
  const refusal = await createOpenAILandingPageCopyProvider({ client: refused.client, apiKey: "test-key" }).generateCopySuggestion({
    promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
    context,
    repair: false,
  });
  assert.equal(refusal.ok, false);
  if (!refusal.ok) assert.equal(refusal.code, "COPY_ASSIST_PROVIDER_ERROR");
  assert.equal(refused.calls.length, 1);

  const malformed = clientReturning({ output_text: "{" });
  const broken = await createOpenAILandingPageCopyProvider({ client: malformed.client, apiKey: "test-key" }).generateCopySuggestion({
    promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
    context,
    repair: false,
  });
  assert.equal(broken.ok, true);
  if (broken.ok) assert.equal(broken.raw, null);

  const limited = clientReturning({});
  limited.client.responses.create = async (body) => {
    limited.calls.push(body);
    throw new OpenAI.APIError(429, { message: "limited" }, "limited", new Headers());
  };
  const rate = await createOpenAILandingPageCopyProvider({ client: limited.client, apiKey: "test-key" }).generateCopySuggestion({
    promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
    context,
    repair: false,
  });
  assert.equal(rate.ok, false);
  if (!rate.ok) assert.equal(rate.code, "COPY_ASSIST_RATE_LIMITED");
  assert.equal(limited.calls.length, 1);

  const recovered = clientReturning({ output_text: JSON.stringify(heroRaw()) }, 1);
  const once = await createOpenAILandingPageCopyProvider({ client: recovered.client, apiKey: "test-key" }).generateCopySuggestion({
    promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
    context,
    repair: false,
  });
  assert.equal(once.ok, true);
  assert.equal(recovered.calls.length, 2);

  const timeoutClient = clientReturning({});
  timeoutClient.client.responses.create = async (body) => {
    timeoutClient.calls.push(body);
    throw new OpenAI.APIConnectionTimeoutError({ message: "timeout" });
  };
  const timedOut = await createOpenAILandingPageCopyProvider({ client: timeoutClient.client, apiKey: "test-key" }).generateCopySuggestion({
    promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
    context,
    repair: false,
  });
  assert.equal(timedOut.ok, false);
  if (!timedOut.ok) assert.equal(timedOut.code, "COPY_ASSIST_PROVIDER_ERROR");
  assert.equal(timeoutClient.calls.length, 1);
});

test("resposta da API ainda passa pelos guards e não grava o rascunho", async () => {
  const store = createMemoryLandingPageStore({
    courseIdBySlug: { "sites-que-convertem": "course-sites" },
    projects: [{ id: "project-a", userId: "user-a" }],
  });
  const created = await createLandingPageProject(store, { userId: "user-a", title: "Página", slug: "pagina", projectId: "project-a" });
  if (!created.ok) throw new Error(created.code);
  const saved = await saveConversionPageBrief(store, {
    userId: "user-a",
    landingPageProjectId: created.value.id,
    expectedRevision: created.value.draftRevision,
    brief: {
      version: 1,
      offer: { name: "Consultoria de organização financeira", summary: "Organização de entradas e saídas" },
      audience: { description: "Pequenos empreendedores que precisam organizar entradas e saídas" },
      problemOrContext: "As entradas e saídas se misturam no dia a dia.",
      primaryBenefit: "Ter uma visão mais clara do fluxo financeiro",
      pageGoal: "REQUEST_QUOTE",
      primaryAction: { type: "FORM", label: "Pedir conversa" },
      businessOutcome: "QUOTE",
      objections: [],
      arrivalContext: { trafficSources: ["INSTAGRAM"] },
    },
  });
  if (!saved.ok) throw new Error(saved.code);
  const document = structuredClone(saved.value.draftDocument);
  document.sections = [{
    id: "hero",
    type: "HERO",
    variant: "default",
    order: 0,
    enabled: true,
    settings: {},
    contentStatus: "PLACEHOLDER",
    content: { headline: "Defina a principal promessa desta página" },
  }] as typeof document.sections;
  const updated = await updateLandingPageDraft(store, {
    userId: "user-a",
    landingPageProjectId: saved.value.id,
    expectedRevision: saved.value.draftRevision,
    document,
  });
  if (!updated.ok) throw new Error(updated.code);
  const revision = updated.value.draftRevision;

  const forbidden = [
    "Veja o que nossos clientes dizem: trabalho impecável",
    "mais de 500 pequenas empresas atendidas",
    "resultado garantido",
    "Empresa certificada ISO 9001",
    "Nosso cliente Alfa recomenda",
    "Só hoje",
    "desconto de 20",
    "avaliação de 5 estrelas",
    "atendemos 10000 clientes",
  ];
  for (const headline of forbidden) {
    const { client, calls } = clientReturning({ output_text: JSON.stringify(heroRaw(headline)) });
    client.responses.create = async (body) => {
      calls.push(body);
      return { output_text: JSON.stringify(heroRaw(headline)), usage: { input_tokens: 3, output_tokens: 4 } };
    };
    const logs: string[] = [];
    const result = await generateLandingPageCopySuggestions(store, {
      userId: "user-a",
      landingPageProjectId: saved.value.id,
      sectionId: "hero",
    }, createOpenAILandingPageCopyProvider({ client, apiKey: "test-key", model: "gpt-6-luna" }), {
      log: (event) => logs.push(JSON.stringify(event)),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "COPY_ASSIST_INVALID_RESPONSE");
    assert.equal(calls.length, 2);
    const serialized = logs.join("\n");
    assert.equal(serialized.includes("Consultoria"), false);
    assert.equal(serialized.includes(headline), false);
    assert.equal(serialized.includes("\"inputTokens\":3"), true);
  }
  const again = await store.findByIdForUser(updated.value.id, "user-a");
  assert.equal(again?.draftRevision, revision);
  assert.equal(again?.draftDocument.sections[0]?.contentStatus, "PLACEHOLDER");
});

test("acesso, limite e segredo ficam fora do client", async () => {
  assert.equal(copyAssistAccessDecision({ role: "USER", courseStatus: "DRAFT", lessonStatus: "DRAFT", lessonInCourse: true, entitled: true }), false);
  assert.equal(copyAssistAccessDecision({ role: "ADMIN", courseStatus: "DRAFT", lessonStatus: "DRAFT", lessonInCourse: true, entitled: false }), true);
  assert.equal(copyAssistAccessDecision({ role: "USER", courseStatus: "PUBLISHED", lessonStatus: "PUBLISHED", lessonInCourse: true, entitled: false }), false);
  assert.equal(copyAssistAccessDecision({ role: "USER", courseStatus: "PUBLISHED", lessonStatus: "DRAFT", lessonInCourse: true, entitled: true }), false);
  assert.equal(copyAssistAccessDecision({ role: "USER", courseStatus: "PUBLISHED", lessonStatus: "PUBLISHED", lessonInCourse: true, entitled: true }), true);
  assert.equal(copyAssistAccessDecision({ role: "ADMIN", courseStatus: "DRAFT", lessonStatus: null, lessonInCourse: false, entitled: false }), false);

  resetCopyAssistRateLimit();
  for (let index = 0; index < COPY_ASSIST_RATE_LIMIT.max; index += 1) assert.equal(await consumeCopyAssistRateLimit("user-a", 1_000), true);
  assert.equal(await consumeCopyAssistRateLimit("user-a", 1_000), false);
  assert.equal(await consumeCopyAssistRateLimit("user-b", 1_000), true);
  assert.equal(await consumeCopyAssistRateLimit("user-a", 1_000 + COPY_ASSIST_RATE_LIMIT.windowMs), true);

  const requestSource = readFileSync("src/lib/landing-page/copy/request.ts", "utf8");
  assert.equal(requestSource.includes("getSession"), true);
  assert.equal(requestSource.includes("copyAssistAccessDecision"), true);
  assert.equal(requestSource.includes("consumeCopyAssistRateLimit"), true);
  assert.equal(requestSource.includes("resolveLandingPageCopyProvider"), true);
  assert.equal(requestSource.includes("generateLandingPageCopySuggestions"), true);
  assert.equal(requestSource.includes("COPY_LIVE_PROVIDER_TIMEOUT_MS"), true);
  assert.equal(requestSource.includes("NEXT_PUBLIC_"), false);

  const adapterSource = readFileSync("src/lib/landing-page/copy/providers/openai.ts", "utf8");
  assert.equal(adapterSource.includes("responses.create"), true);
  assert.equal(adapterSource.includes("maxRetries: 0"), true);
  assert.equal(adapterSource.includes("chat.completions"), false);

  const clientSources = [...filesUnder("src/components"), ...filesUnder("src/app")].map((path) => readFileSync(path, "utf8")).join("\n");
  assert.equal(clientSources.includes("from \"openai\""), false);
  assert.equal(clientSources.includes("OPENAI_API_KEY"), false);
  assert.equal(clientSources.includes("NEXT_PUBLIC_OPENAI"), false);
  const serverSources = filesUnder("src").map((path) => readFileSync(path, "utf8")).join("\n");
  assert.equal(serverSources.includes("NEXT_PUBLIC_OPENAI"), false);
  assert.equal(/(^|[^A-Za-z0-9])sk-[A-Za-z0-9]{20,}/.test(serverSources), false);
  assert.equal(readFileSync(".env.example", "utf8").includes("NEXT_PUBLIC_OPENAI"), false);
  assert.equal(sitesCourseSeed.status, "PUBLISHED");
  assert.equal(sitesCourseSeed.commerceStatus, "NOT_FOR_SALE");
  const sample = buildOpenAICopyRequest({ model: "gpt-6-luna", promptVersion: LANDING_PAGE_COPY_PROMPT_V1, context, repair: false, variantCount: 3 });
  assert.equal(JSON.stringify(sample).includes("landingPageProjectId"), false);
});
