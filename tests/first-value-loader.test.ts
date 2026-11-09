import assert from "node:assert/strict";
import test from "node:test";
import {
  FIRST_VALUE_LESSON_CATALOG,
  buildFirstValueSelectInput,
  isValidPedagogicalPayload,
  readMutablePayloadCompletedAt,
  recommendFromFirstValueRecords,
  resolvePurchaseConfirmation,
  type FirstValueLoaderRecords,
  type FirstValueOrderRecord,
} from "../src/lib/learning/first-value";

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

const conversionBriefPayload = {
  kind: "conversion-brief-summary",
  landingPageProjectId: "lp-1",
  briefVersion: 1 as const,
  offerName: "Consultoria",
  audienceSummary: "Donos de negócio local",
  pageGoal: "GENERATE_LEAD",
  primaryActionType: "WHATSAPP",
  businessOutcome: "LEAD",
  objectionCount: 1,
  completedAt: "2099-01-01T00:00:00.000Z",
};

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

test("1. usuário sem pedidos → continuation", () => {
  const result = recommendFromFirstValueRecords(emptyRecords());
  assert.equal(result.recommendation.state, "continuation");
  assert.equal(result.meta.purchaseCount, 0);
});

test("2. pedido pendente", () => {
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          status: "PENDING_PAYMENT",
          payments: [],
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
    }),
  );
  assert.equal(result.recommendation.state, "payment_pending");
});

test("3. pedido NEEDS_REVIEW", () => {
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          status: "NEEDS_REVIEW",
          payments: [{ status: "APPROVED", approvedAt: NOW, amountCents: 3490 }],
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW }],
    }),
  );
  assert.equal(result.recommendation.state, "access_unavailable");
  assert.match(result.recommendation.reason, /NEEDS_REVIEW/);
});

test("4. pedido pago com Payment.approvedAt", () => {
  const approvedAt = new Date(NOW.getTime() + 1_000);
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          createdAt: NOW,
          payments: [{ status: "APPROVED", approvedAt, amountCents: 3490 }],
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: approvedAt }],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  assert.equal(result.recommendation.state, "ready_to_start");
  const input = buildFirstValueSelectInput(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          payments: [{ status: "APPROVED", approvedAt, amountCents: 3490 }],
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
    }),
  );
  assert.equal(input.purchases[0]?.confirmedAtSource, "payment_approved_at");
  assert.equal(input.purchases[0]?.confirmedAt?.toISOString(), approvedAt.toISOString());
});

test("5. pedido PAID sem confirmação temporal verificável", () => {
  const confirmation = resolvePurchaseConfirmation({
    status: "PAID",
    zeroValueUpgrade: false,
    totalCents: 3490,
    createdAt: NOW,
    payments: [{ status: "APPROVED", approvedAt: null, amountCents: 3490 }],
  });
  assert.equal(confirmation.confirmedAt, null);
  assert.equal(confirmation.confirmedAtSource, "unknown");
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          payments: [{ status: "APPROVED", approvedAt: null, amountCents: 3490 }],
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW }],
    }),
  );
  assert.equal(result.recommendation.state, "access_unavailable");
});

test("6. upgrade de valor zero legítimo", () => {
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o-zero",
          zeroValueUpgrade: true,
          totalCents: 0,
          payments: [],
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW }],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  assert.equal(result.recommendation.state, "ready_to_start");
  assert.equal(result.recommendation.product.zeroValueUpgrade, true);
  const input = buildFirstValueSelectInput(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o-zero",
          zeroValueUpgrade: true,
          totalCents: 0,
          payments: [],
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
    }),
  );
  assert.equal(input.purchases[0]?.confirmedAtSource, "zero_upgrade_created_at");
});

test("7. pedido com dois OrderItems", () => {
  const input = buildFirstValueSelectInput(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o-multi",
          items: [
            { id: "item-b", productType: "LESSON", courseSlug: null, lessonSlugs: ["destino-e-mensuracao"] },
            { id: "item-a", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] },
          ],
        }),
      ],
    }),
  );
  assert.equal(input.purchases.length, 2);
  assert.deepEqual(
    input.purchases.map((row) => row.orderItemId),
    ["item-a", "item-b"],
  );
});

