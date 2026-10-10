import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { dimensionLabel, knownDimension } from "@/lib/diagnostic/score";
import { continueStudying } from "@/lib/learning/catalog";
import { buttonClass } from "@/lib/button-styles";
import { latestActiveProject } from "@/lib/project/service";

export const metadata: Metadata = {
  title: "Área do aluno",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentHomePage() {
  const session = await requireSession();
  const current = await continueStudying(session.user.id);
  const project = await latestActiveProject(session.user.id);
  const completed = project?.diagnostics.find((item) => item.status === "COMPLETED") ?? null;
  const inProgress = project?.diagnostics.some((item) => item.status === "IN_PROGRESS") ?? false;
  const recommendation = project?.recommendations[0] ?? null;
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
        <div className="mt-6">
          <Link className={buttonClass("primary")} href={resume}>
            Continuar de onde você parou
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-muted">{current.lesson.title}</p>
        </div>
      ) : (
        <p className="mt-4 text-base leading-relaxed text-muted">
          Quando você começar uma aula gratuita, ela aparece aqui.{" "}
          <Link className="underline underline-offset-4" href="/cursos">
            Ver cursos
          </Link>
        </p>
      )}
      <section className="mt-10 border-t border-border pt-8">
        <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Seu próximo passo</h2>
        {!project ? (
          <div className="mt-4">
            <p className="text-base leading-relaxed">Crie um projeto para guardar o contexto do negócio e fazer o diagnóstico.</p>
            <Link className={`${buttonClass("primary")} mt-4`} href="/app/projetos/novo">
              Criar meu primeiro projeto
            </Link>
          </div>
        ) : !completed ? (
          <div className="mt-4">
            <p className="text-base leading-relaxed">
              {project.name} ainda não tem um diagnóstico concluído.
            </p>
            <Link className={`${buttonClass("primary")} mt-4`} href={`/app/projetos/${project.id}/diagnostico`}>
              {inProgress ? "Continuar diagnóstico" : "Fazer diagnóstico"}
            </Link>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-muted">{project.name}</p>
            <p className="mt-2 text-base">
              Prontidão {completed.overallScore ?? "—"}/100. Principal gargalo:{" "}
              <strong>{dimensionLabel(knownDimension(completed.primaryBottleneck))}</strong>
            </p>
            {recommendation ? <p className="mt-2 text-base leading-relaxed">{recommendation.title}</p> : null}
            {inProgress ? (
              <Link className="mt-3 block text-sm underline underline-offset-4" href={`/app/projetos/${project.id}/diagnostico`}>
                Continuar o diagnóstico em andamento
              </Link>
            ) : null}
            <Link className="mt-3 inline-block text-sm underline underline-offset-4" href={`/app/projetos/${project.id}/diagnosticos/${completed.id}`}>
              Ver diagnóstico
            </Link>
          </div>
        )}
      </section>
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
