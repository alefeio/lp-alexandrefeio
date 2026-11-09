import assert from "node:assert/strict";
import test from "node:test";
import {
  FIRST_VALUE_RESULT_FIELD_KEYS,
  buildFirstValueSelectInput,
  isValidPedagogicalPayload,
  isValidResultLessonPayload,
  matchesOwnedCompletedDiagnostic,
  recommendFromFirstValueRecords,
  resolveTrustedResultAchievedAt,
  verifiedToolKeys,
  type FirstValueLoaderRecords,
  type FirstValueOrderRecord,
} from "../src/lib/learning/first-value";
import { FIRST_VALUE_LESSON_CATALOG } from "../src/lib/learning/first-value";
import { DIAGNOSTIC_VERSION } from "../src/lib/diagnostic/definition";
import { resultResponseSchema } from "../src/lib/learning/blocks";

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
          projectId: "p1",
          status: "COMPLETED",
          version: "traffic-readiness-v1",
          completedAt,
          createdAt: NOW,
          updatedAt: completedAt,
        },
      ],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
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
          projectId: "p1",
          status: "COMPLETED",
          version: "traffic-readiness-v1",
          completedAt,
          createdAt: NOW,
          updatedAt: completedAt,
        },
      ],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
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

const RESULT_LESSON = "como-funciona-o-trafego-pago";
const RESULT_KEYS = FIRST_VALUE_RESULT_FIELD_KEYS[RESULT_LESSON]!;
const validResultPayload = Object.fromEntries(RESULT_KEYS.map((key) => [key, `valor de ${key}`]));

test("16. Diagnóstico de outro projeto do mesmo usuário é rejeitado", () => {
  const completedAt = new Date(NOW.getTime() + 2_000);
  assert.equal(
    matchesOwnedCompletedDiagnostic({
      subjectUserId: USER,
      link: { projectId: "p1", diagnosticId: "d1" },
      diagnostic: {
        id: "d1",
        userId: USER,
        projectId: "p2",
        status: "COMPLETED",
        version: DIAGNOSTIC_VERSION,
        completedAt,
      },
      projects: [
        { id: "p1", userId: USER, status: "ACTIVE" },
        { id: "p2", userId: USER, status: "ACTIVE" },
      ],
    }),
    false,
  );
  const input = buildFirstValueSelectInput(
    emptyRecords({
      diagnostics: [
        {
          id: "d1",
          userId: USER,
          projectId: "p2",
          status: "COMPLETED",
          version: DIAGNOSTIC_VERSION,
          completedAt,
          createdAt: NOW,
          updatedAt: completedAt,
        },
      ],
      projects: [
        { id: "p1", userId: USER, status: "ACTIVE" },
        { id: "p2", userId: USER, status: "ACTIVE" },
      ],
      lessonResponses: [
        {
          id: "link",
          userId: USER,
          lessonSlug: "negocio-pronto-para-anunciar",
          blockKey: "tool",
          payload: { projectId: "p1", diagnosticId: "d1" },
          createdAt: completedAt,
          updatedAt: completedAt,
        },
      ],
    }),
  );
  assert.equal(input.artifacts.some((row) => row.kind === "diagnostic_completed"), false);
});

test("17. Diagnóstico com versão antiga é rejeitado", () => {
  const completedAt = new Date(NOW.getTime() + 2_000);
  const input = buildFirstValueSelectInput(
    emptyRecords({
      diagnostics: [
        {
          id: "d-old",
          userId: USER,
          projectId: "p1",
          status: "COMPLETED",
          version: "traffic-readiness-v0",
          completedAt,
          createdAt: NOW,
          updatedAt: completedAt,
        },
      ],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
      lessonResponses: [
        {
          id: "link",
          userId: USER,
          lessonSlug: "negocio-pronto-para-anunciar",
          blockKey: "tool",
          payload: { projectId: "p1", diagnosticId: "d-old" },
          createdAt: completedAt,
          updatedAt: completedAt,
        },
      ],
    }),
  );
  assert.equal(input.artifacts.some((row) => row.kind === "diagnostic_completed"), false);
});

test("18. Vínculo obsoleto (projeto inativo) é rejeitado", () => {
  const completedAt = new Date(NOW.getTime() + 2_000);
  const input = buildFirstValueSelectInput(
    emptyRecords({
      diagnostics: [
        {
          id: "d-inactive",
          userId: USER,
          projectId: "p1",
          status: "COMPLETED",
          version: DIAGNOSTIC_VERSION,
          completedAt,
          createdAt: NOW,
          updatedAt: completedAt,
        },
      ],
      projects: [{ id: "p1", userId: USER, status: "ARCHIVED" }],
      lessonResponses: [
        {
          id: "link",
          userId: USER,
          lessonSlug: "negocio-pronto-para-anunciar",
          blockKey: "tool",
          payload: { projectId: "p1", diagnosticId: "d-inactive" },
          createdAt: completedAt,
          updatedAt: completedAt,
        },
      ],
    }),
  );
  assert.equal(input.artifacts.some((row) => row.kind === "diagnostic_completed"), false);
});

