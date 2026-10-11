import { z } from "zod";
import { blockKeySchema, lessonBlockDataSchema, type LessonBlockData } from "@/lib/learning/blocks";

export const LESSON_DOCUMENT_VERSION = 1;

export const lessonDocumentSchema = z.object({
  schemaVersion: z.literal(LESSON_DOCUMENT_VERSION),
  lessonId: z.string().min(1),
  blocks: z
    .array(
      z.object({
        blockKey: blockKeySchema(),
        position: z.number().int().min(0).max(999),
        countsForProgress: z.boolean().optional(),
        required: z.boolean().optional(),
        data: lessonBlockDataSchema,
      }),
    )
    .max(80),
});

export type LessonDocument = z.infer<typeof lessonDocumentSchema>;

export type StoredBlock = {
  blockKey: string;
  type: LessonBlockData["type"];
  position: number;
  retiredAt: Date | string | null;
};

export function inspectLessonDocument(raw: unknown, lessonId: string, current: StoredBlock[]) {
  const parsed = lessonDocumentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: "O JSON não segue o formato da aula.", issues: ["Confira schemaVersion, lessonId e os blocos."] };
  if (parsed.data.lessonId !== lessonId) return { ok: false as const, message: "Este arquivo é de outra aula.", issues: ["O lessonId não confere."] };
  const keys = parsed.data.blocks.map((block) => block.blockKey);
  if (new Set(keys).size !== keys.length) return { ok: false as const, message: "Há chaves repetidas no arquivo.", issues: ["Cada blockKey precisa ser único."] };
  const active = new Map(current.filter((block) => !block.retiredAt).map((block) => [block.blockKey, block]));
  const issues: string[] = [];
  let creates = 0;
  let updates = 0;
  for (const block of parsed.data.blocks) {
    const existing = active.get(block.blockKey);
    if (!existing) {
      creates += 1;
      continue;
    }
    if (existing.type !== block.data.type) issues.push(`A chave ${block.blockKey} já existe com outro tipo. Aposente o bloco e crie outro.`);
    else updates += 1;
  }
  const included = new Set(keys);
  const untouched = [...active.keys()].filter((key) => !included.has(key));
  return { ok: issues.length === 0, message: issues[0] ?? "Arquivo válido. Nada foi gravado ainda.", issues, creates, updates, untouched, document: parsed.data };
}
