import Link from "next/link";
import { Compass, Flag, Map } from "lucide-react";
import { buttonClass, navigationLinkClass } from "@/lib/button-styles";
import type { ConstructionMap, CourseJourneyView } from "@/lib/learning/course-journey";
import type { CourseMaterial } from "@/lib/learning/course-material";

function ConstructionMapView({ map }: { map: ConstructionMap }) {
  return (
    <div className="mt-6 space-y-6">
      {map.groups.map((group) => (
        <section key={group.id} aria-labelledby={`build-${group.id}`}>
          <h3 id={`build-${group.id}`} className="text-base font-semibold tracking-tight">{group.title}</h3>
          {group.note ? <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">{group.note}</p> : null}
          <div className={group.parallel ? "mt-3 space-y-4" : "mt-3"}>
            {group.tracks.map((track) => (
              <div key={track.id}>
                {group.parallel ? <h4 className="mb-2 text-sm font-medium">{track.title}</h4> : null}
                <ol aria-label={group.parallel ? track.title : group.title} className="flex snap-x snap-mandatory items-stretch gap-2 overflow-x-auto pb-2">
                  {track.artifacts.map((artifact, index) => (
                    <li key={artifact.id} className="flex shrink-0 snap-start items-center gap-2">
                      <Link
                        href={artifact.href}
                        aria-current={artifact.current ? "step" : undefined}
                        className={`flex min-h-24 w-[10.5rem] flex-col justify-between rounded-xl border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta ${
                          artifact.current ? "border-cta bg-cta/10" : "border-border bg-surface"
                        }`}
                      >
                        {artifact.current ? <span className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-cta">Você está aqui</span> : null}
                        <span className="mt-2 text-sm font-semibold leading-snug">{artifact.title}</span>
                        <span className="mt-2 text-xs text-muted">{artifact.statusLabel}</span>
                      </Link>
                      {index < track.artifacts.length - 1 ? <span className="text-sm text-muted" aria-hidden="true">→</span> : null}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function CourseJourney({ view, material = { notes: [], bookmarks: [] } }: { view: CourseJourneyView; material?: CourseMaterial }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Jornada do curso</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">{view.title}</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">{view.promise}</p>
      <p className="mt-4 text-base leading-relaxed">
        <Flag className="mr-2 inline size-4 align-text-bottom text-cta" aria-hidden />
        {view.finalOutcome}
      </p>
      {view.outcomeNote ? <p className="mt-2 text-sm leading-relaxed text-muted">{view.outcomeNote}</p> : null}
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <dt className="text-muted">Módulos publicados</dt>
          <dd className="mt-1 text-lg font-semibold">{view.moduleCount}</dd>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <dt className="text-muted">Aulas publicadas</dt>
          <dd className="mt-1 text-lg font-semibold">{view.publishedLessonCount}</dd>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <dt className="text-muted">Progresso</dt>
          <dd className="mt-1 font-semibold">{view.progressLabel}</dd>
          {view.accessLabel ? <dd className="mt-1 text-muted">{view.accessLabel}</dd> : null}
        </div>
      </dl>
      <p className="mt-3 text-sm">
        <span className="font-medium">{view.statusLabel}</span>
      </p>
      {view.primary ? (
        <p className="mt-6">
          <Link className={buttonClass("primary")} href={view.primary.href}>
            {view.primary.label}
          </Link>
        </p>
      ) : null}

      {view.here ? (
        <section className="mt-10 rounded-xl border border-cta/40 bg-surface p-5" aria-labelledby="here-heading">
          <h2 id="here-heading" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Compass className="size-5 text-cta" aria-hidden />
            Você está aqui
          </h2>
          <p className="mt-3 text-sm text-muted">{view.here.phaseTitle}</p>
          <p className="mt-1 text-lg font-semibold">{view.here.lessonTitle}</p>
          <p className="mt-2 text-base leading-relaxed">{view.here.detail}</p>
          <p className="mt-4">
            <Link className={navigationLinkClass()} href={view.here.href}>
              {view.here.linkLabel}
            </Link>
          </p>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="build-heading">
        <h2 id="build-heading" className="text-xl font-semibold tracking-tight">
          {view.construction ? view.construction.title : "O que você vai construir"}
        </h2>
        {view.construction ? <p className="mt-2 text-sm leading-relaxed text-muted">{view.construction.intro}</p> : null}
        {view.sharedProjectNote ? <p className="mt-2 text-sm leading-relaxed text-muted">{view.sharedProjectNote}</p> : null}
        {view.landing ? <p className="mt-3 text-sm leading-relaxed">{view.landing.label}</p> : null}
        {view.construction ? (
          <ConstructionMapView map={view.construction} />
        ) : (
          <ul className="mt-4 space-y-2">
            {view.artifacts.map((artifact) => (
              <li key={artifact.id} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                <p className="font-medium">{artifact.title}</p>
                <p className="mt-1 text-muted">{artifact.label}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="map-heading">
        <h2 id="map-heading" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Map className="size-5 text-cta" aria-hidden />
          Mapa da jornada
        </h2>
        <ol className="mt-6 space-y-4">
          {view.phases.map((phase) => (
            <li key={phase.id} className="relative pl-6">
              <span className="absolute bottom-0 left-2 top-0 w-px bg-border" aria-hidden />
              <span
                className={`absolute left-[3px] top-5 size-2.5 rounded-full ${phase.current ? "bg-cta" : "bg-border"}`}
                aria-hidden
              />
              <details className="rounded-xl border border-border bg-surface" open={phase.current || undefined}>
                <summary className="cursor-pointer list-none rounded-xl px-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta [&::-webkit-details-marker]:hidden">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Fase {phase.index + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight">{phase.title}</h3>
                  <p className="mt-2 text-sm">
                    <span className="font-medium">{phase.statusLabel}</span>
                    {phase.current ? " · Você está aqui" : ""}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{phase.objective}</p>
                </summary>
                <div className="border-t border-border px-4 py-4">
                  <h4 className="text-sm font-medium">Entregáveis esperados</h4>
                  <ul className="mt-2 space-y-1 text-sm text-muted">
                    {phase.deliverables.map((item, index) => (
                      <li key={`${phase.id}-${index}`}>{item}</li>
                    ))}
                  </ul>
                  {phase.action ? (
                    <p className="mt-4">
                      <Link className={navigationLinkClass()} href={phase.action.href}>
                        {phase.action.label}
                      </Link>
                    </p>
                  ) : null}
                  <h4 className="mt-5 text-sm font-medium">Aulas</h4>
                  <ul className="mt-2 space-y-3">
                    {phase.lessons.map((lesson) => (
                      <li key={lesson.id} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {lesson.title}
                            {lesson.current ? <span className="sr-only">, posição atual</span> : null}
                          </p>
                          <p className="text-sm text-muted">{lesson.statusLabel}</p>
                        </div>
                        <Link className={navigationLinkClass()} href={lesson.href} aria-current={lesson.current ? "step" : undefined}>
                          {lesson.cta}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </li>
          ))}
        </ol>
      </section>

      <details className="mt-10 rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer list-none rounded-xl px-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta [&::-webkit-details-marker]:hidden">
          <h2 className="text-xl font-semibold tracking-tight">Seu material neste curso</h2>
          <p className="mt-1 text-sm text-muted">Notas e marcadores das aulas deste curso.</p>
        </summary>
        <div className="border-t border-border px-4 py-4">
          <h3 className="text-sm font-medium">Notas recentes</h3>
          {material.notes.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nenhuma nota neste curso.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {material.notes.map((note) => (
                <li key={note.id}>
                  <Link className="underline underline-offset-4" href={note.href}>
                    {note.lessonTitle}
                  </Link>
                  {note.sectionTitle ? <p className="mt-1 text-xs text-muted">{note.sectionTitle}</p> : null}
                  <p className="mt-1 text-sm leading-relaxed text-muted">{note.body}</p>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-5 text-sm font-medium">Marcadores</h3>
          {material.bookmarks.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nenhum marcador neste curso.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {material.bookmarks.map((bookmark) => (
                <li key={bookmark.id}>
                  <Link className="underline underline-offset-4" href={bookmark.href}>
                    {bookmark.lessonTitle}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    {bookmark.sectionTitle ? `${bookmark.sectionTitle}. Marcado para revisar.` : "Marcado para revisar."}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      {view.complementary ? (
        <section className="mt-10 border-t border-border pt-8" aria-labelledby="next-course-heading">
          <h2 id="next-course-heading" className="text-xl font-semibold tracking-tight">Continue sua evolução</h2>
          <p className="mt-3 text-base leading-relaxed">{view.complementary.headline}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{view.complementary.body}</p>
          <p className="mt-5">
            <Link className={buttonClass("secondary")} href={view.complementary.href}>
              {view.complementary.cta}
            </Link>
          </p>
          {view.complementary.purchaseHref ? (
            <p className="mt-3">
              <Link className={navigationLinkClass()} href={view.complementary.purchaseHref}>
                Ver detalhes e opções de compra
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
