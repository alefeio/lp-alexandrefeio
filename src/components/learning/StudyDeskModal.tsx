"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { buttonClass } from "@/lib/button-styles";
import { PersonalNoteComposer } from "@/components/learning/PersonalNoteComposer";
import { StudyDeskPanel, type StudyDeskOpenTarget } from "@/components/learning/StudyDeskPanel";
import { fetchStudyDesk } from "@/lib/learning/study-desk-actions";
import type { StudyDesk, StudyDeskArea } from "@/lib/learning/study-desk";

type Props = {
  open: boolean;
  onClose: () => void;
  currentLessonSlug: string;
  onOpenCurrentLesson: (target: StudyDeskOpenTarget) => void;
};

export function StudyDeskModal({ open, onClose, currentLessonSlug, onOpenCurrentLesson }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [desk, setDesk] = useState<StudyDesk | null>(null);
  const [area, setArea] = useState<StudyDeskArea>("tudo");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reload() {
    startTransition(async () => {
      const result = await fetchStudyDesk();
      if (!result.ok) {
        setError(result.message);
        setDesk(null);
        return;
      }
      setError(null);
      setDesk(result.desk);
    });
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      startTransition(async () => {
        const result = await fetchStudyDesk();
        if (!result.ok) {
          setError(result.message);
          setDesk(null);
          return;
        }
        setError(null);
        setDesk(result.desk);
      });
      return;
    }
    if (dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="study-desk-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="study-desk-dialog__sheet">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <p id={titleId} className="min-w-0 pt-1 text-base font-semibold tracking-tight">
            Mesa de estudo
          </p>
          <button type="button" className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border" onClick={onClose}>
            <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">Fechar Mesa de estudo</span>
          </button>
        </div>
        <div className="study-desk-dialog__body px-4 py-5 sm:px-5">
          {error ? (
            <p className="text-sm text-danger" role="status">
              {error}
            </p>
          ) : null}
          {pending && !desk ? <p className="text-sm text-muted">Carregando sua mesa…</p> : null}
          {desk ? (
            <StudyDeskPanel
              desk={desk}
              area={area}
              onAreaChange={setArea}
              currentLessonSlug={currentLessonSlug}
              onOpenCurrentLesson={(target) => {
                onOpenCurrentLesson(target);
                onClose();
              }}
              headingLevel="h2"
              showIntro={false}
              composer={
                <PersonalNoteComposer
                  lessonSlug={currentLessonSlug}
                  defaultLinkToLesson
                  onSaved={reload}
                />
              }
            />
          ) : null}
          {!pending && !desk && !error ? (
            <p className="text-sm text-muted">
              <button type="button" className={buttonClass("secondary")} onClick={reload}>
                Tentar de novo
              </button>
            </p>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
