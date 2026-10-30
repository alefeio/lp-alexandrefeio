import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { buttonClass, navigationLinkClass } from "@/lib/button-styles";
import { requireSession } from "@/lib/auth/session";
import { buildDiagnosticsCenter } from "@/lib/diagnostic/center";
import { listDiagnosticsForUser } from "@/lib/diagnostic/service";

export const metadata = { title: "Meus diagnósticos" };
export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });

export default async function DiagnosticsCenterPage() {
  const session = await requireSession();
  const rows = await listDiagnosticsForUser(session.user.id);
  const cards = buildDiagnosticsCenter(
    rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      projectName: row.project.name,
      status: row.status,
      answers: row.answers,
      completedAt: row.completedAt,
      updatedAt: row.updatedAt,
      resultSnapshot: row.resultSnapshot,
    })),
    (date) => dateFormat.format(date),
  );

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Diagnósticos</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Meus diagnósticos</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        Acompanhe diagnósticos em andamento e consulte os resultados anteriores dos seus projetos.
      </p>
      <p className="mt-6">
        <Link className={buttonClass("primary")} href="/app/diagnosticos/novo">
          Novo diagnóstico
        </Link>
      </p>
      {cards.length === 0 ? (
        <section className="mt-10 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-xl font-semibold tracking-tight">Você ainda não fez nenhum diagnóstico</h2>
          <p className="mt-2 text-base leading-relaxed text-muted">
            Ele mostra o que falta no negócio antes de investir mais em anúncios.
          </p>
          <p className="mt-5">
            <Link className={navigationLinkClass()} href="/app/diagnosticos/novo">
              Fazer meu primeiro diagnóstico
            </Link>
          </p>
        </section>
      ) : (
        <ul className="mt-10 space-y-4">
          {cards.map((card) => (
            <li key={card.id} className="rounded-xl border border-border bg-surface p-5">
              <p className="text-lg font-semibold tracking-tight">{card.projectName}</p>
              <p className="mt-1 text-sm text-muted">{card.name}</p>
              <p className="mt-3 text-sm">
                <span className="font-medium">{card.statusLabel}</span>
                {card.progressLabel ? ` · ${card.progressLabel}` : ""}
                {card.dateLabel ? ` · ${card.dateLabel}` : ""}
              </p>
              {card.score != null ? (
                <p className="mt-2 text-sm text-muted">
                  {card.score}/100
                  {card.bottleneckLabel ? ` · ${card.bottleneckLabel}` : ""}
                </p>
              ) : null}
              <p className="mt-4">
                <Link className={navigationLinkClass()} href={card.href}>
                  {card.cta}
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
