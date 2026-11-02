import { resumeStageId, stageContaining, type LessonStage, type StageSourceBlock } from "@/lib/learning/lesson-stages";

const BLOCK_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function hashToken(hash: string): string | null {
  const trimmed = hash.trim();
  const raw = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!raw || raw.length > 82) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!decoded || decoded.length > 82 || !BLOCK_KEY.test(decoded)) return null;
  return decoded;
}

/** Resolve o hash legado (`#bloco`) e o canônico (`#b-bloco`) para um bloco desta aula. */
export function blockKeyFromHash(hash: string, lessonBlockKeys: readonly string[]): string | null {
  const token = hashToken(hash);
  if (!token) return null;
  const keys = new Set(lessonBlockKeys);
  if (keys.has(token)) return token;
  if (token.startsWith("b-")) {
    const canonical = token.slice(2);
    if (canonical && BLOCK_KEY.test(canonical) && keys.has(canonical)) return canonical;
  }
  return null;
}

export function lessonBlockHref(lessonSlug: string, blockKey: string): string {
  return `/aulas/${lessonSlug}#b-${blockKey}`;
}

/** Hash explícito vence a retomada. Sem hash válido, vale a retomada e depois a primeira etapa. */
export function openingStageId<T extends StageSourceBlock>(input: {
  hash: string;
  blockKeys: readonly string[];
  stages: readonly LessonStage<T>[];
  resume: boolean;
  resumeBlockId: string | null;
}): string {
  const key = blockKeyFromHash(input.hash, input.blockKeys);
  const fromHash = key ? stageContaining(input.stages, key)?.id : null;
  if (fromHash) return fromHash;
  if (input.resume && input.resumeBlockId) {
    return resumeStageId(input.stages, input.resumeBlockId) ?? input.stages[0]?.id ?? "";
  }
  return input.stages[0]?.id ?? "";
}
