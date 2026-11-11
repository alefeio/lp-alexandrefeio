"use client";

import { useId, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/lib/button-styles";
import { runPersonalNoteSave } from "@/lib/learning/personal-note-form";
import { savePersonalNote } from "@/lib/learning/personal-notes";

export function PersonalNoteComposer({
  lessonSlug = null,
  blockKey = null,
  defaultLinkToLesson = false,
  noteId = null,
  initialBody = "",
  initialLinked = false,
  onSaved,
  onCancel,
  ariaLabel = "Nova anotação",
}: {
  lessonSlug?: string | null;
  blockKey?: string | null;
  defaultLinkToLesson?: boolean;
  noteId?: string | null;
  initialBody?: string;
  /** Estado inicial do vínculo ao editar (somente exibição; edição padrão preserva vínculo no servidor). */
  initialLinked?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
  ariaLabel?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const bodyId = useId();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState(initialBody);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "error">("ok");
  const editing = Boolean(noteId);
  const canLink = Boolean(lessonSlug) && !editing;
  const [linkToLesson, setLinkToLesson] = useState(Boolean(defaultLinkToLesson && lessonSlug) || initialLinked);

  function submit() {
    if (pending) return;
    const snapshot = body;
    setMessage(null);
    startTransition(async () => {
      const result = await runPersonalNoteSave(savePersonalNote, {
        body: snapshot,
        noteId,
        linkToLessonSlug: !editing && linkToLesson && lessonSlug ? lessonSlug : null,
        blockKey: !editing && linkToLesson && lessonSlug ? blockKey : null,
        updateLink: false,
      });
      if (!result.ok) {
        setTone("error");
        setMessage(result.message);
        setBody(snapshot);
        return;
      }
      setTone("ok");
      setMessage(editing ? "Anotação atualizada." : "Anotação salva.");
      if (!editing) {
        setBody("");
        formRef.current?.reset();
        setLinkToLesson(Boolean(defaultLinkToLesson && lessonSlug));
      }
      onSaved?.();
    });
  }

  return (
    <form
      ref={formRef}
      className="mt-8 rounded-xl border border-border bg-surface px-5 py-5"
      aria-label={ariaLabel}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="text-sm font-medium" htmlFor={bodyId}>
        {editing ? "Editar anotação" : "Nova anotação"}
      </label>
      <textarea
        id={bodyId}
        name="body"
        rows={3}
        required
        maxLength={2000}
        value={body}
        disabled={pending}
        onChange={(event) => setBody(event.target.value)}
        className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-3 text-base leading-relaxed"
        placeholder="Escreva uma ideia para consultar depois."
      />
      {canLink ? (
        <label className="mt-3 flex items-start gap-2 text-sm leading-relaxed">
          <input
            type="checkbox"
            className="mt-1"
            checked={linkToLesson}
            disabled={pending}
            onChange={(event) => setLinkToLesson(event.target.checked)}
          />
          <span>Vincular à aula atual</span>
        </label>
      ) : null}
      {editing && initialLinked ? (
        <p className="mt-3 text-sm text-muted">O vínculo com a aula é preservado ao salvar.</p>
      ) : null}
      {!canLink && !editing ? (
        <p className="mt-3 text-sm text-muted">Esta anotação fica independente de qualquer aula.</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" className={buttonClass("secondary")} disabled={pending || !body.trim()}>
          {pending ? "Salvando…" : editing ? "Salvar alterações" : "Salvar anotação"}
        </button>
        {onCancel ? (
          <button type="button" className="text-sm underline underline-offset-4" disabled={pending} onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
      </div>
      {message ? (
        <p className={`mt-3 text-sm ${tone === "error" ? "text-danger" : "text-foreground"}`} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
