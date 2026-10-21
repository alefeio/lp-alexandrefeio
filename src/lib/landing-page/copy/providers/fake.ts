import { LANDING_PAGE_LIMITS } from "@/lib/landing-page/constants";
import { LANDING_PAGE_COPY_PROMPT_V1 } from "@/lib/landing-page/copy/constants";
import type { LandingPageCopyContextV1 } from "@/lib/landing-page/copy/context";
import type { LandingPageCopyProvider } from "@/lib/landing-page/copy/providers/provider";

function clip(value: string | undefined, max: number): string | undefined {
  const next = value?.trim().slice(0, max);
  return next ? next : undefined;
}

function pairs(value: string | undefined) {
  return (value ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [title, description] = line.split(" — ");
    return { title: title.trim(), description: (description ?? title).trim() };
  });
}

function safeFor(context: LandingPageCopyContextV1) {
  const facts = context.userProvidedFacts;
  const base = {
    version: 1 as const,
    promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
    sectionId: context.sectionId,
    sectionType: context.sectionType,
    warnings: [],
    missingFacts: [],
  };
  if (context.sectionType === "PROCESS") {
    const steps = pairs(facts.processSteps).map((step) => ({
      title: clip(step.title, LANDING_PAGE_LIMITS.maxShortText),
      description: clip(step.description, LANDING_PAGE_LIMITS.maxMediumText),
    })).filter((step) => step.title && step.description);
    return { ...base, suggestions: [{ id: "fake-process", content: { heading: clip(facts.offerName, LANDING_PAGE_LIMITS.maxHeadline), steps }, rationale: "Esta opção organiza as etapas informadas." }] };
  }
  if (context.sectionType === "TRUST") {
    const items = pairs(facts.trustProofs).map((item) => ({
      title: clip(item.title, LANDING_PAGE_LIMITS.maxShortText),
      description: clip(item.description, LANDING_PAGE_LIMITS.maxMediumText),
    })).filter((item) => item.title && item.description);
    return { ...base, suggestions: [{ id: "fake-trust", content: { heading: "O que dá para mostrar", intro: clip(facts.offerName, LANDING_PAGE_LIMITS.maxMediumText), items }, rationale: "Esta opção organiza a prova informada." }] };
  }
  if (context.sectionType === "FAQ") {
    const items = pairs(facts.objectionAnswers).map((item) => ({
      question: clip(item.title, LANDING_PAGE_LIMITS.maxMediumText),
      answer: clip(item.description, LANDING_PAGE_LIMITS.maxLongText),
    })).filter((item) => item.question && item.answer);
    return { ...base, suggestions: [{ id: "fake-faq", content: { heading: "Dúvidas", items }, rationale: "Esta opção usa as respostas informadas." }] };
  }
  if (context.sectionType === "BENEFITS") {
    return {
      ...base,
      suggestions: [{
        id: "fake-benefit",
        content: {
          heading: clip(facts.offerName, LANDING_PAGE_LIMITS.maxHeadline),
          items: [{ title: clip(facts.primaryBenefit, LANDING_PAGE_LIMITS.maxShortText), description: clip(facts.primaryBenefit, LANDING_PAGE_LIMITS.maxMediumText) }],
        },
        rationale: "Esta opção enfatiza o benefício informado.",
      }],
    };
  }
  if (context.sectionType === "CTA") {
    return {
      ...base,
      suggestions: [{
        id: "fake-cta",
        content: {
          heading: clip(facts.offerName, LANDING_PAGE_LIMITS.maxHeadline),
          ...(clip(facts.primaryBenefit, LANDING_PAGE_LIMITS.maxMediumText) ? { description: clip(facts.primaryBenefit, LANDING_PAGE_LIMITS.maxMediumText) } : {}),
          ...(clip(facts.actionLabel, LANDING_PAGE_LIMITS.maxShortText) ? { buttonLabel: clip(facts.actionLabel, LANDING_PAGE_LIMITS.maxShortText) } : {}),
        },
        rationale: "Esta opção é mais direta.",
      }],
    };
  }
  if (context.sectionType === "FORM") {
    return {
      ...base,
      suggestions: [{
        id: "fake-form",
        content: {
          ...(clip(facts.offerName, LANDING_PAGE_LIMITS.maxHeadline) ? { heading: clip(facts.offerName, LANDING_PAGE_LIMITS.maxHeadline) } : {}),
          ...(clip(facts.actionLabel, LANDING_PAGE_LIMITS.maxShortText) ? { submitLabel: clip(facts.actionLabel, LANDING_PAGE_LIMITS.maxShortText) } : {}),
        },
        rationale: "Esta opção esclarece o envio.",
      }],
    };
  }
  if (context.sectionType === "PROBLEM" || context.sectionType === "SOLUTION") {
    return {
      ...base,
      suggestions: [{
        id: "fake-text",
        content: {
          heading: clip(context.sectionType === "PROBLEM" ? facts.problemOrContext : facts.offerName, LANDING_PAGE_LIMITS.maxHeadline),
          description: clip(context.sectionType === "PROBLEM" ? facts.audience : facts.problemOrContext, LANDING_PAGE_LIMITS.maxMediumText),
        },
        rationale: "Esta opção reorganiza o contexto informado.",
      }],
    };
  }
  return {
    ...base,
    suggestions: [{
      id: "fake-1",
      content: {
        headline: clip(facts.offerName, LANDING_PAGE_LIMITS.maxHeadline),
        ...(clip(facts.audience, LANDING_PAGE_LIMITS.maxSubheadline) ? { subheadline: clip(facts.audience, LANDING_PAGE_LIMITS.maxSubheadline) } : {}),
        ...(clip(facts.actionLabel, LANDING_PAGE_LIMITS.maxShortText) ? { primaryCtaLabel: clip(facts.actionLabel, LANDING_PAGE_LIMITS.maxShortText) } : {}),
      },
      rationale: "Esta opção repete a oferta informada, com foco em clareza.",
    }],
  };
}

export function createFakeCopyProvider(script?: {
  raw?: unknown;
  sequence?: unknown[];
  fail?: "COPY_ASSIST_RATE_LIMITED" | "COPY_ASSIST_PROVIDER_ERROR";
}): LandingPageCopyProvider & { calls: number } {
  let calls = 0;
  return {
    id: "fake",
    modelId: "fake-copy-v1",
    calls: 0,
    async generateCopySuggestion(input) {
      calls += 1;
      this.calls = calls;
      if (script?.fail && !input.repair) return { ok: false, code: script.fail };
      if (script?.sequence) {
        const raw = script.sequence[Math.min(calls, script.sequence.length) - 1];
        return { ok: true, raw };
      }
      if (script?.raw !== undefined) return { ok: true, raw: script.raw };
      return { ok: true, raw: safeFor(input.context) };
    },
  };
}
