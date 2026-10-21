export const DEFAULT_OPENAI_COPY_MODEL = "gpt-6-luna";

export const COPY_LIVE_PROVIDER_TIMEOUT_MS = 25_000;

export const COPY_ASSIST_RATE_LIMIT = {
  max: 10,
  windowMs: 10 * 60 * 1000,
} as const;

const OUTPUT_TOKENS = {
  HERO: 900,
  PROBLEM: 700,
  SOLUTION: 700,
  BENEFITS: 1000,
  PROCESS: 900,
  TRUST: 700,
  FAQ: 1000,
  CTA: 700,
  FORM: 600,
} as const;

export function resolveCopyModel(env: Record<string, string | undefined> = process.env): string {
  const configured = env.OPENAI_COPY_MODEL?.trim();
  return configured || DEFAULT_OPENAI_COPY_MODEL;
}

export function readOpenAICopyApiKey(env: Record<string, string | undefined> = process.env): string | null {
  const key = env.OPENAI_API_KEY?.trim();
  return key ? key : null;
}

export function copyMaxOutputTokens(sectionType: string): number {
  if (sectionType in OUTPUT_TOKENS) return OUTPUT_TOKENS[sectionType as keyof typeof OUTPUT_TOKENS];
  return 800;
}
