import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { navigationLinkClass } from "@/lib/button-styles";
import { DiagnosticWizard } from "@/components/diagnostic/DiagnosticWizard";
import { StartDiagnosticForm } from "@/components/diagnostic/StartDiagnosticForm";
import { requireSession } from "@/lib/auth/session";
import { safeReturnPath } from "@/lib/auth/messages";
import { QUESTIONS } from "@/lib/diagnostic/definition";
import { diagnosticAnswerProgress } from "@/lib/diagnostic/center";
import { findInProgressDiagnosticForUser, publicAnswers } from "@/lib/diagnostic/service";
import { getProjectForUser } from "@/lib/project/service";

export const metadata = { title: "Diagnóstico de prontidão" };

export default async function DiagnosticPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const returnTo = safeReturnPath(typeof query.returnTo === "string" ? query.returnTo : undefined);
  const session = await requireSession();
  const project = await getProjectForUser(session.user.id, id);
  if (!project) notFound();
  const diagnostic = await findInProgressDiagnosticForUser(session.user.id, id);
  const backHref = returnTo ?? "/app/diagnosticos";
  const backLabel = returnTo ? "Voltar à aula" : "Meus diagnósticos";

  if (!diagnostic) {
    return (
      <Container className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Diagnóstico de Prontidão para Tráfego</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{project.name}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          São {QUESTIONS.length} perguntas sobre o negócio antes de investir mais em anúncios. Nada é gravado até você iniciar.
        </p>
        {project.status === "ACTIVE" ? (
          <div className="mt-8">
            <StartDiagnosticForm projectId={project.id} returnTo={returnTo} label="Iniciar diagnóstico" />
          </div>
        ) : (
          <p className="mt-6 text-base">Este projeto não está ativo. O histórico continua disponível, mas um diagnóstico novo não começa daqui.</p>
        )}
        <p className="mt-6">
          <Link className={navigationLinkClass()} href={backHref}>
            {backLabel}
          </Link>
        </p>
      </Container>
    );
  }

  const progress = diagnosticAnswerProgress(diagnostic.answers);
  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Diagnóstico de Prontidão para Tráfego</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">O que falta antes de investir mais</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        {project.name}. São {QUESTIONS.length} perguntas. Você pode sair e voltar: as respostas já escolhidas ficam neste projeto.
      </p>
      <p className="mt-2 text-sm text-muted">{progress.label}</p>
      <p className="mt-4">
        <Link className={navigationLinkClass()} href={backHref}>
          {backLabel}
        </Link>
      </p>
      <div className="mt-8">
        <DiagnosticWizard
          projectId={id}
          diagnosticId={diagnostic.id}
          initialAnswers={publicAnswers(diagnostic.answers)}
          initialStep={diagnostic.currentStep}
          returnTo={returnTo}
        />
      </div>
    </Container>
  );
}
