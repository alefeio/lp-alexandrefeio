export type PersonalNoteActionResult =
  | { ok: true; note: { id: string; body: string; lessonId: string | null; blockKey: string | null } }
  | { ok: false; message: string };

export type PersonalNoteSaveInput = {
  body: string;
  noteId?: string | null;
  linkToLessonSlug?: string | null;
  blockKey?: string | null;
  /** Em edição, false (padrão) preserva lessonId/blockKey existentes. */
  updateLink?: boolean;
};

type SaveFn = (input: PersonalNoteSaveInput) => Promise<PersonalNoteActionResult>;

/**
 * Orquestra o save da nota pessoal de forma testável.
 * O caller captura o texto sincronamente e só limpa após sucesso.
 */
export async function runPersonalNoteSave(
  save: SaveFn,
  input: PersonalNoteSaveInput,
): Promise<PersonalNoteActionResult> {
  const body = input.body.trim();
  if (!body) return { ok: false, message: "A nota precisa de texto." };
  return save({
    body,
    noteId: input.noteId ?? null,
    linkToLessonSlug: input.linkToLessonSlug ?? null,
    blockKey: input.blockKey ?? null,
    updateLink: input.updateLink,
  });
}

/** Cláusula de ownership para update/delete — sempre inclui o dono. */
export function personalNoteOwnerWhere(userId: string, noteId: string) {
  return { id: noteId, userId };
}
