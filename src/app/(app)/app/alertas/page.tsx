import { readReminderAction, dismissReminderAction } from "@/lib/plan/actions";
import { listAlertsForUser } from "@/lib/plan/service";
import { requireSession } from "@/lib/auth/session";
import { Container } from "@/components/ui/Container";
import { buttonClass } from "@/lib/button-styles";
import Link from "next/link";

export const metadata = { title: "Alertas" };

export default async function AlertsPage() {
  const session = await requireSession();
  const alerts = await listAlertsForUser(session.user.id);

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Alertas</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Lembretes</h1>
      <AlertList title="Para ver agora" items={alerts.due} />
      <AlertList title="Próximos" items={alerts.upcoming} />
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Lidos</h2>
        {alerts.read.length === 0 ? <p className="mt-2 text-sm text-muted">Nenhum lembrete lido.</p> : (
          <ul className="mt-3 space-y-2 text-sm">
            {alerts.read.map((item) => (
              <li key={item.id}>{item.title} · {item.project.name}{item.dismissedAt ? " · dispensado" : ""}</li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}

function AlertList({
  title,
  items,
}: {
  title: string;
  items: { id: string; title: string; remindAt: Date; project: { id: string; name: string }; readAt: Date | null }[];
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length === 0 ? <p className="mt-2 text-sm text-muted">Nada aqui.</p> : (
        <ul className="mt-3 space-y-4">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-border bg-surface p-4">
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.project.name} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(item.remindAt)}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Link className={buttonClass("secondary")} href={`/app/projetos/${item.project.id}/plano`}>Ver plano</Link>
                {!item.readAt ? (
                  <form action={readReminderAction.bind(null, item.id)}>
                    <button className={buttonClass("secondary")} type="submit">Marcar como lido</button>
                  </form>
                ) : null}
                <form action={dismissReminderAction.bind(null, item.id)}>
                  <button className={buttonClass("secondary")} type="submit">Dispensar</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
