import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { continueStudying } from "@/lib/learning/catalog";
import { buttonClass } from "@/lib/button-styles";

export const metadata: Metadata = {
  title: "Área do aluno",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentHomePage() {
  const session = await requireSession();
  const current = await continueStudying(session.user.id);
  const resume = current?.lastBlockKey
    ? `/aulas/${current.lesson.slug}?continuar=1`
    : current
      ? `/aulas/${current.lesson.slug}`
      : null;

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Conta</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Área do aluno</h1>
      {resume && current ? (
        <p className="mt-6">
          <Link className={buttonClass("primary")} href={resume}>
            Continuar estudando: {current.lesson.title}
          </Link>
        </p>
      ) : (
        <p className="mt-4 text-base leading-relaxed text-muted">
          Quando você começar uma aula gratuita, ela aparece aqui.{" "}
          <Link className="underline underline-offset-4" href="/cursos">
            Ver cursos
          </Link>
        </p>
      )}
      <dl className="mt-8 space-y-3 text-sm">
        <div>
          <dt className="text-muted">Nome</dt>
          <dd className="font-medium">{session.user.name}</dd>
        </div>
        <div>
          <dt className="text-muted">E-mail</dt>
          <dd className="font-medium">{session.user.email}</dd>
        </div>
      </dl>
    </Container>
  );
}
