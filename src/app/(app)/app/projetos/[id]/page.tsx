import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { buttonClass } from "@/lib/button-styles";
import { dimensionLabel, knownDimension } from "@/lib/diagnostic/score";
import { formatPriceCents } from "@/lib/learning/money";
import { coverageDays, coverageLabel } from "@/lib/plan/budget";
import { getProjectForUser } from "@/lib/project/service";

export const metadata = { title: "Projeto" };

const OBJECTIVE: Record<string, string> = {
  LEADS: "Receber contatos",
  SALES: "Vender diretamente",
  WHATSAPP: "WhatsApp",
  STORE_VISITS: "Visitas à loja",
  AWARENESS: "Reconhecimento",
  UNDEFINED: "Ainda não definido",
};

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const project = await getProjectForUser(session.user.id, id);
  if (!project) notFound();

  const completed = project.diagnostics.filter((item) => item.status === "COMPLETED");
  const latest = completed[0];
  const inProgress = project.diagnostics.find((item) => item.status === "IN_PROGRESS");
  const bottleneck = knownDimension(latest?.primaryBottleneck);

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Projeto</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{project.name}</h1>
      <p className="mt-2 text-sm text-muted">{project.status === "ARCHIVED" ? "Arquivado" : "Ativo"}</p>
      <dl className="mt-6 space-y-3 text-sm">
        <Context label="Segmento" value={project.segment} />
        <Context label="Oferta" value={project.primaryOffer} />
        <Context label="Objetivo" value={project.objective ? OBJECTIVE[project.objective] : null} />
        <Context label="Orçamento de mídia" value={project.monthlyMediaBudgetCents == null ? null : formatPriceCents(project.monthlyMediaBudgetCents)} />
        <Context label="Site" value={project.websiteUrl} />
      </dl>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link className={buttonClass("primary")} href={`/app/projetos/${project.id}/plano`}>Ver plano vivo</Link>
        {project.status === "ACTIVE" ? (
          <>
            <Link className={buttonClass("secondary")} href={`/app/projetos/${project.id}/plano#acao`}>Adicionar ação</Link>
            <Link className={buttonClass("secondary")} href={`/app/projetos/${project.id}/plano#recarga`}>Planejar recarga</Link>
            <Link className={buttonClass("secondary")} href={`/app/projetos/${project.id}/editar`}>Completar contexto</Link>
            <Link className={buttonClass("secondary")} href={`/app/projetos/${project.id}/diagnostico`}>
              {inProgress ? "Continuar diagnóstico" : latest ? "Fazer novo diagnóstico" : "Fazer diagnóstico"}
            </Link>
          </>
        ) : null}
      </div>
      <p className="mt-4 text-sm text-muted">
        {project.tasks.length === 0 ? "Nenhuma ação aberta." : `${project.tasks.length} ação aberta${project.tasks.length === 1 ? "" : "s"}.`}
        {project.reminders[0] ? ` Próximo lembrete em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(project.reminders[0].remindAt)}.` : ""}
        {project.budgetPlan && coverageDays(project.budgetPlan.currentBalanceCents, project.budgetPlan.plannedDailyBudgetCents) !== null
          ? ` Recarga estimada: ${coverageLabel(coverageDays(project.budgetPlan.currentBalanceCents, project.budgetPlan.plannedDailyBudgetCents) ?? 0)}.`
          : ""}
      </p>
      {latest ? (
        <section className="mt-10 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">Último diagnóstico</h2>
          <p className="mt-2 text-sm text-muted">
            {latest.completedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(latest.completedAt) : "Concluído"}
            {" · "}
            {latest.overallScore ?? "—"}/100
          </p>
          <p className="mt-3 text-base">
            Principal gargalo: <strong>{dimensionLabel(bottleneck)}</strong>
          </p>
          <Link className="mt-4 inline-block text-sm underline underline-offset-4" href={`/app/projetos/${project.id}/diagnosticos/${latest.id}`}>
            Ver resultado
          </Link>
        </section>
      ) : (
        <p className="mt-8 text-base leading-relaxed text-muted">Ainda não há diagnóstico concluído neste projeto.</p>
      )}
      {completed.length > 1 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Histórico</h2>
          <ul className="mt-3 space-y-2">
            {completed.map((item) => (
              <li key={item.id}>
                <Link className="text-sm underline underline-offset-4" href={`/app/projetos/${project.id}/diagnosticos/${item.id}`}>
                  {item.completedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(item.completedAt) : "Diagnóstico"}
                  {" · "}
                  {item.overallScore ?? "—"}/100
                  {" · "}
                  {dimensionLabel(knownDimension(item.primaryBottleneck))}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}

function Context({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value || "Ainda não preenchido"}</dd>
    </div>
  );
}
