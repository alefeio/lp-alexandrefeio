import { parseBlockData } from "@/lib/learning/blocks";

export type StoredContentBlock = {
  blockKey: string;
  position: number;
  countsForProgress: boolean;
  required: boolean;
  retiredAt: Date | null;
  payload: unknown;
  type: string;
};

export type DesiredContentBlock = {
  blockKey: string;
  position: number;
  countsForProgress: boolean;
  required: boolean;
  data: { type: string; [key: string]: unknown };
};

export type UsedContentPlan =
  | { kind: "replace" }
  | { kind: "skip" }
  | { kind: "append"; keys: string[] }
  | { kind: "stop"; reason: string };

/**
 * Aula sem uso pode ser regravada.
 * Aula com uso para se um bloco existente sairia ou mudaria.
 * Bloco novo, com blockKey novo, pode entrar.
 */
export function planUsedContent(
  existing: StoredContentBlock[],
  desired: DesiredContentBlock[],
  inUse: boolean,
): UsedContentPlan {
  if (!inUse) return { kind: "replace" };
  const active = existing.filter((block) => !block.retiredAt);
  const desiredByKey = new Map(desired.map((block) => [block.blockKey, block]));
  for (const current of active) {
    const next = desiredByKey.get(current.blockKey);
    if (!next) {
      return { kind: "stop", reason: `O bloco ${current.blockKey} seria removido.` };
    }
    if (!sameBlock(current, next)) {
      return { kind: "stop", reason: `O bloco ${current.blockKey} seria reescrito.` };
    }
  }
  const keys = desired.filter((block) => !active.some((current) => current.blockKey === block.blockKey)).map((block) => block.blockKey);
  if (keys.length === 0) return { kind: "skip" };
  return { kind: "append", keys };
}

function sameBlock(current: StoredContentBlock, desired: DesiredContentBlock): boolean {
  if (current.type !== desired.data.type) return false;
  if (current.position !== desired.position || current.countsForProgress !== desired.countsForProgress || current.required !== desired.required) {
    return false;
  }
  return JSON.stringify(parseBlockData(current.payload)) === JSON.stringify(parseBlockData(desired.data));
}
