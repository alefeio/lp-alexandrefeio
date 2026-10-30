import Link from "next/link";
import { Compass, Flag, Map } from "lucide-react";
import { buttonClass, navigationLinkClass } from "@/lib/button-styles";
import type { CourseJourneyView } from "@/lib/learning/course-journey";

export function CourseJourney({ view }: { view: CourseJourneyView }) {
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
        <h2 id="build-heading" className="text-xl font-semibold tracking-tight">O que você vai construir</h2>
        {view.sharedProjectNote ? <p className="mt-2 text-sm leading-relaxed text-muted">{view.sharedProjectNote}</p> : null}
        {view.independenceNote ? <p className="mt-2 text-sm leading-relaxed text-muted">{view.independenceNote}</p> : null}
        {view.landing ? <p className="mt-3 text-sm leading-relaxed">{view.landing.label}</p> : null}
        <ul className="mt-4 space-y-2">
          {view.artifacts.map((artifact) => (
            <li key={artifact.id} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
              <p className="font-medium">{artifact.title}</p>
              <p className="mt-1 text-muted">{artifact.label}</p>
            </li>
          ))}
        </ul>
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
    </div>
  );
}
