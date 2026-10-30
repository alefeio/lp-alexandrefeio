import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { DIAGNOSTIC_RESULT_TITLE } from "@/lib/diagnostic/center";
import { DIMENSIONS, DIMENSION_LABEL, type Dimension } from "@/lib/diagnostic/definition";
import { dimensionLabel, resultSnapshotSchema } from "@/lib/diagnostic/score";
import { getDiagnosticForUser } from "@/lib/diagnostic/service";
import { RecommendationPlanButton } from "@/components/plan/PlanForms";
import { ReturnToLesson } from "@/components/app/ReturnToLesson";
import { navigationLinkClass } from "@/lib/button-styles";
import { safeReturnPath } from "@/lib/auth/messages";

export const metadata = { title: "Resultado do diagnóstico" };

function asDimension(value: string | null | undefined): Dimension | null {
  return DIMENSIONS.includes(value as Dimension) ? (value as Dimension) : null;
}

export default async function DiagnosticResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; diagnosticId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id, diagnosticId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const diagnostic = await getDiagnosticForUser(session.user.id, id, diagnosticId);
  if (!diagnostic || diagnostic.status !== "COMPLETED") notFound();
  const snapshot = resultSnapshotSchema.safeParse(diagnostic.resultSnapshot);
  if (!snapshot.success) notFound();
  const result = snapshot.data;
  const bottleneck = asDimension(result.primaryBottleneck);
  const completedLabel = diagnostic.completedAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(diagnostic.completedAt)
    : null;
  const back = safeReturnPath(query.returnTo);

  return (
    <Container className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">{diagnostic.project.name}</h1>
      <p className="mt-2 text-base">{DIAGNOSTIC_RESULT_TITLE}</p>
      <p className="mt-1 text-sm text-muted">Concluído{completedLabel ? ` em ${completedLabel}` : ""}</p>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight">Principal gargalo: {dimensionLabel(bottleneck)}</h2>
      <p className="mt-4 text-base leading-relaxed">
        Próximo passo: <strong>{result.nextStepTitle}</strong>
      </p>
      <p className="mt-2 text-base leading-relaxed text-muted">{result.nextStepDescription}</p>
      <p className="mt-4 text-sm text-muted">
        {result.overallScore}/100. {result.bandLabel}
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Pontos fortes</h2>
        <p className="mt-2 text-base">{result.strengths.length ? result.strengths.map((item) => DIMENSION_LABEL[item]).join(", ") : "Nenhuma dimensão chegou a 80 nesta versão."}</p>
      </section>
      <section className="mt-6">
        <h2 className="text-lg font-semibold">Pontos de atenção</h2>
        <p className="mt-2 text-base">{result.attention.length ? result.attention.map((item) => DIMENSION_LABEL[item]).join(", ") : "Nenhum ponto extra abaixo de 60, além do gargalo principal."}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Notas por dimensão</h2>
        <ul className="mt-4 space-y-3">
          {DIMENSIONS.map((dimension) => {
            const score = result.dimensionScores[dimension];
            return (
              <li key={dimension}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{DIMENSION_LABEL[dimension]}</span>
                  <span>{score}/100</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-border" aria-hidden="true">
                  <div className="h-2 rounded-full bg-foreground" style={{ width: `${score}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Indicação inicial</h2>
        <p className="mt-2 text-base leading-relaxed">{result.channelExplanation}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Conteúdo recomendado</h2>
        <ul className="mt-3 space-y-3">
          {diagnostic.recommendations.map((item) => (
            <li key={item.id} className="rounded-lg border border-border bg-surface p-4">
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{item.description}</p>
              <RecommendationPlanButton projectId={id} recommendationId={item.id} type={item.type} already={item.tasks.length > 0} />
              {item.lesson && item.lesson.status === "PUBLISHED" ? (
                <p className="mt-3 text-sm">
                  <Link className="underline underline-offset-4" href={`/aulas/${item.lesson.slug}`}>
                    {item.lesson.title}
                  </Link>
                  {item.lesson.accessType === "PAID" && item.lesson.commerceStatus !== "AVAILABLE" ? (
                    <span className="text-muted"> · Disponível em breve</span>
                  ) : null}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <ReturnToLesson returnTo={query.returnTo} fallbackHref={`/app/projetos/${id}`} fallbackLabel="Voltar ao projeto" />
      <p className="mt-3">
        <Link className={navigationLinkClass()} href="/app/diagnosticos">
          Meus diagnósticos
        </Link>
      </p>
      <p className="mt-1">
        <Link className={navigationLinkClass()} href={`/app/diagnosticos/novo?projeto=${id}${back ? `&returnTo=${encodeURIComponent(back)}` : ""}`}>
          Fazer novo diagnóstico
        </Link>
      </p>
    </Container>
  );
}
