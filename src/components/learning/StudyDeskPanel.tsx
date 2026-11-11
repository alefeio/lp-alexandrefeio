"use client";

import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { areaHref, type StudyDesk, type StudyDeskArea, type StudyDeskNote, type StudyDeskReview } from "@/lib/learning/study-desk";

export type StudyDeskOpenTarget = {
  lessonSlug: string;
  blockKey: string | null;
  href: string;
};

type Props = {
  desk: StudyDesk;
  area: StudyDeskArea;
  /** Se definido, abas usam botões (modal) em vez de links de rota. */
  onAreaChange?: (area: StudyDeskArea) => void;
  currentLessonSlug?: string | null;
  /** Só para item da aula atual: fecha modal e salta para o bloco. */
  onOpenCurrentLesson?: (target: StudyDeskOpenTarget) => void;
  composer?: React.ReactNode;
  headingLevel?: "h1" | "h2";
  showIntro?: boolean;
};

export function StudyDeskPanel({
  desk,
  area,
  onAreaChange,
  currentLessonSlug = null,
  onOpenCurrentLesson,
  composer,
  headingLevel = "h1",
  showIntro = true,
}: Props) {
  const showNotes = area === "tudo" || area === "notas";
  const showReviews = area === "tudo" || area === "revisar";
  const showResources = area === "tudo";
  const Heading = headingLevel;

  return (
    <div className="min-w-0">
      <Heading className={headingLevel === "h1" ? "text-3xl font-semibold tracking-tight" : "text-xl font-semibold tracking-tight"}>
        Mesa de estudo
      </Heading>
      {showIntro ? (
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
          Tudo o que você guardou durante as aulas, em um só lugar.
        </p>
      ) : null}
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="O que mostrar">
        {([
          ["tudo", "Tudo"],
          ["notas", `Anotações ${desk.notes.length}`],
          ["revisar", `Para revisar ${desk.reviews.length}`],
        ] as const).map(([value, label]) =>
          onAreaChange ? (
            <button
              key={value}
              type="button"
              className={buttonClass(area === value ? "primary" : "secondary")}
              aria-pressed={area === value}
              onClick={() => onAreaChange(value)}
            >
              {label}
            </button>
          ) : (
            <Link
              key={value}
              href={areaHref(value)}
              className={buttonClass(area === value ? "primary" : "secondary")}
              aria-current={area === value ? "page" : undefined}
            >
              {label}
            </Link>
          ),
        )}
      </nav>

      {composer}

      {showNotes ? (
        <section className="mt-10" aria-labelledby="mesa-anotacoes">
          <h2 id="mesa-anotacoes" className="text-xl font-semibold tracking-tight">
            Anotações
          </h2>
          {desk.notes.length === 0 ? (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
              Você ainda não fez anotações. Durante as aulas, use o campo de anotação para guardar ideias que queira consultar depois.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {desk.notes.map((note) => (
                <NoteCard
                  key={`${note.kind}:${note.id}`}
                  note={note}
                  currentLessonSlug={currentLessonSlug}
                  onOpenCurrentLesson={onOpenCurrentLesson}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {showReviews ? (
        <section className="mt-10" aria-labelledby="mesa-revisar">
          <h2 id="mesa-revisar" className="text-xl font-semibold tracking-tight">
            Para revisar
          </h2>
          {desk.reviews.length === 0 ? (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">Você ainda não marcou nenhum conteúdo para revisar.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {desk.reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  currentLessonSlug={currentLessonSlug}
                  onOpenCurrentLesson={onOpenCurrentLesson}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {showResources ? (
        <section className="mt-10" aria-labelledby="mesa-recursos">
          <h2 id="mesa-recursos" className="text-xl font-semibold tracking-tight">
            Recursos
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {desk.resources.map((resource) => (
              <li key={resource.href}>
                <Link
                  href={resource.href}
                  className="block min-h-12 rounded-xl border border-border bg-surface p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
                >
                  <span className="font-medium">{resource.title}</span>
                  <span className="mt-2 block text-sm leading-relaxed text-muted">{resource.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function NoteCard({
  note,
  currentLessonSlug,
  onOpenCurrentLesson,
}: {
  note: StudyDeskNote;
  currentLessonSlug: string | null;
  onOpenCurrentLesson?: (target: StudyDeskOpenTarget) => void;
}) {
  const sameLesson = Boolean(currentLessonSlug && note.lessonSlug === currentLessonSlug && note.href);
  return (
    <li className="min-w-0 rounded-xl border border-border bg-surface p-5">
      {note.courseTitle ? <p className="text-sm text-muted">{note.courseTitle}</p> : null}
      <p className={`font-medium ${note.courseTitle ? "mt-1" : ""}`}>{note.lessonTitle}</p>
      {note.sectionTitle ? <p className="mt-2 text-sm">{note.sectionTitle}</p> : null}
      {note.sectionFallback ? <p className="mt-2 text-sm text-muted">{note.sectionFallback}</p> : null}
      <p className="mt-3 line-clamp-4 whitespace-pre-wrap break-words text-base leading-relaxed">{note.body}</p>
      <p className="mt-3 text-sm text-muted">{note.updatedLabel}</p>
      <NoteActions note={note} sameLesson={sameLesson} onOpenCurrentLesson={onOpenCurrentLesson} />
    </li>
  );
}

function ReviewCard({
  review,
  currentLessonSlug,
  onOpenCurrentLesson,
}: {
  review: StudyDeskReview;
  currentLessonSlug: string | null;
  onOpenCurrentLesson?: (target: StudyDeskOpenTarget) => void;
}) {
  const sameLesson = Boolean(currentLessonSlug && review.lessonSlug === currentLessonSlug && review.href);
  return (
    <li className="min-w-0 rounded-xl border border-border bg-surface p-5">
      {review.courseTitle ? <p className="text-sm text-muted">{review.courseTitle}</p> : null}
      <p className="mt-1 font-medium">{review.lessonTitle}</p>
      {review.sectionTitle ? <p className="mt-2 text-sm">{review.sectionTitle}</p> : null}
      {review.sectionFallback ? <p className="mt-2 text-sm text-muted">{review.sectionFallback}</p> : null}
      <p className="mt-3 text-sm font-medium">Marcado para revisar</p>
      <p className="mt-2 text-sm text-muted">{review.updatedLabel}</p>
      <NoteActions note={review} sameLesson={sameLesson} onOpenCurrentLesson={onOpenCurrentLesson} />
    </li>
  );
}

function NoteActions({
  note,
  sameLesson,
  onOpenCurrentLesson,
}: {
  note: Pick<StudyDeskNote, "href" | "linkLabel" | "lessonSlug" | "blockKey">;
  sameLesson: boolean;
  onOpenCurrentLesson?: (target: StudyDeskOpenTarget) => void;
}) {
  if (!note.href || !note.lessonSlug) return null;
  if (sameLesson && onOpenCurrentLesson) {
    return (
      <p className="mt-4">
        <button
          type="button"
          className={buttonClass("secondary")}
          aria-label={note.linkLabel || "Ir para o trecho nesta aula"}
          onClick={() =>
            onOpenCurrentLesson({
              lessonSlug: note.lessonSlug as string,
              blockKey: note.blockKey,
              href: note.href as string,
            })
          }
        >
          Ir para o trecho
        </button>
      </p>
    );
  }
  return (
    <p className="mt-4">
      <Link className={buttonClass("secondary")} href={note.href} aria-label={note.linkLabel || "Abrir na aula"}>
        Abrir na aula
      </Link>
    </p>
  );
}
