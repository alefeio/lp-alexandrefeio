import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { dimensionLabel, knownDimension } from "@/lib/diagnostic/score";
import { continueStudying } from "@/lib/learning/catalog";
import { buttonClass } from "@/lib/button-styles";
import { homeGuidance } from "@/lib/plan/service";

export const metadata: Metadata = {
  title: "Área do aluno",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentHomePage() {
  const session = await requireSession();
  const current = await continueStudying(session.user.id);
  const guidance = await homeGuidance(session.user.id);
  const resume = current?.lastBlockKey
    ? `/aulas/${current.lesson.slug}?continuar=1`
    : current
      ? `/aulas/${current.lesson.slug}`
      : null;

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Conta</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Área do aluno</h1>
      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Continuar estudando</h2>
      {resume && current ? (
        <div className="mt-4">
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
      </section>
      <section className="mt-10 border-t border-border pt-8">
        <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Seu próximo passo</h2>
        {!guidance.projectId ? (
          <div className="mt-4">
            <p className="text-base leading-relaxed">Crie um projeto para guardar o contexto do negócio e fazer o diagnóstico.</p>
            <Link className={`${buttonClass("primary")} mt-4`} href="/app/projetos/novo">
              Criar meu primeiro projeto
            </Link>
          </div>
        ) : guidance.next.kind === "task" ? (
          <div className="mt-4">
            <p className="text-sm text-muted">{guidance.projectName}</p>
            <p className="mt-2 text-base leading-relaxed">{guidance.taskTitle}</p>
            <Link className={`${buttonClass("primary")} mt-4`} href={`/app/projetos/${guidance.projectId}/plano`}>Ver plano vivo</Link>
          </div>
        ) : guidance.next.kind === "recommendation" || guidance.next.kind === "wait" ? (
          <div className="mt-4">
            <p className="text-sm text-muted">{guidance.projectName}</p>
            {guidance.completed ? (
              <p className="mt-2 text-base">
                Prontidão {guidance.completed.overallScore ?? "—"}/100. Principal gargalo:{" "}
                <strong>{dimensionLabel(knownDimension(guidance.completed.primaryBottleneck))}</strong>
              </p>
            ) : null}
            <p className="mt-2 text-base leading-relaxed">{guidance.recommendationTitle ?? "Há uma revisão marcada."}</p>
            <Link className={`${buttonClass("primary")} mt-4`} href={`/app/projetos/${guidance.projectId}/plano`}>Ver plano vivo</Link>
          </div>
        ) : !guidance.completed ? (
          <div className="mt-4">
            <p className="text-base leading-relaxed">{guidance.projectName} ainda não tem um diagnóstico concluído.</p>
            <Link className={`${buttonClass("primary")} mt-4`} href={`/app/projetos/${guidance.projectId}/diagnostico`}>
              {guidance.inProgress ? "Continuar diagnóstico" : "Fazer diagnóstico"}
            </Link>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-muted">{guidance.projectName}</p>
            <p className="mt-2 text-base">
              Prontidão {guidance.completed.overallScore ?? "—"}/100. Principal gargalo:{" "}
              <strong>{dimensionLabel(knownDimension(guidance.completed.primaryBottleneck))}</strong>
            </p>
            <Link className="mt-3 inline-block text-sm underline underline-offset-4" href={`/app/projetos/${guidance.projectId}/plano`}>
              Ver plano vivo
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
