import type { CampaignDiagnosisResult } from "@/lib/learning/campaign-diagnosis";
import type { EvidenceCode, EvidenceStrength, Bottleneck } from "@/lib/campaign-data/diagnosis";
import type { DimensionId } from "@/lib/campaign-data/types";
import type { ObservationDays } from "@/lib/learning/campaign-brief";

export const ACTION_TYPES = ["EXECUTE", "ANALYZE", "WAIT", "LEARN"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

export const ACTION_READINESS = ["ACTION_PLAN_READY", "WAIT_PLAN_READY", "NEEDS_MORE_ANALYSIS"] as const;
export type ActionReadiness = (typeof ACTION_READINESS)[number];

export type EvidenceRef = {
  code: EvidenceCode;
  strength: EvidenceStrength;
  dimension: DimensionId | null;
  entity: string | null;
};

export type ObservationPlan = {
  whatToObserve: string[];
  reviewCondition: string | null;
  suggestedReviewDays: ObservationDays | null;
  doNotChange: string[];
};

export type ActionOption = {
  actionType: ActionType;
  priority: ActionPriority;
  title: string;
  reason: string;
};

export type NextActionPlan = {
  actionType: ActionType;
  priority: ActionPriority;
  title: string;
  reason: string;
  hypothesis: string | null;
  evidenceRefs: EvidenceRef[];
  preconditions: string[];
  observationPlan: ObservationPlan;
  alternatives: ActionOption[];
  caveats: string[];
  readiness: ActionReadiness;
  lessonSlug: string | null;
};

export type ActionContext = {
  observationDays?: ObservationDays | null;
  completedLessonSlugs?: readonly string[];
  objective?: string | null;
};

const FORBIDDEN = /(pause automaticamente|aumente \d+%|reduza \d+%|delete keyword|change bid|turn off)/i;

/**
 * Converte um diagnóstico já calculado em uma próxima ação.
 * Uma ação principal por ciclo. WAIT é válido. Não altera campanha.
 */
export function planNextCampaignAction(diagnosis: CampaignDiagnosisResult, context: ActionContext = {}): NextActionPlan {
  const observationDays = context.observationDays ?? null;
  const completed = new Set(context.completedLessonSlugs ?? []);
  const caveats = [...diagnosis.caveats];
  const refs = evidenceRefs(diagnosis);
  const strong = diagnosis.evidences.find((item) => item.strength === "STRONG" && isDecisive(item.code));
  const moderate = diagnosis.evidences.find((item) => item.strength === "MODERATE" && isDecisive(item.code));
  const missingPeriod = diagnosis.period.start == null && diagnosis.period.end == null;
  const hasLeads = diagnosis.availableMetrics.includes("LEADS");
  const hasQualified = diagnosis.availableMetrics.includes("QUALIFIED_LEADS");
  const hasRevenue = diagnosis.availableMetrics.includes("REVENUE") || diagnosis.availableMetrics.includes("CONVERSION_VALUE");
  const salesObjective = context.objective === "SALES";

  let plan: NextActionPlan;

  if (diagnosis.primaryBottleneck === "INSUFFICIENT_EVIDENCE" || diagnosis.readiness === "INSUFFICIENT_EVIDENCE") {
    if (!diagnosis.availableMetrics.includes("IMPRESSIONS") && !diagnosis.availableMetrics.includes("CLICKS") && !diagnosis.availableMetrics.includes("SPEND")) {
      plan = needsMore(diagnosis, refs, observationDays, "Os dados básicos ainda não permitem um plano de observação útil.");
    } else {
      const extraCaveats = [
        ...caveats,
        missingPeriod ? "O período não está disponível neste arquivo." : null,
        !hasRevenue ? "Sem receita ou valor de conversão, o retorno financeiro não pode ser avaliado com este arquivo." : null,
        hasLeads && !hasQualified ? "Há leads, mas não há lead qualificado neste arquivo." : null,
      ].filter((item): item is string => Boolean(item));
      plan = wait(
        "MEDIUM",
        "Não altere a campanha apenas com os dados atuais",
        "A evidência ainda é limitada. Não há um padrão forte o bastante para justificar uma mudança agora. Esperar com critério é a decisão defensável.",
        refs,
        observationDays,
        [
          "Se o volume de cliques e conversões muda com o tempo",
          "Se algum segmento passa a concentrar gasto sem resultado",
          "Se o próximo arquivo trouxer período e as mesmas métricas-base",
        ],
        "Quando houver um arquivo com período e volume suficiente para comparar segmentos, ou quando aparecer um sinal estrutural claro.",
        [
          "Não pause segmentos só porque um número parece baixo.",
          "Não aumente orçamento sem meta e sem evidência.",
          "Não mude várias coisas ao mesmo tempo.",
        ],
        extraCaveats,
        [
          analyzeOption(
            "Incluir o período ou métricas ausentes no próximo arquivo",
            "Completar período, receita ou qualidade de lead melhora a próxima revisão sem exigir mudança na campanha agora.",
          ),
        ],
      );
    }
  } else if (diagnosis.primaryBottleneck === "MIXED") {
    const primary = strong ?? moderate ?? diagnosis.evidences[0];
    plan = fromEvidence(primary, diagnosis, refs, observationDays, completed, caveats, true);
  } else if (strong || moderate) {
    plan = fromEvidence(strong ?? moderate!, diagnosis, refs, observationDays, completed, caveats, false);
  } else if (diagnosis.primaryBottleneck === "LEAD_QUALITY" && hasLeads && !hasQualified) {
    plan = analyze(
      "MEDIUM",
      "Comece a registrar quais contatos atendem à definição de lead qualificado",
      "Há leads, mas este arquivo não traz lead qualificado. Sem isso, qualidade não pode ser otimizada.",
      refs,
      observationDays,
      ["Definir o que é lead qualificado no negócio.", "Registrar essa marcação no próximo ciclo."],
      ["Quantos leads viram lead qualificado", "Se a origem do contato muda a taxa de qualificação"],
      "Não afirme que o lead está ruim só pelo CPA.",
      caveats,
    );
  } else if (salesObjective && !hasRevenue) {
    plan = analyze(
      "MEDIUM",
      "Inclua receita ou valor de conversão para avaliar retorno",
      "O objetivo aponta para venda, mas este arquivo não traz receita nem valor de conversão suficiente para julgar retorno.",
      refs,
      observationDays,
      ["Exportar valor de conversão ou receita.", "Manter o mesmo projeto."],
      ["Valor gerado por segmento", "Diferença entre conversão e receita"],
      "Não invente ROAS nem pause por ROAS ausente.",
      caveats,
    );
  } else if (shouldLearnMeasurement(diagnosis, completed)) {
    plan = learn(
      "MEDIUM",
      "Revisar destino e mensuração antes de otimizar resultado",
      "Sem uma conversão confiável, mudar anúncio ou orçamento só reinicia o ciclo sem base.",
      refs,
      observationDays,
      "destino-e-mensuracao",
      completed.has("destino-e-mensuracao"),
      caveats,
    );
  } else {
    plan = wait(
      "LOW",
      "Observe mais um ciclo antes de decidir",
      "Há dados, mas nenhum sinal decisivo o bastante para uma mudança principal agora.",
      refs,
      observationDays,
      ["Se aparece gasto material sem resultado", "Se a conversão acompanha o clique", "Se um segmento concentra resultado sem concentrar custo de forma proporcional"],
      "Na próxima revisão com o mesmo projeto e um arquivo atualizado.",
      ["Não faça várias mudanças ao mesmo tempo."],
      caveats,
    );
  }

  assertSafe(plan);
  return plan;
}

function fromEvidence(
  evidence: CampaignDiagnosisResult["evidences"][number],
  diagnosis: CampaignDiagnosisResult,
  refs: EvidenceRef[],
  observationDays: ObservationDays | null,
  completed: Set<string>,
  caveats: string[],
  mixed: boolean,
): NextActionPlan {
  const entity = evidence.entity ? `“${evidence.entity}”` : "este segmento";
  const prefix = mixed ? "Existem outros sinais, mas vamos tratar primeiro este. " : "";

  if (evidence.code === "SEGMENT_WITH_SPEND_NO_RESULT" || evidence.code === "SPEND_WITHOUT_CONVERSIONS") {
    return execute(
      evidence.strength === "STRONG" ? "HIGH" : "MEDIUM",
      `Avalie ${entity} antes de continuar com a mesma proporção de investimento`,
      `${prefix}${evidence.explanation} Isso não é uma ordem automática de pausa. O primeiro passo é entender termos, anúncio e destino deste segmento.`,
      refs,
      observationDays,
      [
        "Conferir se a conversão está sendo registrada.",
        "Revisar a correspondência entre mensagem, destino e intenção deste segmento.",
      ],
      [
        "Se o segmento continua absorvendo gasto sem conversão",
        "Se a correção muda a participação nas conversões",
      ],
      "Se a revisão confirmar incompatibilidade clara, avalie pausar ou redistribuir. A decisão continua com você.",
      [
        "Não pause automaticamente só pelo alerta.",
        "Não aumente orçamento em outro segmento sem observar o efeito desta revisão.",
      ],
      caveats,
      `Se a revisão alinhar intenção, anúncio e destino em ${entity}, esperamos melhorar a eficiência deste gasto.`,
      [
        analyzeOption(
          "Abrir termos de pesquisa ou anúncios deste segmento",
          "Se a dimensão existir, a investigação pode começar pelos termos ou criativos com gasto e sem resultado.",
        ),
      ],
    );
  }

  if (evidence.code === "CLICKS_WITHOUT_CONVERSIONS" || evidence.code === "LOW_RELATIVE_CONVERSION_EFFICIENCY") {
    return analyze(
      evidence.strength === "STRONG" ? "HIGH" : "MEDIUM",
      "Verifique se a página e a conversão definida correspondem à promessa do anúncio",
      `${prefix}${evidence.explanation} Clique sem conversão pode ser destino, CTA, formulário, tracking ou intenção. Não assume erro no anúncio.`,
      refs,
      observationDays,
      ["Conferir destino e evento de conversão.", "Comparar a promessa do anúncio com a página."],
      ["Taxa de conversão depois da verificação", "Se o tracking registra o contato desejado"],
      "Não troque o anúncio antes de confirmar destino e mensuração.",
      caveats,
      shouldLearnMeasurement(diagnosis, completed)
        ? [learnOption("Revisar a aula de destino e mensuração", "Se a conversão ainda não está definida, o bloqueio pode ser de base.")]
        : [
            waitOption(
              "Observar mais um ciclo se a mensuração estiver correta",
              "Se destino e tracking já estão corretos e o volume ainda é baixo, esperar pode ser melhor do que mexer.",
            ),
          ],
      shouldLearnMeasurement(diagnosis, completed) ? "destino-e-mensuracao" : null,
    );
  }

  if (evidence.code === "NO_CLICKS" || evidence.code === "LOW_RELATIVE_TRAFFIC_EFFICIENCY") {
    return analyze(
      "MEDIUM",
      "Revise a correspondência entre mensagem, busca ou público e o anúncio",
      `${prefix}${evidence.explanation} CTR isolado não manda trocar anúncio. A comparação interna só aponta onde investigar.`,
      refs,
      observationDays,
      ["Revisar mensagem e criativo do segmento material.", "Conferir se há termos ou públicos desalinhados."],
      ["Cliques e CTR do segmento frente ao arquivo", "Se a mudança melhora o tráfego sem piorar a conversão"],
      "Não aumente orçamento só porque há impressão sem clique.",
      caveats,
    );
  }

  if (evidence.code === "NO_IMPRESSIONS") {
    return analyze(
      "HIGH",
      "Conferir elegibilidade, aprovação, orçamento e localização da entrega",
      `${prefix}${evidence.explanation} Sem impressão, otimizar conversão ou ROAS não faz sentido.`,
      refs,
      observationDays,
      ["Conferir status de aprovação e limites.", "Conferir localização e elegibilidade."],
      ["Se as impressões voltam a aparecer", "Se o arquivo seguinte registra entrega"],
      "Não aumente orçamento só porque as impressões estão em zero sem causa conhecida.",
      caveats,
    );
  }

  if (evidence.code === "HIGH_RELATIVE_COST") {
    return analyze(
      "MEDIUM",
      "Investigue por que este segmento custa mais por resultado",
      `${prefix}${evidence.explanation} Custo relativo alto pede investigação, não um corte percentual inventado.`,
      refs,
      observationDays,
      ["Comparar intenção e destino do segmento.", "Ver se o volume ainda é estável."],
      ["CPA ou custo por resultado do segmento", "Se a diferença permanece com mais volume"],
      "Não reduza orçamento em X% como regra geral.",
      caveats,
    );
  }

  if (evidence.code === "LOW_RELATIVE_VALUE_EFFICIENCY") {
    return analyze(
      "MEDIUM",
      "Compare segmentos pelo valor gerado, não só pela conversão",
      `${prefix}${evidence.explanation} ROAS ou valor relativo inferior não autoriza pausa automática e não prova prejuízo.`,
      refs,
      observationDays,
      ["Conferir atribuição e ticket.", "Separar conversão de receita quando os dois existirem."],
      ["Valor por segmento", "Se a diferença permanece no próximo ciclo"],
      "Não pause por ROAS baixo sem margem e sem meta.",
      caveats,
    );
  }

  if (evidence.code === "LOW_RELATIVE_LEAD_QUALITY") {
    return analyze(
      "HIGH",
      "Investigue origem, mensagem e qualificação dos contatos deste segmento",
      `${prefix}${evidence.explanation} Lead barato não é automaticamente ruim. A comparação usa lead e lead qualificado.`,
      refs,
      observationDays,
      ["Revisar público e mensagem.", "Conferir o critério de qualificação no atendimento."],
      ["Taxa de qualificação por origem", "Custo por lead qualificado quando existir"],
      "Não otimize por CPA de lead bruto quando a qualidade está no centro da pergunta.",
      caveats,
    );
  }

  return wait(
    "MEDIUM",
    "Observe o próximo ciclo antes de uma mudança principal",
    `${prefix}Há um sinal, mas a evidência ainda não sustenta uma alteração operacional concreta.`,
    refs,
    observationDays,
    ["Se o sinal se mantém com mais volume", "Se aparece um segmento com gasto material e sem resultado"],
    "Quando a força da evidência deixar de ser limitada ou quando faltar só uma verificação objetiva.",
    ["Não faça várias mudanças ao mesmo tempo."],
    caveats,
  );
}

function execute(
  priority: ActionPriority,
  title: string,
  reason: string,
  evidenceRefs: EvidenceRef[],
  observationDays: ObservationDays | null,
  preconditions: string[],
  whatToObserve: string[],
  reviewCondition: string,
  doNotChange: string[],
  caveats: string[],
  hypothesis: string | null,
  alternatives: ActionOption[] = [],
): NextActionPlan {
  return {
    actionType: "EXECUTE",
    priority,
    title,
    reason,
    hypothesis,
    evidenceRefs,
    preconditions,
    observationPlan: {
      whatToObserve,
      reviewCondition,
      suggestedReviewDays: observationDays,
      doNotChange,
    },
    alternatives: alternatives.slice(0, 2),
    caveats,
    readiness: "ACTION_PLAN_READY",
    lessonSlug: null,
  };
}

function analyze(
  priority: ActionPriority,
  title: string,
  reason: string,
  evidenceRefs: EvidenceRef[],
  observationDays: ObservationDays | null,
  preconditions: string[],
  whatToObserve: string[],
  doNotChange: string,
  caveats: string[],
  alternatives: ActionOption[] = [],
  lessonSlug: string | null = null,
): NextActionPlan {
  return {
    actionType: "ANALYZE",
    priority,
    title,
    reason,
    hypothesis: null,
    evidenceRefs,
    preconditions,
    observationPlan: {
      whatToObserve,
      reviewCondition: "Depois da verificação, volte com o mesmo projeto e um arquivo atualizado.",
      suggestedReviewDays: observationDays,
      doNotChange: [doNotChange],
    },
    alternatives: alternatives.slice(0, 2),
    caveats,
    readiness: "ACTION_PLAN_READY",
    lessonSlug,
  };
}

function wait(
  priority: ActionPriority,
  title: string,
  reason: string,
  evidenceRefs: EvidenceRef[],
  observationDays: ObservationDays | null,
  whatToObserve: string[],
  reviewCondition: string,
  doNotChange: string[],
  caveats: string[],
  alternatives: ActionOption[] = [],
): NextActionPlan {
  return {
    actionType: "WAIT",
    priority,
    title,
    reason,
    hypothesis: null,
    evidenceRefs,
    preconditions: ["Manter o mesmo projeto e a mesma fonte de dados na próxima revisão."],
    observationPlan: {
      whatToObserve,
      reviewCondition,
      suggestedReviewDays: observationDays,
      doNotChange,
    },
    alternatives: alternatives.slice(0, 2),
    caveats,
    readiness: "WAIT_PLAN_READY",
    lessonSlug: null,
  };
}

function learn(
  priority: ActionPriority,
  title: string,
  reason: string,
  evidenceRefs: EvidenceRef[],
  observationDays: ObservationDays | null,
  lessonSlug: string,
  alreadyCompleted: boolean,
  caveats: string[],
): NextActionPlan {
  return {
    actionType: "LEARN",
    priority,
    title: alreadyCompleted ? `Revisar a aula de destino e mensuração` : title,
    reason,
    hypothesis: null,
    evidenceRefs,
    preconditions: ["Abrir a aula indicada no mesmo curso.", "Voltar ao arquivo depois de a base estar clara."],
    observationPlan: {
      whatToObserve: ["Se a conversão passa a ser registrada de forma confiável", "Se o próximo arquivo já permite um diagnóstico mais completo"],
      reviewCondition: "Depois de revisar a base de mensuração e gerar um novo arquivo READY.",
      suggestedReviewDays: observationDays,
      doNotChange: ["Não otimize ROAS, CPA ou criativo enquanto a conversão não estiver confiável."],
    },
    alternatives: [
      waitOption(
        "Esperar até configurar a mensuração",
        "Se a configuração ainda não puder ser feita agora, não mexa na campanha só para ocupar o tempo.",
      ),
    ],
    caveats,
    readiness: "ACTION_PLAN_READY",
    lessonSlug,
  };
}

function needsMore(
  diagnosis: CampaignDiagnosisResult,
  refs: EvidenceRef[],
  observationDays: ObservationDays | null,
  reason: string,
): NextActionPlan {
  return {
    actionType: "ANALYZE",
    priority: "HIGH",
    title: "Envie um arquivo READY com métricas-base antes de decidir",
    reason,
    hypothesis: null,
    evidenceRefs: refs,
    preconditions: ["Ter um projeto ativo.", "Enviar um CampaignDataImport READY."],
    observationPlan: {
      whatToObserve: ["Quais métricas-base o próximo arquivo traz", "Se impressões, cliques, custo e conversões existem"],
      reviewCondition: "Quando houver um arquivo READY no mesmo projeto.",
      suggestedReviewDays: observationDays,
      doNotChange: ["Não invente um plano sem dataset."],
    },
    alternatives: [],
    caveats: diagnosis.caveats,
    readiness: "NEEDS_MORE_ANALYSIS",
    lessonSlug: null,
  };
}

function waitOption(title: string, reason: string): ActionOption {
  return { actionType: "WAIT", priority: "MEDIUM", title, reason };
}

function analyzeOption(title: string, reason: string): ActionOption {
  return { actionType: "ANALYZE", priority: "MEDIUM", title, reason };
}

function learnOption(title: string, reason: string): ActionOption {
  return { actionType: "LEARN", priority: "MEDIUM", title, reason };
}

function evidenceRefs(diagnosis: CampaignDiagnosisResult): EvidenceRef[] {
  return diagnosis.evidences.slice(0, 5).map((item) => ({
    code: item.code,
    strength: item.strength,
    dimension: item.dimension,
    entity: item.entity,
  }));
}

function isDecisive(code: EvidenceCode): boolean {
  return (
    code === "NO_IMPRESSIONS" ||
    code === "NO_CLICKS" ||
    code === "CLICKS_WITHOUT_CONVERSIONS" ||
    code === "SPEND_WITHOUT_CONVERSIONS" ||
    code === "LOW_RELATIVE_TRAFFIC_EFFICIENCY" ||
    code === "LOW_RELATIVE_CONVERSION_EFFICIENCY" ||
    code === "HIGH_RELATIVE_COST" ||
    code === "LOW_RELATIVE_VALUE_EFFICIENCY" ||
    code === "SEGMENT_WITH_SPEND_NO_RESULT" ||
    code === "LOW_RELATIVE_LEAD_QUALITY"
  );
}

function shouldLearnMeasurement(diagnosis: CampaignDiagnosisResult, completed: Set<string>): boolean {
  const noConversionData =
    !diagnosis.availableMetrics.includes("CONVERSIONS") &&
    !diagnosis.availableMetrics.includes("LEADS") &&
    diagnosis.availableMetrics.includes("CLICKS");
  return noConversionData && !completed.has("destino-e-mensuracao");
}

function assertSafe(plan: NextActionPlan) {
  const text = [plan.title, plan.reason, plan.hypothesis ?? "", ...plan.alternatives.map((item) => item.title)].join(" ");
  if (FORBIDDEN.test(text)) {
    throw new Error("Plano gerou linguagem operacional proibida.");
  }
  if (/\baumente\b.*\b\d+\s*%/i.test(text) || /\breduza\b.*\b\d+\s*%/i.test(text)) {
    throw new Error("Plano gerou percentual de orçamento inventado.");
  }
}

export function actionTypeLabel(type: ActionType): string {
  if (type === "EXECUTE") return "Executar";
  if (type === "ANALYZE") return "Analisar";
  if (type === "WAIT") return "Esperar";
  return "Aprender";
}

export function bottleneckStageLabel(stage: Bottleneck): string {
  if (stage === "DELIVERY") return "Entrega";
  if (stage === "TRAFFIC") return "Tráfego";
  if (stage === "CONVERSION") return "Conversão";
  if (stage === "LEAD_QUALITY") return "Qualidade do lead";
  if (stage === "REVENUE") return "Receita";
  if (stage === "MIXED") return "Misto";
  return "Evidência insuficiente";
}

export function isCoherentDecision(
  recommendation: Pick<NextActionPlan, "actionType" | "alternatives">,
  chosenType: ActionType,
): boolean {
  if (chosenType === recommendation.actionType) return true;
  return recommendation.alternatives.some((item) => item.actionType === chosenType);
}
