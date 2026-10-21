import type { CopyMissingFact } from "@/lib/landing-page/copy/constants";
import type { LandingPageCopyContextV1 } from "@/lib/landing-page/copy/context";

const PERFORMANCE_CLAIM = /converte mais|opção vencedora|copy vencedora|garantimos conversão/i;
const MARKUP = /<[^>]+>|```|javascript:/i;

const FORBIDDEN_UNLESS_IN_FACTS: Array<{ pattern: RegExp; stem: RegExp }> = [
  { pattern: /depoimento|nossos clientes|clientes dizem|veja o que os clientes/i, stem: /depoimento|clientes dizem|prova real/i },
  { pattern: /\bclientes?\b/i, stem: /\bclientes?\b/i },
  { pattern: /resultado garantido|garantid[oa]/i, stem: /garant/i },
  { pattern: /certificad[oa]|iso\s*\d|pr[eê]mio/i, stem: /certific|pr[eê]mio|iso/i },
  { pattern: /\bl[ií]der\b|n[ºo°]\s*1\b|melhor do mercado/i, stem: /l[ií]der|melhor do mercado/i },
  { pattern: /\broi\b|faturamento/i, stem: /\broi\b|faturamento/i },
  { pattern: /s[oó] hoje|[uú]ltimas vagas|por tempo limitado/i, stem: /s[oó] hoje|vagas|tempo limitado/i },
  { pattern: /desconto|r\$\s*\d/i, stem: /desconto|r\$/i },
  { pattern: /estrelas|avalia[cç][aã]o/i, stem: /estrelas|avalia/i },
];

function corpusOf(facts: Record<string, string>): string {
  return Object.values(facts).join("\n").toLowerCase();
}

function walkStrings(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") found.push(value);
  else if (Array.isArray(value)) value.forEach((item) => walkStrings(item, found));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => walkStrings(item, found));
  return found;
}

export function claimViolations(content: unknown, facts: Record<string, string>, rationale?: string): string[] {
  const corpus = corpusOf(facts);
  const texts = walkStrings(content);
  if (rationale) texts.push(rationale);
  const violations: string[] = [];
  for (const text of texts) {
    if (MARKUP.test(text)) violations.push("MARKUP");
    if (PERFORMANCE_CLAIM.test(text)) violations.push("PERFORMANCE_PROMISE");
    const percents = text.match(/\d+(?:[.,]\d+)?\s*%/g) ?? [];
    for (const value of percents) {
      if (!corpus.includes(value.replace(/\s/g, "").toLowerCase()) && !corpus.includes(value.toLowerCase())) violations.push("METRIC");
    }
    const numbers = text.match(/\d{2,}/g) ?? [];
    for (const value of numbers) {
      if (!corpus.includes(value)) violations.push("METRIC");
    }
    for (const rule of FORBIDDEN_UNLESS_IN_FACTS) {
      if (rule.pattern.test(text) && !rule.stem.test(corpus)) violations.push("FORBIDDEN_CLAIM");
    }
  }
  return [...new Set(violations)];
}

export function benefitCountAllowed(facts: Record<string, string>): number {
  return facts.primaryBenefit?.trim() ? 1 : 0;
}

export function sectionPreconditions(context: LandingPageCopyContextV1): CopyMissingFact[] {
  const facts = context.userProvidedFacts;
  if (context.sectionType === "PROCESS") return ["PROCESS_STEPS"];
  if (context.sectionType === "TRUST") return ["TRUST_PROOF"];
  if (context.sectionType === "FAQ") {
    const missing: CopyMissingFact[] = ["FAQ_ANSWER"];
    if (/prazo/i.test(facts.objections ?? "")) missing.push("DELIVERY_TIME");
    return missing;
  }
  if (context.sectionType === "BENEFITS" && !facts.primaryBenefit) return ["PRIMARY_BENEFIT"];
  if (context.sectionType === "PROBLEM" && !facts.problemOrContext) return ["PROBLEM_CONTEXT"];
  if (!facts.offerName) return ["OFFER"];
  return [];
}
