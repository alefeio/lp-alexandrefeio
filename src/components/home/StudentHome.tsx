import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { buttonClass } from "@/lib/button-styles";
import type { StudentHomeView } from "@/lib/home/student-home";

export function StudentHome({ view }: { view: StudentHomeView }) {
  return (
    <Container className="max-w-3xl py-12 sm:py-16">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Seu aprendizado</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{view.greeting}</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{view.subtext}</p>

      <section className="mt-10 rounded-lg border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-cta">{view.continue.section}</h2>
        {view.continue.kind === "start" ? (
          <>
            <p className="mt-3 text-lg font-medium">{view.continue.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{view.continue.detail}</p>
          </>
        ) : view.continue.kind === "done" ? (
          <>
            <p className="mt-3 text-lg font-medium">{view.continue.title}</p>
            {view.continue.detail ? (
              <p className="mt-2 text-sm text-muted">
                {view.continue.section === "Curso concluído" ? view.continue.detail : `Próxima: ${view.continue.detail}`}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="mt-3 text-lg font-medium">{view.continue.title}</p>
            <p className="mt-2 text-sm text-muted">{view.continue.detail}</p>
          </>
        )}
        {view.continue.href && view.continue.cta ? (
          <p className="mt-5">
            <Link className={buttonClass("primary", "w-full sm:w-auto")} href={view.continue.href}>
              {view.continue.cta}
              {view.continue.kind === "resume" ? " →" : ""}
            </Link>
          </p>
        ) : null}
      </section>

      {view.nextStep ? (
        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Seu próximo passo</h2>
          <p className="mt-3 text-base leading-relaxed">{view.nextStep.body}</p>
          {view.nextStep.href && view.nextStep.cta ? (
            <p className="mt-4">
              <Link className="text-sm font-medium underline underline-offset-4" href={view.nextStep.href}>
                {view.nextStep.cta}
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Seu progresso</h2>
        <p className="mt-3 text-base">
          {view.progress.completed} {view.progress.completed === 1 ? "aula concluída" : "aulas concluídas"}
          {" · "}
          {view.progress.inProgress} em andamento
          {" · "}
          {view.progress.open} {view.progress.open === 1 ? "aberta" : "abertas"}
        </p>
        <div className="mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={view.progress.percent} aria-label="Aulas concluídas no percurso aberto">
          <div className="h-full bg-cta" style={{ width: `${view.progress.percent}%` }} />
        </div>
        {view.progress.note ? <p className="mt-3 text-sm text-muted">{view.progress.note}</p> : null}
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Seu projeto</h2>
        {view.project ? (
          <div className="mt-3">
            <p className="text-lg font-medium">{view.project.name}</p>
            {view.project.score ? <p className="mt-2 text-sm text-muted">Último diagnóstico: {view.project.score}</p> : null}
            {view.project.bottleneck ? <p className="mt-1 text-sm text-muted">Principal gargalo: {view.project.bottleneck}</p> : null}
            {view.project.recommendation ? <p className="mt-1 text-sm text-muted">Próxima recomendação: {view.project.recommendation}</p> : null}
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <Link className="font-medium underline underline-offset-4" href={view.project.href}>Ver projeto</Link>
              {view.project.allHref ? <Link className="underline underline-offset-4" href={view.project.allHref}>Ver todos os projetos</Link> : null}
            </p>
          </div>
        ) : view.projectEmpty ? (
          <div className="mt-3">
            <p className="text-base leading-relaxed">{view.projectEmpty.body}</p>
            <p className="mt-4">
              <Link className={buttonClass("secondary", "w-full sm:w-auto")} href={view.projectEmpty.href}>{view.projectEmpty.cta}</Link>
            </p>
          </div>
        ) : null}
      </section>

      {view.diagnostic ? (
        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Diagnóstico</h2>
          <p className="mt-3 text-base leading-relaxed">{view.diagnostic.body}</p>
          <p className="mt-4">
            <Link className="text-sm font-medium underline underline-offset-4" href={view.diagnostic.href}>{view.diagnostic.cta}</Link>
          </p>
        </section>
      ) : null}

      {view.tasks ? (
        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Seu plano</h2>
          <ul className="mt-3 space-y-2 text-base">
            {view.tasks.items.map((item, index) => (
              <li key={`${index}-${item}`}>• {item}</li>
            ))}
          </ul>
          <p className="mt-4">
            <Link className="text-sm font-medium underline underline-offset-4" href={view.tasks.href}>{view.tasks.cta}</Link>
          </p>
        </section>
      ) : null}

      {view.reminder ? <p className="mt-8 text-sm text-muted">{view.reminder}</p> : null}

      {view.recommended ? (
        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Conteúdo recomendado para você</h2>
          <p className="mt-3 text-lg font-medium">{view.recommended.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{view.recommended.reason}</p>
          {view.recommended.note ? <p className="mt-2 text-sm text-muted">{view.recommended.note}</p> : null}
          <p className="mt-4">
            <Link className="text-sm font-medium underline underline-offset-4" href={view.recommended.href}>{view.recommended.label}</Link>
          </p>
        </section>
      ) : null}

      <nav aria-label="Atalhos" className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-6 text-sm text-muted">
        {view.shortcuts.map((item) => (
          <Link key={item.href} className="underline underline-offset-4 hover:text-foreground" href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </Container>
  );
}
