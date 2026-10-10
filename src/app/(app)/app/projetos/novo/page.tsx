import { Container } from "@/components/ui/Container";
import { ProjectForm, emptyProjectForm } from "@/components/project/ProjectForm";

export const metadata = { title: "Novo projeto" };

export default function NewProjectPage() {
  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Projetos</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Novo projeto</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">O nome basta para começar. O restante pode entrar aos poucos.</p>
      <ProjectForm mode="create" defaults={emptyProjectForm} showContext />
    </Container>
  );
}
