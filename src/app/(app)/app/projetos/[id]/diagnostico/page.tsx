import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { DiagnosticWizard } from "@/components/diagnostic/DiagnosticWizard";
import { requireSession } from "@/lib/auth/session";
import { publicAnswers } from "@/lib/diagnostic/service";
import { resumeDiagnosticForUser } from "@/lib/diagnostic/service";

export const metadata = { title: "Diagnóstico de prontidão" };

export default async function DiagnosticPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const diagnostic = await resumeDiagnosticForUser(session.user.id, id);
  if (!diagnostic) notFound();

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Diagnóstico de Prontidão para Tráfego</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">O que falta antes de investir mais</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        São 15 perguntas. Você pode sair e voltar: as respostas já escolhidas ficam neste projeto.
      </p>
      <div className="mt-8">
        <DiagnosticWizard
          projectId={id}
          diagnosticId={diagnostic.id}
          initialAnswers={publicAnswers(diagnostic.answers)}
          initialStep={diagnostic.currentStep}
        />
      </div>
    </Container>
  );
}
