import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ProjectForm, type ProjectFormValues } from "@/components/project/ProjectForm";
import { requireSession } from "@/lib/auth/session";
import { archiveProjectAction } from "@/lib/project/actions";
import { buttonClass } from "@/lib/button-styles";
import { getProjectForUser } from "@/lib/project/service";

export const metadata = { title: "Editar projeto" };

function reais(cents: number | null) {
  if (cents == null) return "";
  const value = cents / 100;
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(".", ",");
}

function tri(value: boolean | null) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "";
}

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const project = await getProjectForUser(session.user.id, id);
  if (!project || project.status !== "ACTIVE") notFound();

  const defaults: ProjectFormValues = {
    name: project.name,
    segment: project.segment ?? "",
    primaryOffer: project.primaryOffer ?? "",
    objective: project.objective ?? "",
    usesGoogleAds: tri(project.usesGoogleAds),
    usesMetaAds: tri(project.usesMetaAds),
    destinationType: project.destinationType ?? "",
    monthlyMediaBudget: reais(project.monthlyMediaBudgetCents),
    averageTicket: reais(project.averageTicketCents),
    websiteUrl: project.websiteUrl ?? "",
    serviceArea: project.serviceArea ?? "",
  };

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Projeto</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Completar contexto</h1>
      <ProjectForm mode="edit" projectId={project.id} defaults={defaults} showContext />
      <form action={archiveProjectAction.bind(null, project.id)} className="mt-10 border-t border-border pt-6">
        <p className="text-sm leading-relaxed text-muted">Arquivar tira o projeto da lista ativa. O histórico permanece na conta.</p>
        <button className={`${buttonClass("secondary")} mt-4`} type="submit">
          Arquivar projeto
        </button>
      </form>
    </Container>
  );
}