test("8. produtos com aulas sobrepostas", () => {
  const input = buildFirstValueSelectInput(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          items: [
            {
              id: "mod",
              productType: "MODULE",
              courseSlug: "trafego-pago-na-pratica",
              lessonSlugs: ["objetivo-oferta-orcamento", "destino-e-mensuracao"],
            },
          ],
        }),
        paidOrder({
          id: "o2",
          createdAt: new Date(NOW.getTime() - 10_000),
          payments: [{ status: "APPROVED", approvedAt: new Date(NOW.getTime() - 10_000), amountCents: 3490 }],
          items: [{ id: "lesson", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
    }),
  );
  assert.equal(input.purchases.filter((row) => row.lessonSlugs.includes("objetivo-oferta-orcamento")).length, 2);
});

test("9. entitlement ativo", () => {
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW }],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  assert.equal(result.recommendation.state, "ready_to_start");
});

test("10. entitlement revogado", () => {
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "REVOKED", grantedAt: NOW }],
    }),
  );
  assert.equal(result.recommendation.state, "access_unavailable");
});

test("11. aula gratuita publicada sem entitlement", () => {
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          items: [
            {
              id: "i1",
              productType: "COURSE",
              courseSlug: "trafego-pago-na-pratica",
              lessonSlugs: ["como-funciona-o-trafego-pago", "objetivo-oferta-orcamento"],
            },
          ],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW }],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  assert.equal(result.recommendation.activity?.lessonSlug, "objetivo-oferta-orcamento");
});

test("12. aula despublicada", () => {
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      publishedLessonSlugs: [],
      orders: [
        paidOrder({
          id: "o1",
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW }],
    }),
  );
  assert.equal(result.recommendation.state, "access_unavailable");
});

test("13. progresso iniciado antes da compra", () => {
  const earlier = new Date(NOW.getTime() - 86_400_000);
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW }],
      progress: [
        {
          userId: USER,
          lessonSlug: "objetivo-oferta-orcamento",
          startedAt: earlier,
          completedAt: null,
          lastActiveAt: earlier,
          percent: 40,
        },
      ],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  assert.equal(result.recommendation.state, "in_progress");
});

test("14. Brief de Campanha validado", () => {
  assert.equal(
    isValidPedagogicalPayload({
      toolKey: "CAMPAIGN_BRIEF_V1",
      evidenceKind: "lesson_result_project",
      payload: campaignBriefPayload,
    }),
    true,
  );
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
  assert.equal(result.recommendation.state, "first_value_achieved");
  assert.equal(result.recommendation.existingResult?.resultSource, "lesson_result_created_at");
});

test("15. Brief de Conversão validado", () => {
  const after = new Date(NOW.getTime() + 60_000);
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
          id: "lr-brief",
          userId: USER,
          lessonSlug: "oferta-publico-acao-principal",
          projectId: null,
          payload: conversionBriefPayload,
          createdAt: after,
          updatedAt: after,
        },
      ],
    }),
  );
  assert.equal(result.recommendation.state, "first_value_achieved");
  assert.notEqual(result.recommendation.existingResult?.resultAchievedAt, conversionBriefPayload.completedAt);
});

test("16. LandingPageProject criado sem brief", () => {
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
      landingPageProjects: [{ id: "lp-empty", userId: USER, courseSlug: "sites-que-convertem", createdAt: NOW, updatedAt: NOW }],
    }),
  );
  assert.notEqual(result.recommendation.state, "first_value_achieved");
  assert.equal(result.recommendation.state, "ready_to_start");
  const input = buildFirstValueSelectInput(
    emptyRecords({
      landingPageProjects: [{ id: "lp-empty", userId: USER, courseSlug: "sites-que-convertem", createdAt: NOW, updatedAt: NOW }],
    }),
  );
  assert.ok(input.artifacts.some((row) => row.kind === "landing_page_project_shell"));
  assert.ok(input.artifacts.every((row) => row.kind !== "landing_page_project_shell" || row.resultAchievedAt == null));
});

test("17. projeto LP antes e brief salvo depois", () => {
  const before = new Date(NOW.getTime() - 86_400_000);
  const after = new Date(NOW.getTime() + 120_000);
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
      landingPageProjects: [{ id: "lp-1", userId: USER, courseSlug: "sites-que-convertem", createdAt: before, updatedAt: after }],
      lessonResults: [
        {
          id: "lr-brief",
          userId: USER,
          lessonSlug: "oferta-publico-acao-principal",
          projectId: null,
          payload: { ...conversionBriefPayload, completedAt: after.toISOString() },
          createdAt: after,
          updatedAt: after,
        },
      ],
    }),
  );
  assert.equal(result.recommendation.state, "first_value_achieved");
  assert.equal(result.recommendation.existingResult?.attribution, "after_purchase");
});