test("19. Diagnóstico válido alinhado a ownedCompletedDiagnostic", () => {
  const completedAt = new Date(NOW.getTime() + 2_000);
  const input = buildFirstValueSelectInput(
    emptyRecords({
      diagnostics: [
        {
          id: "d-ok",
          userId: USER,
          projectId: "p1",
          status: "COMPLETED",
          version: DIAGNOSTIC_VERSION,
          completedAt,
          createdAt: NOW,
          updatedAt: completedAt,
        },
      ],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
      lessonResponses: [
        {
          id: "link",
          userId: USER,
          lessonSlug: "negocio-pronto-para-anunciar",
          blockKey: "tool",
          payload: { projectId: "p1", diagnosticId: "d-ok" },
          createdAt: completedAt,
          updatedAt: completedAt,
        },
      ],
    }),
  );
  const artifact = input.artifacts.find((row) => row.kind === "diagnostic_completed");
  assert.ok(artifact);
  assert.equal(artifact!.id, "d-ok");
  assert.equal(artifact!.resultAchievedAt?.toISOString(), completedAt.toISOString());
});

test("20. RESULT: resultResponseSchema sozinho aceita vazio — loader rejeita", () => {
  assert.equal(resultResponseSchema.safeParse({}).success, true);
  assert.equal(resultResponseSchema.safeParse({ abc: "" }).success, true);
  assert.equal(isValidResultLessonPayload({}, RESULT_KEYS), false);
  assert.equal(isValidResultLessonPayload({ abc: "" }, RESULT_KEYS), false);
  assert.equal(
    isValidPedagogicalPayload({
      toolKey: null,
      evidenceKind: "lesson_result_personal",
      payload: {},
      lessonSlug: RESULT_LESSON,
    }),
    false,
  );
  assert.equal(
    isValidPedagogicalPayload({
      toolKey: null,
      evidenceKind: "lesson_result_personal",
      payload: { abc: "" },
      lessonSlug: RESULT_LESSON,
    }),
    false,
  );
});

test("21. RESULT: chaves arbitrarias / incompletas não comprovam", () => {
  assert.equal(
    isValidResultLessonPayload({ "chave-inventada": "texto" }, RESULT_KEYS),
    false,
  );
  assert.equal(
    isValidResultLessonPayload(
      Object.fromEntries(RESULT_KEYS.map((key) => [key, key === RESULT_KEYS[0] ? "ok" : "   "])),
      RESULT_KEYS,
    ),
    false,
  );
  const input = buildFirstValueSelectInput(
    emptyRecords({
      lessonResults: [
        {
          id: "lr-empty",
          userId: USER,
          lessonSlug: RESULT_LESSON,
          projectId: null,
          payload: {},
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: "lr-partial",
          userId: USER,
          lessonSlug: RESULT_LESSON,
          projectId: null,
          payload: { "oferta-inicial": "só um campo" },
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    }),
  );
  assert.equal(
    input.artifacts.some((row) => row.lessonSlug === RESULT_LESSON && row.kind === "lesson_result_personal"),
    false,
  );
});

test("22. RESULT: campos do bloco preenchidos são aceitos", () => {
  assert.equal(isValidResultLessonPayload(validResultPayload, RESULT_KEYS), true);
  assert.equal(
    isValidPedagogicalPayload({
      toolKey: null,
      evidenceKind: "lesson_result_personal",
      payload: validResultPayload,
      lessonSlug: RESULT_LESSON,
    }),
    true,
  );
  const input = buildFirstValueSelectInput(
    emptyRecords({
      lessonResults: [
        {
          id: "lr-ok",
          userId: USER,
          lessonSlug: RESULT_LESSON,
          projectId: null,
          payload: validResultPayload,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    }),
  );
  const artifact = input.artifacts.find((row) => row.lessonSlug === RESULT_LESSON);
  assert.ok(artifact);
  assert.equal(artifact!.kind, "lesson_result_personal");
  assert.equal(artifact!.resultAchievedAt?.toISOString(), NOW.toISOString());
  assert.equal(artifact!.resultSource, "lesson_result_created_at");
});

test("23. RESULT: chaves do bloco publicado (override) exigidas no payload", () => {
  const customKeys = ["campo-a", "campo-b"] as const;
  assert.equal(isValidResultLessonPayload({ "campo-a": "x", "campo-b": "y" }, customKeys), true);
  assert.equal(isValidResultLessonPayload(validResultPayload, customKeys), false);
  const input = buildFirstValueSelectInput(
    emptyRecords({
      resultFieldKeysByLessonSlug: { [RESULT_LESSON]: customKeys },
      lessonResults: [
        {
          id: "lr-seed-only",
          userId: USER,
          lessonSlug: RESULT_LESSON,
          projectId: null,
          payload: validResultPayload,
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: "lr-block",
          userId: USER,
          lessonSlug: RESULT_LESSON,
          projectId: null,
          payload: { "campo-a": "ok", "campo-b": "ok" },
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    }),
  );
  assert.equal(
    input.artifacts.some((row) => row.id === "lr-seed-only"),
    false,
  );
  assert.ok(input.artifacts.some((row) => row.id === "lr-block"));
});

test("24. Integridade temporal: createdAt===updatedAt confia; re-save vira unknown", () => {
  const created = new Date(NOW.getTime() + 1_000);
  assert.equal(resolveTrustedResultAchievedAt({ createdAt: created, updatedAt: created })?.toISOString(), created.toISOString());
  assert.equal(
    resolveTrustedResultAchievedAt({ createdAt: created, updatedAt: new Date(created.getTime() + 1) }),
    null,
  );
});
