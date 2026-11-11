"use client";

import { useState, useTransition } from "react";
import { PersonalNoteComposer } from "@/components/learning/PersonalNoteComposer";
import { StudyDeskPanel, type StudyDeskOpenTarget } from "@/components/learning/StudyDeskPanel";
import { deletePersonalNote } from "@/lib/learning/personal-notes";
import type { StudyDesk, StudyDeskArea, StudyDeskNote } from "@/lib/learning/study-desk";

type Props = {
  desk: StudyDesk;
  area: StudyDeskArea;
  onAreaChange?: (area: StudyDeskArea) => void;
  currentLessonSlug?: string | null;
  onOpenCurrentLesson?: (target: StudyDeskOpenTarget) => void;
  onReload: () => void;
  composerLessonSlug?: string | null;
  composerDefaultLinkToLesson?: boolean;
  headingLevel?: "h1" | "h2";
  showIntro?: boolean;
};

export function ManagedStudyDesk({
  desk,
  area,
  onAreaChange,
  currentLessonSlug = null,
  onOpenCurrentLesson,
  onReload,
  composerLessonSlug = null,
  composerDefaultLinkToLesson = false,
  headingLevel = "h1",
  showIntro = true,
}: Props) {
  const [editing, setEditing] = useState<StudyDeskNote | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="min-w-0">
      <StudyDeskPanel
        desk={desk}
        area={area}
        onAreaChange={onAreaChange}
        currentLessonSlug={currentLessonSlug}
        onOpenCurrentLesson={onOpenCurrentLesson}
        headingLevel={headingLevel}
        showIntro={showIntro}
        editingPersonalNoteId={editing?.id ?? null}
        personalNoteEditor={
          editing ? (
            <PersonalNoteComposer
              key={editing.id}
              noteId={editing.id}
              initialBody={editing.body}
              initialLinked={Boolean(editing.lessonSlug)}
              ariaLabel="Editar anotação pessoal"
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                onReload();
              }}
            />
          ) : null
        }
        onEditPersonalNote={(note) => {
          setDeleteError(null);
          setEditing(note);
        }}
        onDeletePersonalNote={(note) => {
          if (pending) return;
          if (!window.confirm("Excluir esta anotação pessoal?")) return;
          setDeleteError(null);
          startTransition(async () => {
            const result = await deletePersonalNote(note.id);
            if (!result.ok) {
              setDeleteError(result.message);
              return;
            }
            if (editing?.id === note.id) setEditing(null);
            onReload();
          });
        }}
        composer={
          <PersonalNoteComposer
            lessonSlug={composerLessonSlug}
            defaultLinkToLesson={composerDefaultLinkToLesson}
            onSaved={onReload}
          />
        }
      />
      {deleteError ? (
        <p className="mt-4 text-sm text-danger" role="status">
          {deleteError}
        </p>
      ) : null}
    </div>
  );
}