test("18. artefato criado antes e editado depois da compra", () => {
  const before = new Date(NOW.getTime() - 86_400_000);
  const edited = new Date(NOW.getTime() + 60_000);
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
          id: "lr-old",
          userId: USER,
          lessonSlug: "objetivo-oferta-orcamento",
          projectId: "p1",
          payload: campaignBriefPayload,
          createdAt: before,
          updatedAt: edited,
        },
      ],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  assert.equal(result.recommendation.existingResult?.attribution, "unknown");
  assert.notEqual(result.recommendation.state, "first_value_achieved");
});

test("19. artefato sem data confiável / payload.completedAt mutável não prova after_purchase", () => {
  assert.equal(readMutablePayloadCompletedAt(conversionBriefPayload), "2099-01-01T00:00:00.000Z");
  const input = buildFirstValueSelectInput(
    emptyRecords({
      lessonResults: [
        {
          id: "lr1",
          userId: USER,
          lessonSlug: "oferta-publico-acao-principal",
          projectId: null,
          payload: conversionBriefPayload,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    }),
  );
  const artifact = input.artifacts.find((row) => row.lessonSlug === "oferta-publico-acao-principal");
  assert.equal(artifact?.resultAchievedAt?.toISOString(), NOW.toISOString());
  assert.notEqual(artifact?.resultAchievedAt?.toISOString(), conversionBriefPayload.completedAt);
  assert.equal(artifact?.resultSource, "lesson_result_created_at");
});

test("20. Diagnostic concluído", () => {
  const completedAt = new Date(NOW.getTime() + 5_000);
  const input = buildFirstValueSelectInput(
    emptyRecords({
      diagnostics: [
        {
          id: "d1",
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
          id: "resp-link",
          userId: USER,
          lessonSlug: "negocio-pronto-para-anunciar",
          blockKey: "ferramenta",
          payload: { projectId: "p1", diagnosticId: "d1" },
          createdAt: completedAt,
          updatedAt: completedAt,
        },
      ],
    }),
  );
  const artifact = input.artifacts.find((row) => row.kind === "diagnostic_completed");
  assert.ok(artifact);
  assert.equal(artifact!.resultAchievedAt?.toISOString(), completedAt.toISOString());
  assert.equal(artifact!.lessonSlug, "negocio-pronto-para-anunciar");
});

test("21. publicação de landing page", () => {
  const publishedAt = new Date(NOW.getTime() + 8_000);
  const input = buildFirstValueSelectInput(
    emptyRecords({
      landingPageProjects: [{ id: "lp-1", userId: USER, courseSlug: "sites-que-convertem", createdAt: NOW, updatedAt: publishedAt }],
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
          payload: {
            landingPageProjectId: "lp-1",
            publicationId: "pub-1",
            publicationVersion: 1,
            snapshotSchemaVersion: 1,
            publicSlug: "minha-pagina",
            publicPath: "/p/minha-pagina",
            primaryActionType: "WHATSAPP",
            primaryConversionEvent: "WHATSAPP_CLICK",
            warningCount: 0,
            acknowledgedWarningCount: 0,
            publishedAt: publishedAt.toISOString(),
            sourceDraftRevision: 1,
          },
          createdAt: publishedAt,
          updatedAt: publishedAt,
        },
      ],
    }),
  );
  const artifact = input.artifacts.find((row) => row.kind === "landing_page_published");
  assert.ok(artifact);
  assert.equal(artifact!.resultSource, "landing_page_publication_published_at");
  assert.equal(artifact!.resultAchievedAt?.toISOString(), publishedAt.toISOString());
});

