import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { StartDiagnosticForm } from "@/components/diagnostic/StartDiagnosticForm";
import { buttonClass, navigationLinkClass } from "@/lib/button-styles";
import { safeReturnPath } from "@/lib/auth/messages";
import { requireSession } from "@/lib/auth/session";
import { QUESTIONS } from "@/lib/diagnostic/definition";
import { newDiagnosticChoices } from "@/lib/diagnostic/center";
import { listActiveProjectsForDiagnostics } from "@/lib/diagnostic/service";

export const metadata = { title: "Novo diagnóstico" };
export const dynamic = "force-dynamic";

export default async function NewDiagnosticPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[]; projeto?: string | string[] }>;
}) {
  const query = await searchParams;
  const returnTo = safeReturnPath(typeof query.returnTo === "string" ? query.returnTo : undefined);
  const requestedProject = typeof query.projeto === "string" ? query.projeto : null;
  const session = await requireSession();
  const { projects, open } = await listActiveProjectsForDiagnostics(session.user.id);
  const openByProject = new Map(open.map((item) => [item.projectId, item.id]));
  const choices = newDiagnosticChoices(projects, openByProject);
  const visible = requestedProject ? choices.filter((choice) => choice.id === requestedProject) : choices;
  const shown = visible.length > 0 ? visible : choices;
  const startable = shown.filter((choice) => choice.mode === "start");
  const continuing = shown.filter((choice) => choice.mode === "continue");
  const createProjectHref = `/app/projetos/novo?returnTo=${encodeURIComponent(returnTo ?? "/app/diagnosticos")}`;
  const continueHref = (href: string) => (returnTo ? `${href}?returnTo=${encodeURIComponent(returnTo)}` : href);

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Diagnósticos</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Novo diagnóstico</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        São {QUESTIONS.length} perguntas. O registro só é criado quando você confirmar o início.
      </p>
      {shown.length === 0 ? (
        <section className="mt-8">
          <p className="text-base leading-relaxed">Para fazer um diagnóstico, primeiro precisamos saber qual negócio você quer analisar.</p>
          <p className="mt-5">
            <Link className={buttonClass("primary")} href={createProjectHref}>
              Criar meu projeto
            </Link>
          </p>
        </section>
      ) : (
        <div className="mt-8 space-y-4">
          {continuing.map((choice, index) => (
            <section key={choice.id} className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-lg font-semibold tracking-tight">{choice.name}</h2>
              <p className="mt-2 text-sm text-muted">Você já tem um diagnóstico em andamento neste projeto.</p>
              {choice.href ? (
                <p className="mt-4">
                  <Link className={index === 0 ? buttonClass("primary") : navigationLinkClass()} href={continueHref(choice.href)}>
                    Continuar diagnóstico
                  </Link>
                </p>
              ) : null}
            </section>
          ))}
          {startable.length === 1 && startable[0] ? (
            <section className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-lg font-semibold tracking-tight">{startable[0].name}</h2>
              <p className="mt-2 text-sm text-muted">Confirme para começar o diagnóstico deste negócio.</p>
              <div className="mt-4">
                <StartDiagnosticForm
                  projectId={startable[0].id}
                  returnTo={returnTo}
                  label="Iniciar diagnóstico"
                  variant={continuing.length > 0 ? "secondary" : "primary"}
                />
              </div>
            </section>
          ) : null}
          {startable.length > 1 ? (
            <div className="space-y-3">
              <p className="text-base font-medium">Escolha o negócio</p>
              {startable.map((choice, index) => (
                <section key={choice.id} className="rounded-xl border border-border bg-surface p-5">
                  <h2 className="text-lg font-semibold tracking-tight">{choice.name}</h2>
                  <div className="mt-4">
                    <StartDiagnosticForm
                      projectId={choice.id}
                      returnTo={returnTo}
                      label="Iniciar diagnóstico"
                      variant={continuing.length === 0 && index === 0 ? "primary" : "secondary"}
                    />
                  </div>
                </section>
              ))}
            </div>
          ) : null}
        </div>
      )}
      <p className="mt-8">
        <Link className={navigationLinkClass()} href="/app/diagnosticos">
          Meus diagnósticos
        </Link>
      </p>
    </Container>
  );
}
