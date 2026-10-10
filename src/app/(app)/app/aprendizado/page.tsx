import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { learningLists } from "@/lib/learning/catalog";

export const metadata: Metadata = {
  title: "Aprendizado",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const session = await requireSession();
  const lists = await learningLists(session.user.id);

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Aprendizado</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">O que você já estudou</h1>
      <Section title="Em andamento" empty="Nenhuma aula em andamento.">
        {lists.inProgress.map((item) => (
          <li key={item.id}>
            <Link className="underline underline-offset-4" href={`/aulas/${item.lesson.slug}?continuar=1`}>
              {item.lesson.title}
            </Link>
            <span className="ml-2 text-sm text-muted">{item.percent}%</span>
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