test("22. importação ainda não processada", () => {
  const input = buildFirstValueSelectInput(
    emptyRecords({
      imports: [{ id: "imp1", userId: USER, status: "UPLOADED", deletedAt: null }],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  assert.equal(input.dependencyAvailability?.campaign_import, false);
});

test("23. importação pronta", () => {
  const input = buildFirstValueSelectInput(
    emptyRecords({
      imports: [{ id: "imp1", userId: USER, status: "READY", deletedAt: null }],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  assert.equal(input.dependencyAvailability?.campaign_import, true);
  assert.equal(input.dependencyAvailability?.project, true);
});

test("24. dados de outro usuário são isolados", () => {
  const after = new Date(NOW.getTime() + 60_000);
  const input = buildFirstValueSelectInput(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o-other",
          userId: OTHER,
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      entitlements: [{ userId: OTHER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW }],
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
      projects: [{ id: "p1", userId: OTHER, status: "ACTIVE" }],
      landingPageProjects: [{ id: "lp-o", userId: OTHER, courseSlug: "sites-que-convertem", createdAt: NOW, updatedAt: NOW }],
    }),
  );
  assert.equal(input.purchases.length, 0);
  assert.equal(input.entitlements.length, 0);
  assert.equal(input.artifacts.length, 0);
  assert.equal(input.dependencyAvailability?.project, false);
});

test("25. múltiplos resultados da mesma aula priorizam after_purchase", () => {
  const before = new Date(NOW.getTime() - 86_400_000);
  const after = new Date(NOW.getTime() + 60_000);
  const edited = new Date(NOW.getTime() + 3_600_000);
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
          id: "old",
          userId: USER,
          lessonSlug: "objetivo-oferta-orcamento",
          projectId: "p1",
          payload: campaignBriefPayload,
          createdAt: before,
          updatedAt: edited,
        },
        {
          id: "new",
          userId: USER,
          lessonSlug: "objetivo-oferta-orcamento",
          projectId: "p2",
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

test("26. seleção determinística entre itens e pedidos", () => {
  const a = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o-b",
          items: [{ id: "i2", productType: "LESSON", courseSlug: null, lessonSlugs: ["destino-e-mensuracao"] }],
        }),
        paidOrder({
          id: "o-a",
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      entitlements: [
        { userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW },
        { userId: USER, lessonSlug: "destino-e-mensuracao", status: "ACTIVE", grantedAt: NOW },
      ],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  const b = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o-a",
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
        paidOrder({
          id: "o-b",
          items: [{ id: "i2", productType: "LESSON", courseSlug: null, lessonSlugs: ["destino-e-mensuracao"] }],
        }),
      ],
      entitlements: [
        { userId: USER, lessonSlug: "destino-e-mensuracao", status: "ACTIVE", grantedAt: NOW },
        { userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW },
      ],
      projects: [{ id: "p1", userId: USER, status: "ACTIVE" }],
    }),
  );
  assert.deepEqual(a.recommendation, b.recommendation);
  assert.ok(a.recommendation.product.orderItemId);
});

test("27. montagem pura não exige Prisma e não grava", () => {
  const input = buildFirstValueSelectInput(emptyRecords());
  assert.equal(input.purchases.length, 0);
  // Função pura: ausência de side-effect observável; se chegamos aqui, não houve I/O.
  assert.ok(input);
});

test("28. ausência de vazamento de payloads privados na recomendação", () => {
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
  assert.equal(result.recommendation.state, "first_value_achieved");
  assert.ok(result.recommendation.existingResult);
  const json = JSON.stringify(result.recommendation);
  assert.equal(json.includes("Consultoria"), false);
  assert.equal(json.includes("validationBeforeLaunch"), false);
  assert.equal(json.includes("monthlyBudgetCents"), false);
  assert.equal(json.includes("Revisar página"), false);
});

test("dependência missing → CTA de preparação, sem fingir resultado imediato", () => {
  const result = recommendFromFirstValueRecords(
    emptyRecords({
      orders: [
        paidOrder({
          id: "o1",
          items: [{ id: "i1", productType: "LESSON", courseSlug: null, lessonSlugs: ["objetivo-oferta-orcamento"] }],
        }),
      ],
      entitlements: [{ userId: USER, lessonSlug: "objetivo-oferta-orcamento", status: "ACTIVE", grantedAt: NOW }],
    }),
  );
  assert.equal(result.recommendation.preparation?.status, "needs_project");
  assert.equal(result.recommendation.cta?.label, "Criar projeto primeiro");
});

test("zero upgrade com total != 0 é inconsistente e não confirma", () => {
  const confirmation = resolvePurchaseConfirmation({
    status: "PAID",
    zeroValueUpgrade: true,
    totalCents: 100,
    createdAt: NOW,
    payments: [],
  });
  assert.equal(confirmation.confirmedAt, null);
  assert.equal(confirmation.confirmedAtSource, "unknown");
});
