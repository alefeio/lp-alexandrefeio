import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { buttonClass } from "@/lib/button-styles";
import { listProjectsForUser } from "@/lib/project/service";

export const metadata = { title: "Projetos" };

export default async function ProjectsPage() {
  const session = await requireSession();
  const projects = await listProjectsForUser(session.user.id);
  const active = projects.filter((project) => project.status === "ACTIVE");
  const archived = projects.filter((project) => project.status === "ARCHIVED");

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Projetos</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Seus projetos</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        Cada projeto guarda o contexto de um negócio. O diagnóstico usa esse contexto para apontar o próximo passo.
      </p>
      <Link className={`${buttonClass("primary")} mt-6`} href="/app/projetos/novo">
        {active.length === 0 ? "Criar meu primeiro projeto" : "Novo projeto"}
      </Link>
      <ul className="mt-8 space-y-3">
        {active.map((project) => (
          <li key={project.id}>
            <Link href={`/app/projetos/${project.id}`} className="block rounded-lg border border-border bg-surface px-4 py-4">
              <span className="font-medium">{project.name}</span>
              {project.segment ? <span className="mt-1 block text-sm text-muted">{project.segment}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      {archived.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-muted">Arquivados</h2>
          <ul className="mt-3 space-y-2">
            {archived.map((project) => (
              <li key={project.id}>
                <Link href={`/app/projetos/${project.id}`} className="text-sm underline underline-offset-4">
                  {project.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}
