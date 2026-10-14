import { LESSON_01_SLUG } from "@/lib/learning/lesson-01";
import { LESSON_02_SLUG } from "@/lib/learning/lesson-02";

const RESULT_KEYS: Record<string, string> = {
  [LESSON_01_SLUG]: "resultado-primeiro-mapa",
  [LESSON_02_SLUG]: "resultado-indicacao-canal",
};

/** O convite aparece depois do resultado principal, só para quem ainda não entrou. Não trava a aula. */
export function shouldOfferSaveProgress(input: {
  slug: string;
  authenticated: boolean;
  completedBlockKeys: readonly string[];
}): boolean {
  if (input.authenticated) return false;
  const key = RESULT_KEYS[input.slug];
  if (!key) return false;
  return input.completedBlockKeys.includes(key);
}

export function saveProgressReturnPath(slug: string): string {
  const key = RESULT_KEYS[slug];
  return key ? `/aulas/${slug}#${key}` : `/aulas/${slug}`;
}

export function lessonAccountNext(slug: string, blockKey: string | null): string {
  if (blockKey && /^[A-Za-z0-9_-]+$/.test(blockKey)) return `/aulas/${slug}#${blockKey}`;
  return `/aulas/${slug}`;
}

/** Aviso discreto no topo da aula gratuita. Não trava leitura, checkpoint, atividade nem resultado local. */
export function showAnonymousStudyCard(input: { authenticated: boolean; preview: boolean; accessType: "FREE" | "PAID" }): boolean {
  return input.accessType === "FREE" && !input.authenticated && !input.preview;
}
