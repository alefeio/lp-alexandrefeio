import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFirstValueSelectInput,
  isValidPedagogicalPayload,
  recommendFromFirstValueRecords,
  resolveTrustedResultAchievedAt,
  verifiedToolKeys,
  type FirstValueLoaderRecords,
  type FirstValueOrderRecord,
} from "../src/lib/learning/first-value";
import { FIRST_VALUE_LESSON_CATALOG } from "../src/lib/learning/first-value";

const NOW = new Date("2026-11-09T15:00:00.000Z");
const USER = "user-1";
const OTHER = "user-2";
const PUBLISHED = FIRST_VALUE_LESSON_CATALOG.map((row) => row.lessonSlug);

const campaignBriefPayload = {
  offer: "Consultoria",
  objective: "LEADS",
  primaryConversion: "Formulário",
  destination: "LANDING_PAGE",
  monthlyBudgetCents: 60000,
  dailyBudgetReferenceCents: 2000,
  initialObservationDays: 14,
  validationBeforeLaunch: "Revisar página e conversão.",
};

const conversionBriefComplete = {
  kind: "conversion-brief-summary" as const,
  landingPageProjectId: "lp-1",
  briefVersion: 1 as const,
  offerName: "Consultoria",
  audienceSummary: "Donos de negócio local",
  pageGoal: "GENERATE_LEAD" as const,
  primaryActionType: "WHATSAPP" as const,
  businessOutcome: "LEAD" as const,
  objectionCount: 1,
  completedAt: "2099-01-01T00:00:00.000Z",
};

const publicationPayload = (publishedAt: Date) => ({
  landingPageProjectId: "lp-1",
  publicationId: "pub-1",
  publicationVersion: 1,
  snapshotSchemaVersion: 1 as const,
  publicSlug: "minha-pagina",
  publicPath: "/p/minha-pagina",
  primaryActionType: "WHATSAPP" as const,
  primaryConversionEvent: "WHATSAPP_CLICK" as const,
  warningCount: 0,
  acknowledgedWarningCount: 0,
  publishedAt: publishedAt.toISOString(),
  sourceDraftRevision: 1,
});

function emptyRecords(patch: Partial<FirstValueLoaderRecords> = {}): FirstValueLoaderRecords {
  return {
    subjectUserId: USER,
    now: NOW,
    orders: [],
    entitlements: [],
    progress: [],
    lessonResults: [],
    lessonResponses: [],
    diagnostics: [],
    landingPageProjects: [],
    publications: [],
    projects: [],
    imports: [],
    publishedLessonSlugs: PUBLISHED,
    ...patch,
  };
}

function paidOrder(patch: Partial<FirstValueOrderRecord> & Pick<FirstValueOrderRecord, "id" | "items">): FirstValueOrderRecord {
  return {
    userId: USER,
    status: "PAID",
    zeroValueUpgrade: false,
    totalCents: 3490,
    createdAt: NOW,
    payments: [{ status: "APPROVED", approvedAt: NOW, amountCents: 3490 }],
    ...patch,
  };
}

test("1. JSON genérico não vazio não comprova ferramenta", () => {
  assert.equal(
    isValidPedagogicalPayload({
      toolKey: "CAMPAIGN_BRIEF_V1",
      evidenceKind: "lesson_result_project",
      payload: {},
    }),
    false,
  );
  assert.equal(
    isValidPedagogicalPayload({
      toolKey: "CAMPAIGN_BRIEF_V1",
      evidenceKind: "lesson_result_project",
      payload: { foo: 1 },
    }),
    false,
  );
  assert.equal(
    isValidPedagogicalPayload({
      toolKey: "DESTINATION_MEASUREMENT_PLAN_V1",
      evidenceKind: "lesson_result_project",
      payload: { note: "qualquer" },
    }),
    false,
  );
  assert.ok(verifiedToolKeys().includes("CAMPAIGN_BRIEF_V1"));
  assert.ok(verifiedToolKeys().includes("CONVERSION_PAGE_BRIEF_V1"));
});

test("2. Brief de Conversão incompleto", () => {
  assert.equal(
    isValidPedagogicalPayload({
      toolKey: "CONVERSION_PAGE_BRIEF_V1",
      evidenceKind: "lesson_result_personal",
      payload: { kind: "conversion-brief-summary", landingPageProjectId: "lp-1" },
    }),
    false,
  );
  const after = new Date(NOW.getTime() + 1_000);
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          items: [
            {
              id: "i1",
              productType: "LESSON",
              courseSlug: "sites-que-convertem",
              lessonSlugs: ["oferta-publico-acao-principal"],
            },
          ],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "oferta-publico-acao-principal", status: "ACTIVE", grantedAt: NOW }],
      lessonResults: [
        {
          id: "lr-incomplete",
          userId: USER,
          lessonSlug: "oferta-publico-acao-principal",
          projectId: null,
          payload: { kind: "conversion-brief-summary", landingPageProjectId: "lp-1" },
          createdAt: after,
          updatedAt: after,
        },
      ],
    }),
  );
  assert.notEqual(result.recommendation.state, "first_value_achieved");
});

