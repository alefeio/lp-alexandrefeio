import type { FirstValueRecommendation, FirstValueState } from "@/lib/learning/first-value/types";

/** Estados de UI — espelham o seletor, sem expor `reason` técnico. */
export type FirstValuePresentationState = FirstValueState;

export type FirstValueCardTone = "default" | "celebrate" | "caution" | "muted";

/**
 * ViewModel seguro para o StudentDashboard.
 * Sem orderId, reason, payloads, finanças, subjectUserId ou meta do loader.
 */
export type FirstValueCardViewModel = {
  presentationState: FirstValuePresentationState;
  title: string;
  guidance: string;
  expectedOutcome: string | null;
  cta: { label: string; href: string } | null;
  progressLabel: string | null;
  preparationMessage: string | null;
  /**
   * Destaque visual só com atividade pós-compra elegível/acessível.
   * Avisos `payment_pending` / `access_pending` são informativos (highlight=false).
   */
  highlight: boolean;
  tone: FirstValueCardTone;
};

/** Estados que podem assumir o CTA principal (atividade elegível). */
const HIGHLIGHT_STATES = new Set<FirstValueState>([
  "ready_to_start",
  "in_progress",
  "first_value_achieved",
  "next_evolution",
]);

const PRIVATE_KEY_MARKERS = [
  "orderId",
  "orderItemId",
  "subjectUserId",
  "reason",
  "payload",
  "zeroValueUpgrade",
  "confirmedAt",
  "resultSnapshot",
  "answers",
  "email",
  "password",
  "purchaseCount",
  "artifactCount",
] as const;

function progressLabel(progress: FirstValueRecommendation["progress"]): string | null {
  if (!progress) return null;
  if (progress.completed) return "Atividade concluída";
  if (progress.inProgress && progress.percent != null) return `${progress.percent}% percorrido`;
  if (progress.inProgress) return "Em andamento";
  return null;
}

function safeCta(
  state: FirstValueState,
  cta: FirstValueRecommendation["cta"],
): { label: string; href: string } | null {
  if (!cta?.href || !cta.label) return null;
  if (state === "access_unavailable") {
    // Só CTAs de orientação (pedido / cursos), nunca aula paga.
    if (cta.href.startsWith("/aulas/")) return null;
  }
  return { label: cta.label, href: cta.href };
}

function isCelebratable(rec: FirstValueRecommendation): boolean {
  if (rec.state !== "first_value_achieved" && rec.state !== "next_evolution") return false;
  const existing = rec.existingResult;
  if (!existing) return rec.state === "first_value_achieved" ? false : true;
  if (existing.attribution === "unknown" || existing.resultSource === "unproven") return false;
  if (existing.attribution === "preexisting_edited") return false;
  return Boolean(existing.resultAchievedAt);
}

function resolveHighlight(rec: FirstValueRecommendation, celebratable: boolean): boolean {
  if (rec.state === "first_value_achieved" && !celebratable) return false;
  if (rec.state === "access_unavailable") return false;
  if (rec.state === "continuation") return false;
  return HIGHLIGHT_STATES.has(rec.state);
}

function titlesAndGuidance(rec: FirstValueRecommendation, celebratable: boolean): {
  title: string;
  guidance: string;
  tone: FirstValueCardTone;
  expectedOutcome: string | null;
} {
  const outcome = rec.expectedOutcome ?? rec.activity?.outcome ?? null;
  const prep = rec.preparation?.message ?? null;

  switch (rec.state) {
    case "ready_to_start":
      return {
        title: "Comece sua primeira conquista",
        guidance:
          prep ??
          (outcome
            ? `Nesta atividade você vai produzir: ${outcome}.`
            : "Escolha a atividade da sua compra e produza o primeiro resultado prático."),
        tone: prep ? "caution" : "default",
        expectedOutcome: outcome,
      };
    case "in_progress":
      return {
        title: "Continue sua atividade",
        guidance: outcome
          ? `Você já começou. Retome de onde parou para concluir: ${outcome}.`
          : "Você já começou. Retome de onde parou para concluir o resultado.",
        tone: "default",
        expectedOutcome: outcome,
      };
    case "first_value_achieved":
      if (!celebratable) {
        return {
          title: "Continue avançando",
          guidance: "Há um registro desta atividade, mas ainda não dá para comprovar a primeira conquista neste momento.",
          tone: "muted",
          expectedOutcome: outcome,
        };
      }
      return {
        title: "Seu resultado está pronto",
        guidance: outcome
          ? `Você concluiu: ${outcome}. Revise quando quiser ou siga para a próxima atividade.`
          : "Você concluiu o resultado desta atividade. Revise quando quiser.",
        tone: "celebrate",
        expectedOutcome: outcome,
      };
    case "next_evolution":
      return {
        title: celebratable ? "Próximo passo da sua conquista" : "Continue sua evolução",
        guidance: outcome
          ? `Com o resultado anterior em mãos, o próximo foco útil é: ${outcome}.`
          : "Com o resultado anterior em mãos, avance para a próxima atividade útil.",
        tone: celebratable ? "default" : "muted",
        expectedOutcome: outcome,
      };
    case "continuation":
      return {
        title: "Continue de onde você parou",
        guidance: "Seu progresso anterior já está registrado. Não é preciso recomeçar o onboarding.",
        tone: "muted",
        expectedOutcome: outcome,
      };
    case "access_pending":
      return {
        title: "Seu acesso está sendo preparado",
        guidance: "O pagamento foi reconhecido. Assim que o acesso estiver ativo, você poderá iniciar a atividade.",
        tone: "caution",
        expectedOutcome: null,
      };
    case "payment_pending":
      return {
        title: "Conclua o pagamento para liberar o acesso",
        guidance: "Enquanto o pagamento não for confirmado, o conteúdo pago permanece indisponível.",
        tone: "caution",
        expectedOutcome: null,
      };
    case "access_unavailable":
      return {
        title: "Acesso indisponível no momento",
        guidance: "Não há conteúdo liberado para esta compra agora. Veja seu pedido ou seus cursos para entender o status.",
        tone: "muted",
        expectedOutcome: null,
      };
    default: {
      const _exhaustive: never = rec.state;
      return { title: "Continue aprendendo", guidance: String(_exhaustive), tone: "muted", expectedOutcome: null };
    }
  }
}

