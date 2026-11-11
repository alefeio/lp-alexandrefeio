"use client";

import { useState, useTransition } from "react";
import { buttonClass } from "@/lib/button-styles";
import { savePersonalNote } from "@/lib/learning/personal-notes";

export function PersonalNoteComposer({
  lessonSlug = null,
  blockKey = null,
  defaultLinkToLesson = false,
  onSaved,
}: {
  lessonSlug?: string | null;
  blockKey?: string | null;
  defaultLinkToLesson?: boolean;
  onSaved?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [linkToLesson, setLinkToLesson] = useState(Boolean(defaultLinkToLesson && lessonSlug));
  const canLink = Boolean(lessonSlug);

  return (
    <form
      className="mt-8 rounded-xl border border-border bg-surface px-5 py-5"
      aria-label="Nova anotação"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const body = String(form.get("body") ?? "");
        setMessage(null);
        startTransition(async () => {
          const result = await savePersonalNote({
            body,
            linkToLessonSlug: linkToLesson && lessonSlug ? lessonSlug : null,
            blockKey: linkToLesson && lessonSlug ? blockKey : null,
          });
          if (!result.ok) {
            setMessage(result.message);
            return;
          }
          event.currentTarget.reset();
          setLinkToLesson(Boolean(defaultLinkToLesson && lessonSlug));
          onSaved?.();
        });
      }}
    >
      <label className="text-sm font-medium" htmlFor="personal-note-body">
        Nova anotação
      </label>
      <textarea
        id="personal-note-body"
        name="body"
        rows={3}
        required
        maxLength={2000}
        className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-3 text-base leading-relaxed"
        placeholder="Escreva uma ideia para consultar depois."
      />
      {canLink ? (
        <label className="mt-3 flex items-start gap-2 text-sm leading-relaxed">
          <input
            type="checkbox"
            className="mt-1"
            checked={linkToLesson}
            onChange={(event) => setLinkToLesson(event.target.checked)}
          />
          <span>Vincular à aula atual</span>
        </label>
      ) : (
        <p className="mt-3 text-sm text-muted">Esta anotação fica independente de qualquer aula.</p>
      )}
      <div className="mt-4">
        <button type="submit" className={buttonClass("secondary")} disabled={pending}>
          Salvar anotação
        </button>
      </div>
      {message ? (
        <p className="mt-3 text-sm text-danger" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