test("3. Brief de Conversão completo e válido", () => {
  assert.equal(
    isValidPedagogicalPayload({
      toolKey: "CONVERSION_PAGE_BRIEF_V1",
      evidenceKind: "lesson_result_personal",
      payload: conversionBriefComplete,
    }),
    true,
  );
  const after = new Date(NOW.getTime() + 1_000);
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          items: [
            {
              id: "i1",
              productType: "LESSON",
              courseSlug: "sites-que-convertem",
              lessonSlugs: ["oferta-publico-acao-principal"],
            },
          ],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "oferta-publico-acao-principal", status: "ACTIVE", grantedAt: NOW }],
      lessonResults: [
        {
          id: "lr-ok",
          userId: USER,
          lessonSlug: "oferta-publico-acao-principal",
          projectId: null,
          payload: conversionBriefComplete,
          createdAt: after,
          updatedAt: after,
        },
      ],
    }),
  );
  assert.equal(result.recommendation.state, "first_value_achieved");
});

test("4. Resultado de outra ferramenta na aula incorreta", () => {
  assert.equal(
    isValidPedagogicalPayload({
      toolKey: "CONVERSION_PAGE_BRIEF_V1",
      evidenceKind: "lesson_result_personal",
      payload: campaignBriefPayload,
    }),
    false,
  );
  const after = new Date(NOW.getTime() + 1_000);
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          items: [
            {
              id: "i1",
              productType: "LESSON",
              courseSlug: "sites-que-convertem",
              lessonSlugs: ["oferta-publico-acao-principal"],
            },
          ],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "oferta-publico-acao-principal", status: "ACTIVE", grantedAt: NOW }],
      lessonResults: [
        {
          id: "lr-wrong",
          userId: USER,
          lessonSlug: "oferta-publico-acao-principal",
          projectId: "p1",
          payload: campaignBriefPayload,
          createdAt: after,
          updatedAt: after,
        },
      ],
    }),
  );
  assert.notEqual(result.recommendation.state, "first_value_achieved");
});

test("5. Diagnóstico concluído sem vínculo com a atividade", () => {
  const completedAt = new Date(NOW.getTime() + 2_000);
  const input = buildFirstValueSelectInput(
    emptyRecords({
      diagnostics: [
        {
          id: "d-orphan",
          userId: USER,
          status: "COMPLETED",
          completedAt,
          createdAt: NOW,
          updatedAt: completedAt,
        },
      ],
    }),
  );
  assert.equal(
    input.artifacts.some((row) => row.kind === "diagnostic_completed"),
    false,
  );
});

test("6. Diagnóstico concluído com vínculo correto", () => {
  const completedAt = new Date(NOW.getTime() + 2_000);
  const input = buildFirstValueSelectInput(
    emptyRecords({
      diagnostics: [
        {
          id: "d-linked",
          userId: USER,
          status: "COMPLETED",
          completedAt,
          createdAt: NOW,
          updatedAt: completedAt,
        },
      ],
      lessonResponses: [
        {
          id: "link",
          userId: USER,
          lessonSlug: "negocio-pronto-para-anunciar",
          blockKey: "tool",
          payload: { projectId: "p1", diagnosticId: "d-linked" },
          createdAt: completedAt,
          updatedAt: completedAt,
        },
      ],
    }),
  );
  const artifact = input.artifacts.find((row) => row.kind === "diagnostic_completed");
  assert.ok(artifact);
  assert.equal(artifact!.resultAchievedAt?.toISOString(), completedAt.toISOString());
});

test("7. Publicação sem vínculo pedagógico suficiente", () => {
  const publishedAt = new Date(NOW.getTime() + 3_000);
  const input = buildFirstValueSelectInput(
    emptyRecords({
      landingPageProjects: [
        { id: "lp-1", userId: USER, courseSlug: "sites-que-convertem", createdAt: NOW, updatedAt: publishedAt },
      ],
      publications: [
        {
          id: "pub-1",
          userId: USER,
          landingPageProjectId: "lp-1",
          courseSlug: "sites-que-convertem",
          publishedAt,
          createdAt: publishedAt,
        },
      ],
    }),
  );
  assert.equal(
    input.artifacts.some((row) => row.kind === "landing_page_published"),
    false,
  );
});

test("8. Publicação válida e atribuível", () => {
  const publishedAt = new Date(NOW.getTime() + 3_000);
  const input = buildFirstValueSelectInput(
    emptyRecords({
      landingPageProjects: [
        { id: "lp-1", userId: USER, courseSlug: "sites-que-convertem", createdAt: NOW, updatedAt: publishedAt },
      ],
      publications: [
        {
          id: "pub-1",
          userId: USER,
          landingPageProjectId: "lp-1",
          courseSlug: "sites-que-convertem",
          publishedAt,
          createdAt: publishedAt,
        },
      ],
      lessonResults: [
        {
          id: "lr-pub",
          userId: USER,
          lessonSlug: "revisao-antes-do-trafego",
          projectId: null,
          payload: publicationPayload(publishedAt),
          createdAt: publishedAt,
          updatedAt: publishedAt,
        },
      ],
    }),
  );
  assert.ok(input.artifacts.some((row) => row.kind === "landing_page_published"));
});