/**
 * Adapta a recomendação do domínio para apresentação.
 * Retorna `null` quando não há valor de UI (ex.: aluno sem compra e sem evidência).
 */
export function presentFirstValueRecommendation(rec: FirstValueRecommendation): FirstValueCardViewModel | null {
  const hasPurchaseSignal = Boolean(rec.product.orderId) || Boolean(rec.product.productType);
  if (rec.state === "continuation" && !hasPurchaseSignal && !rec.existingResult && !rec.activity) {
    return null;
  }

  const celebratable = isCelebratable(rec);
  const suppressedCelebration = rec.state === "first_value_achieved" && !celebratable;
  const presentationState: FirstValuePresentationState = suppressedCelebration ? "continuation" : rec.state;
  const effectiveRec: FirstValueRecommendation = suppressedCelebration ? { ...rec, state: "continuation" } : rec;

  const copy = suppressedCelebration
    ? {
        title: "Continue avançando",
        guidance:
          "Há um registro desta atividade, mas ainda não dá para comprovar a primeira conquista neste momento.",
        tone: "muted" as const,
        expectedOutcome: rec.expectedOutcome ?? rec.activity?.outcome ?? null,
      }
    : titlesAndGuidance(effectiveRec, celebratable);

  const preparationMessage =
    rec.preparation && rec.preparation.status !== "ready" ? rec.preparation.message : null;

  return {
    presentationState,
    title: copy.title,
    guidance: copy.guidance,
    expectedOutcome: copy.expectedOutcome,
    cta: safeCta(presentationState, rec.cta),
    progressLabel: progressLabel(rec.progress),
    preparationMessage,
    highlight: resolveHighlight(effectiveRec, celebratable),
    tone: copy.tone,
  };
}

/** True se o ViewModel vazar chaves internas indevidas. */
export function firstValueCardHasPrivateKeys(card: FirstValueCardViewModel): boolean {
  const blob = JSON.stringify(card);
  return PRIVATE_KEY_MARKERS.some((key) => blob.includes(`"${key}"`));
}

function sameDestination(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a === b || a.split("?")[0] === b.split("?")[0];
}

/**
 * Regra de prioridade visual vs LearningBlock.
 * Só omite LearningBlock quando o card first-value está em destaque e aponta para o mesmo destino.
 * Avisos informativos (`payment_pending` / `access_pending`) nunca disparam esta regra.
 */
export function shouldSuppressLearningContinuation(input: {
  firstValue: FirstValueCardViewModel | null | undefined;
  learningHref: string | null | undefined;
}): boolean {
  const card = input.firstValue;
  if (!card?.highlight || !card.cta?.href || !input.learningHref) return false;
  return sameDestination(card.cta.href, input.learningHref);
}

/**
 * Ação legada (`nextAction`) permanece quando o card first-value é apenas informativo.
 * Omite só se há LearningBlock / businessNextAction, ou se o card elegível está em destaque.
 * Duplicação de href com card informativo NÃO remove o legado — omitir o CTA do card
 * via `shouldOmitInformationalFirstValueCta`.
 */
export function shouldSuppressLegacyNextAction(input: {
  firstValue: FirstValueCardViewModel | null | undefined;
  learningPresent: boolean;
  businessPresent: boolean;
  legacyHref?: string | null | undefined;
}): boolean {
  if (input.learningPresent || input.businessPresent) return true;
  const card = input.firstValue;
  if (!card) return false;
  return Boolean(card.highlight);
}

/**
 * Card informativo com o mesmo destino de uma ação útil: manter a mensagem, omitir só o CTA
 * para não restar um botão secondary como único (ou concorrente) link para o destino.
 */
export function shouldOmitInformationalFirstValueCta(input: {
  firstValue: FirstValueCardViewModel | null | undefined;
  learningHref?: string | null;
  businessHref?: string | null;
  legacyHref?: string | null;
  learningPresent: boolean;
  businessPresent: boolean;
  legacyPresent: boolean;
}): boolean {
  const card = input.firstValue;
  if (!card || card.highlight || !card.cta?.href) return false;
  if (input.learningPresent && sameDestination(card.cta.href, input.learningHref)) return true;
  if (input.businessPresent && sameDestination(card.cta.href, input.businessHref)) return true;
  if (input.legacyPresent && sameDestination(card.cta.href, input.legacyHref)) return true;
  return false;
}

/** ViewModel de apresentação com CTA eventualmente omitido por deduplicação. */
export function withOmittableFirstValueCta(
  card: FirstValueCardViewModel,
  omitCta: boolean,
): FirstValueCardViewModel {
  if (!omitCta || !card.cta) return card;
  return { ...card, cta: null };
}
