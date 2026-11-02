import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import type { StudyDesk as StudyDeskView, StudyDeskArea } from "@/lib/learning/study-desk";

function areaHref(area: StudyDeskArea): string {
  if (area === "tudo") return "/app/aprendizado/mesa";
  return `/app/aprendizado/mesa?area=${area}`;
}

export function StudyDesk({ desk, area }: { desk: StudyDeskView; area: StudyDeskArea }) {
  const showNotes = area === "tudo" || area === "notas";
  const showReviews = area === "tudo" || area === "revisar";
  const showResources = area === "tudo";

  return (
    <div className="min-w-0">
      <h1 className="text-3xl font-semibold tracking-tight">Mesa de estudo</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
        Tudo o que você guardou durante as aulas, em um só lugar.
      </p>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="O que mostrar">
        {([
          ["tudo", "Tudo"],
          ["notas", `Anotações ${desk.notes.length}`],
          ["revisar", `Para revisar ${desk.reviews.length}`],
        ] as const).map(([value, label]) => (
          <Link
            key={value}
            href={areaHref(value)}
            className={buttonClass(area === value ? "primary" : "secondary")}
            aria-current={area === value ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      {showNotes ? (
        <section className="mt-10" aria-labelledby="mesa-anotacoes">
          <h2 id="mesa-anotacoes" className="text-xl font-semibold tracking-tight">Anotações</h2>
          {desk.notes.length === 0 ? (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
              Você ainda não fez anotações. Durante as aulas, use o campo de anotação para guardar ideias que queira consultar depois.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {desk.notes.map((note) => (
                <li key={note.id} className="min-w-0 rounded-xl border border-border bg-surface p-5">
                  {note.courseTitle ? <p className="text-sm text-muted">{note.courseTitle}</p> : null}
                  <p className="mt-1 font-medium">{note.lessonTitle}</p>
                  {note.sectionTitle ? <p className="mt-2 text-sm">{note.sectionTitle}</p> : null}
                  {note.sectionFallback ? <p className="mt-2 text-sm text-muted">{note.sectionFallback}</p> : null}
                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap break-words text-base leading-relaxed">{note.body}</p>
                  <p className="mt-3 text-sm text-muted">{note.updatedLabel}</p>
                  {note.href ? (
                    <p className="mt-4">
                      <Link className={buttonClass("secondary")} href={note.href} aria-label={note.linkLabel}>
                        Abrir na aula
                      </Link>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {showReviews ? (
        <section className="mt-10" aria-labelledby="mesa-revisar">
          <h2 id="mesa-revisar" className="text-xl font-semibold tracking-tight">Para revisar</h2>
          {desk.reviews.length === 0 ? (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
              Você ainda não marcou nenhum conteúdo para revisar.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {desk.reviews.map((review) => (
                <li key={review.id} className="min-w-0 rounded-xl border border-border bg-surface p-5">
                  {review.courseTitle ? <p className="text-sm text-muted">{review.courseTitle}</p> : null}
                  <p className="mt-1 font-medium">{review.lessonTitle}</p>
                  {review.sectionTitle ? <p className="mt-2 text-sm">{review.sectionTitle}</p> : null}
                  {review.sectionFallback ? <p className="mt-2 text-sm text-muted">{review.sectionFallback}</p> : null}
                  <p className="mt-3 text-sm font-medium">Marcado para revisar</p>
                  <p className="mt-2 text-sm text-muted">{review.updatedLabel}</p>
                  {review.href ? (
                    <p className="mt-4">
                      <Link className={buttonClass("secondary")} href={review.href} aria-label={review.linkLabel}>
                        Abrir na aula
                      </Link>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {showResources ? (
        <section className="mt-10" aria-labelledby="mesa-recursos">
          <h2 id="mesa-recursos" className="text-xl font-semibold tracking-tight">Recursos</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {desk.resources.map((resource) => (
              <li key={resource.href}>
                <Link href={resource.href} className="block min-h-12 rounded-xl border border-border bg-surface p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta">
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