test("9. Resultado criado incompleto e atualizado posteriormente", () => {
  const created = new Date(NOW.getTime() + 1_000);
  const updated = new Date(NOW.getTime() + 10_000);
  assert.equal(resolveTrustedResultAchievedAt({ createdAt: created, updatedAt: updated }), null);
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW }],
      lessonResults: [
        {
          id: "lr-mut",
          userId: USER,
          lessonSlug: "objetivo-oferta-orcamento",
          projectId: "p1",
          payload: campaignBriefPayload,
          createdAt: created,
          updatedAt: updated,
        },
      ],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  assert.equal(result.recommendation.existingResult?.attribution, "unknown");
  assert.notEqual(result.recommendation.state, "first_value_achieved");
});

test("10. Resultado já válido antes da compra", () => {
  const before = new Date(NOW.getTime() - 86_400_000);
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW }],
      lessonResults: [
        {
          id: "lr-before",
          userId: USER,
          lessonSlug: "objetivo-oferta-orcamento",
          projectId: "p1",
          payload: campaignBriefPayload,
          createdAt: before,
          updatedAt: before,
        },
      ],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  assert.equal(result.recommendation.existingResult?.attribution, "before_purchase");
  assert.equal(result.recommendation.state, "continuation");
});

test("11. Primeira conquista realmente depois da compra", () => {
  const after = new Date(NOW.getTime() + 60_000);
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW }],
      lessonResults: [
        {
          id: "lr-after",
          userId: USER,
          lessonSlug: "objetivo-oferta-orcamento",
          projectId: "p1",
          payload: campaignBriefPayload,
          createdAt: after,
          updatedAt: after,
        },
      ],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  assert.equal(result.recommendation.state, "first_value_achieved");
  assert.equal(result.recommendation.existingResult?.attribution, "after_purchase");
});

test("12. Histórico extenso de pedidos e resultados permanece determinístico", () => {
  const orders = Array.from({ length: 40 }, (_, index) =>
    paidOrder({
      id: `o-${String(index).padStart(3, "0")}`,
      createdAt: new Date(NOW.getTime() - index * 1_000),
      payments: [{ status: "APPROVED", approvedAt: new Date(NOW.getTime() - index * 1_000), amountCents: 100 }],
      items: [
        {
          id: `item-${String(index).padStart(3, "0")}`,
          productType: "LESSON",
          courseSlug: null,
          lessonSlugs: index % 2 === 0 ? ["objetivo-oferta-orcamento"] : ["destino-e-mensuracao"],
        },
      ],
    }),
  );
  const a = recommendFromFirstValueRecords(
    emptyRecords({
      orders,
      entitlements: [
        { userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW },
        { userId: USER, lessonSlug: "destino-e-mensuracao", status: "ACTIVE", grantedAt: NOW },
      ],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  const b = recommendFromFirstValueRecords(
    emptyRecords({
      orders: orders.slice().reverse(),
      entitlements: [
        { userId: USER, lessonSlug: "destino-e-mensuracao", status: "ACTIVE", grantedAt: NOW },
        { userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW },
      ],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  assert.deepEqual(a.recommendation, b.recommendation);
  assert.equal(a.meta.purchaseCount, 40);
});

test("13. Isolamento por usuário no entrypoint de records", () => {
  const after = new Date(NOW.getTime() + 1_000);
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      subjectUserId: USER,
      orders: [
        paidOrder({
          id: "o-other",
          userId: OTHER,
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      lessonResults: [
        {
          id: "lr-other",
          userId: OTHER,
          lessonSlug: "objetivo-oferta-orcamento",
          projectId: "p1",
          payload: campaignBriefPayload,
          createdAt: after,
          updatedAt: after,
        },
      ],
      entitlements: [{ userId: OTHER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW }],
    }),
  );
  assert.equal(result.meta.purchaseCount, 0);
  assert.equal(result.recommendation.state, "continuation");
  assert.equal("subjectUserId" in result.meta, false);
});

test("14. Ausência de operações de escrita nas consultas (montagem pura)", () => {
  const input = buildFirstValueSelectInput(emptyRecords());
  assert.equal(input.purchases.length, 0);
  assert.equal(recommendFromFirstValueRecords(emptyRecords()).meta.readOnly, true);
});

test("15. Ausência de exposição de payloads privados", () => {
  const after = new Date(NOW.getTime() + 1_000);
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW }],
      lessonResults: [
        {
          id: "lr1",
          userId: USER,
          lessonSlug: "objetivo-oferta-orcamento",
          projectId: "p1",
          payload: campaignBriefPayload,
          createdAt: after,
          updatedAt: after,
        },
      ],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  const json = JSON.stringify(result);
  assert.equal(json.includes("Consultoria"), false);
  assert.equal(json.includes("monthlyBudgetCents"), false);
  assert.equal(json.includes("validationBeforeLaunch"), false);
  assert.equal(json.includes(USER), false);
});
