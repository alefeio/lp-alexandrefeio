import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { buttonClass } from "@/lib/button-styles";
import { continueStudying, learningLists, sectionTitlesFor } from "@/lib/learning/catalog";
import { remainingMinutes } from "@/lib/learning/progress";

export const metadata: Metadata = {
  title: "Aprendizado",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const session = await requireSession();
  const [current, lists] = await Promise.all([continueStudying(session.user.id), learningLists(session.user.id)]);
  const labels = await sectionTitlesFor([
    ...(current?.lastBlockKey ? [{ lessonId: current.lessonId, blockKey: current.lastBlockKey }] : []),
    ...lists.notes.map((note) => ({ lessonId: note.lessonId, blockKey: note.blockKey })),
    ...lists.bookmarks.map((bookmark) => ({ lessonId: bookmark.lessonId, blockKey: bookmark.blockKey })),
  ]);
  const currentSection = current?.lastBlockKey ? labels[`${current.lessonId}:${current.lastBlockKey}`] : undefined;
  const remaining = current ? remainingMinutes(current.lesson.estimatedMinutes, current.percent, false) : null;

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Aprendizado</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Continuar de onde você parou</h1>
      {current ? (
        <section className="mt-6">
          <p>
            <Link className={buttonClass("primary")} href={`/aulas/${current.lesson.slug}?continuar=1`}>
              {current.lesson.title}
            </Link>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {currentSection ? `${currentSection}. ` : ""}
            {current.percent}% do conteúdo percorrido
            {remaining != null ? ` · cerca de ${remaining} min restantes` : ""}
          </p>
        </section>
      ) : (
        <p className="mt-4 text-base leading-relaxed text-muted">
          Quando você começar uma aula gratuita, ela aparece aqui.{" "}
          <Link className="underline underline-offset-4" href="/cursos">
            Ver cursos
          </Link>
        </p>
      )}
      <Section title="Em andamento" empty="Nenhuma aula em andamento.">
        {lists.inProgress.map((item) => (
          <li key={item.id}>
            <Link className="underline underline-offset-4" href={`/aulas/${item.lesson.slug}?continuar=1`}>
              {item.lesson.title}
            </Link>
            <span className="ml-2 text-sm text-muted">{item.percent}% percorrido</span>
          </li>
        ))}
      </Section>
      <Section title="Concluídas" empty="Nenhuma aula concluída.">
        {lists.completed.map((item) => (
          <li key={item.id}>
            <Link className="underline underline-offset-4" href={`/aulas/${item.lesson.slug}`}>
              {item.lesson.title}
            </Link>
          </li>
        ))}
      </Section>
      <Section title="Notas recentes" empty="Nenhuma nota.">
        {lists.notes.map((note) => (
          <li key={note.id}>
            <Link className="underline underline-offset-4" href={`/aulas/${note.lesson.slug}#b-${note.blockKey}`}>
              {note.lesson.title}
            </Link>
            {labels[`${note.lessonId}:${note.blockKey}`] ? (
              <p className="mt-1 text-xs text-muted">{labels[`${note.lessonId}:${note.blockKey}`]}</p>
            ) : null}
            <p className="mt-1 text-sm leading-relaxed text-muted">{note.body}</p>
          </li>
        ))}
      </Section>
      <Section title="Marcadores" empty="Nenhum marcador.">
        {lists.bookmarks.map((bookmark) => (
          <li key={bookmark.id}>
            <Link className="underline underline-offset-4" href={`/aulas/${bookmark.lesson.slug}#b-${bookmark.blockKey}`}>
              {bookmark.lesson.title}
            </Link>
            <p className="mt-1 text-sm text-muted">
              {labels[`${bookmark.lessonId}:${bookmark.blockKey}`]
                ? `${labels[`${bookmark.lessonId}:${bookmark.blockKey}`]}. Marcado para revisar.`
                : "Marcado para revisar."}
            </p>
          </li>
        ))}
      </Section>
    </Container>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const visible = items.filter(Boolean);
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {visible.length === 0 ? <p className="mt-3 text-sm text-muted">{empty}</p> : <ul className="mt-3 space-y-3">{children}</ul>}
    </section>
  );
}
