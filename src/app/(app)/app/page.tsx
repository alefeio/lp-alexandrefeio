import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { dimensionLabel, knownDimension } from "@/lib/diagnostic/score";
import { studentLearningHome } from "@/lib/learning/catalog";
import { buttonClass } from "@/lib/button-styles";
import { homeGuidance } from "@/lib/plan/service";

export const metadata: Metadata = {
  title: "Área do aluno",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentHomePage() {
  const session = await requireSession();
  const learning = await studentLearningHome(session.user.id);
  const guidance = await homeGuidance(session.user.id);
  const resume = learning.continue.kind === "resume" ? learning.continue.lesson : null;

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Conta</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Área do aluno</h1>
      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Continuar estudando</h2>
      {learning.continue.kind === "resume" && resume ? (
        <div className="mt-4">
          <p className="text-base font-medium">{resume.title}</p>
          <p className="mt-1 text-sm text-muted">{resume.percent}%</p>
          <Link className={`${buttonClass("primary")} mt-4`} href={`/aulas/${resume.slug}?continuar=1`}>
            Continuar
          </Link>
        </div>
      ) : learning.continue.kind === "completed" ? (
        <div className="mt-4">
          <p className="text-base leading-relaxed">{learning.continue.headline}</p>
          {learning.continue.next ? (
            <div className="mt-4">
              <p className="text-sm text-muted">Próxima recomendação:</p>
              <p className="mt-1 text-base font-medium">{learning.continue.next.title}</p>
              <Link className={`${buttonClass("primary")} mt-4`} href={`/aulas/${learning.continue.next.slug}`}>
                Continuar curso
              </Link>
            </div>
          ) : null}
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
      {learning.learning.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Meu aprendizado</h2>
          <ul className="mt-4 space-y-4">
            {learning.learning.map((item) => (
              <li key={`${item.status}-${item.slug}`}>
                <p className="font-medium">{item.title}</p>
                {item.status === "completed" ? (
                  <p className="mt-1 text-sm text-muted">
                    ✓ Concluída ·{" "}
                    <Link className="underline underline-offset-4" href={`/aulas/${item.slug}`}>
                      Revisar aula
                    </Link>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted">
                    {item.percent}% ·{" "}
                    <Link className="underline underline-offset-4" href={`/aulas/${item.slug}?continuar=1`}>
                      Continuar
                    </Link>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
