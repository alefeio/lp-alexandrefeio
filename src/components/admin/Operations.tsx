import Link from "next/link";
import type { ReactNode } from "react";
import {
  ADMIN_FILTER_LABEL,
  ADMIN_FILTERS,
  EMPTY_ACCESS,
  EMPTY_PROJECTS,
  EMPTY_PURCHASES,
  LAST_ACTIVITY_NOTE,
  adminUsersHref,
  formatAdminDate,
  type AdminFilter,
} from "@/lib/admin/operations";
import type { loadAdminUser, loadAdminUsers } from "@/lib/admin/load-operations";
import { formatPriceCents } from "@/lib/learning/money";

type UserList = Awaited<ReturnType<typeof loadAdminUsers>>;
type UserDetail = NonNullable<Awaited<ReturnType<typeof loadAdminUser>>>;

const ORDER_STATUS: Record<string, string> = {
  PENDING_PAYMENT: "Pendente",
  PAID: "Pago",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  NEEDS_REVIEW: "Em revisão",
};

const TASK_STATUS: Record<string, string> = {
  TODO: "A fazer",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
};

const TASK_SOURCE: Record<string, string> = {
  USER: "Usuário",
  DIAGNOSTIC: "Diagnóstico",
  LESSON: "Aula",
  PLANNING: "Planejamento",
  SYSTEM: "Sistema",
};

const PAYMENT_STATUS: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROCESS: "Em processamento",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  PARTIALLY_REFUNDED: "Parcialmente reembolsado",
  CHARGED_BACK: "Chargeback",
};

function Status({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded border border-border px-2 py-0.5 text-xs">{children}</span>;
}

export function OverviewGrid({
  cards,
}: {
  cards: ReadonlyArray<{ group: string; label: string; value: string | number }>;
}) {
  return (
    <ul className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
      {cards.map((card) => (
        <li key={`${card.group}-${card.label}`} className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{card.group}</p>
          <p className="mt-2 text-sm">{card.label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            {card.label === "Receita recebida" ? formatPriceCents(Number(card.value)) : card.value}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function FunnelCounts({
  funnel,
}: {
  funnel: { registered: number; startedLesson: number; completedLesson: number; completedDiagnostic: number; purchased: number };
}) {
  const steps = [
    ["Cadastrados", funnel.registered],
    ["Iniciaram aula", funnel.startedLesson],
    ["Concluíram aula", funnel.completedLesson],
    ["Fizeram diagnóstico", funnel.completedDiagnostic],
    ["Compraram", funnel.purchased],
  ] as const;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Jornada</h2>
      <ol className="mt-4 flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center">
        {steps.map(([label, count], index) => (
          <li key={label} className="flex items-center gap-2">
            {index > 0 ? <span className="hidden text-muted sm:inline">→</span> : null}
            <span className="rounded-lg border border-border px-3 py-2">
              {label} <strong>{count}</strong>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Cada etapa conta pessoas distintas. Iniciaram aula tem progresso em alguma aula. Concluíram aula tem ao menos uma aula com data de conclusão. Fizeram diagnóstico tem um diagnóstico concluído. Compraram tem um pedido pago. Sem percentual.
      </p>
    </section>
  );
}

export function UserFilters({ filter, search }: { filter: AdminFilter; search: string }) {
  return (
    <div className="mt-8 flex flex-col gap-4">
      <form action="/admin/usuarios" className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="busca-usuario">Buscar por nome ou e-mail</label>
        <input
          id="busca-usuario"
          name="q"
          defaultValue={search}
          placeholder="Nome ou e-mail"
          className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
        {filter !== "todos" ? <input type="hidden" name="filtro" value={filter} /> : null}
        <button type="submit" className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-white">Buscar</button>
      </form>
      <nav className="flex flex-wrap gap-2 text-sm">
        {ADMIN_FILTERS.map((item) => (
          <Link
            key={item}
            href={adminUsersHref({ filter: item, search })}
            className={item === filter ? "rounded-md bg-foreground px-3 py-1.5 text-background" : "rounded-md border border-border px-3 py-1.5"}
            aria-current={item === filter ? "page" : undefined}
          >
            {ADMIN_FILTER_LABEL[item]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function UserTable({ list }: { list: UserList }) {
  return (
    <>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              {["Nome", "E-mail", "Verificado", "Cadastro", "Última atividade", "Aulas iniciadas", "Aulas concluídas", "Projetos", "Diagnósticos", "Compras", "Acesso pago"].map((heading) => (
                <th key={heading} className="px-2 py-3 font-medium">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.rows.map((user) => (
              <tr key={user.id} className="border-b border-border">
                <td className="px-2 py-3">
                  <Link className="underline underline-offset-4" href={`/admin/usuarios/${user.id}`}>{user.name}</Link>
                </td>
                <td className="px-2 py-3">{user.email}</td>
                <td className="px-2 py-3">{user.verified ? "Sim" : "Não"}</td>
                <td className="px-2 py-3">{formatAdminDate(user.createdAt)}</td>
                <td className="px-2 py-3">{formatAdminDate(user.lastActivity)}</td>
                <td className="px-2 py-3">{user.started}</td>
                <td className="px-2 py-3">{user.completed}</td>
                <td className="px-2 py-3">{user.projects}</td>
                <td className="px-2 py-3">{user.diagnostics}</td>
                <td className="px-2 py-3">{user.orders}</td>
                <td className="px-2 py-3">{user.activeAccess}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.total === 0 ? <p className="mt-4 text-sm text-muted">Nenhum usuário neste filtro.</p> : null}
      <p className="mt-4 text-sm text-muted">{LAST_ACTIVITY_NOTE}</p>
      {list.pages > 1 ? (
        <nav className="mt-4 flex items-center gap-4 text-sm">
          {list.page > 1 ? <Link className="underline underline-offset-4" href={adminUsersHref({ page: list.page - 1, filter: list.filter, search: list.search })}>Anterior</Link> : <span className="text-muted">Anterior</span>}
          <span>Página {list.page} de {list.pages}</span>
          {list.page < list.pages ? <Link className="underline underline-offset-4" href={adminUsersHref({ page: list.page + 1, filter: list.filter, search: list.search })}>Próxima</Link> : <span className="text-muted">Próxima</span>}
        </nav>
      ) : null}
    </>
  );
}

export function UserDetailView({ user }: { user: UserDetail }) {
  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Usuário</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{user.name}</h1>
        <p className="mt-2 text-sm">{user.email}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted">Verificação</dt><dd>{user.verified ? "E-mail verificado" : "E-mail não verificado"}</dd></div>
          <div><dt className="text-muted">Cadastro</dt><dd>{formatAdminDate(user.createdAt)}</dd></div>
          <div><dt className="text-muted">Última atividade</dt><dd>{formatAdminDate(user.lastActivity)}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-muted">{LAST_ACTIVITY_NOTE}</p>
      </header>

      <section>
        <h2 className="text-lg font-semibold">Aprendizado</h2>
        <ul className="mt-4 space-y-3">
          {user.lessons.map((lesson) => (
            <li key={lesson.id} className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted">{lesson.moduleTitle}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h3 className="font-medium">{lesson.title}</h3>
                <Status>{lesson.learning}</Status>
                {lesson.access ? <Status>{lesson.access}</Status> : null}
                {lesson.percent != null ? <span className="text-sm">{lesson.percent}%</span> : null}
              </div>
              <p className="mt-2 text-sm text-muted">
                {lesson.lastBlock ? `Último bloco: ${lesson.lastBlock}` : "Sem bloco registrado"}
                {lesson.completedAt ? ` · Concluída em ${formatAdminDate(lesson.completedAt)}` : ""}
              </p>
              <p className="mt-1 text-sm text-muted">
                Possui respostas: {lesson.responseCount}
                {" · "}
                Possui resultado prático: {lesson.resultLabel ? `sim · ${lesson.resultLabel}` : "não"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Projetos</h2>
        {user.projects.length === 0 ? <p className="mt-3 text-sm text-muted">{EMPTY_PROJECTS}</p> : (
          <ul className="mt-4 space-y-3">
            {user.projects.map((project) => {
              const latest = project.diagnostics[0];
              return (
                <li key={project.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{project.name}</h3>
                    <Status>{project.status === "ACTIVE" ? "Ativo" : "Arquivado"}</Status>
                  </div>
                  <p className="mt-2 text-sm text-muted">Criado em {formatAdminDate(project.createdAt)} · Atualizado em {formatAdminDate(project.updatedAt)}</p>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm underline underline-offset-4">Ver detalhes operacionais</summary>
                    {latest ? (
                      <div className="mt-3 text-sm">
                        <p>Último diagnóstico · {formatAdminDate(latest.completedAt ?? latest.createdAt)} · {latest.version} · {latest.status === "COMPLETED" ? "Concluído" : "Em andamento"}</p>
                        <p className="mt-1">Score {latest.score ?? "—"} · Gargalo: {latest.bottleneck}</p>
                        {latest.recommendation ? (
                          <p className="mt-2">Recomendação {latest.recommendation.type}: {latest.recommendation.title} {latest.recommendation.description}</p>
                        ) : <p className="mt-2 text-muted">Sem recomendação registrada.</p>}
                      </div>
                    ) : <p className="mt-3 text-sm text-muted">Nenhum diagnóstico neste projeto.</p>}
                    {project.diagnostics.length > 1 ? (
                      <table className="mt-4 w-full text-left text-sm">
                        <caption className="mb-2 text-left text-muted">Histórico</caption>
                        <thead><tr><th className="py-1 font-medium">Data</th><th className="py-1 font-medium">Score</th><th className="py-1 font-medium">Gargalo</th></tr></thead>
                        <tbody>
                          {project.diagnostics.map((item) => (
                            <tr key={item.id} className="border-t border-border">
                              <td className="py-1">{formatAdminDate(item.completedAt ?? item.createdAt)}</td>
                              <td className="py-1">{item.score ?? "—"}</td>
                              <td className="py-1">{item.bottleneck}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : null}
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {user.tasks.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold">Tarefas</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {user.tasks.map((task) => (
              <li key={`${task.title}-${task.updatedAt}`} className="flex flex-wrap items-center gap-2">
                <span>{task.title}</span>
                <Status>{TASK_STATUS[task.status] ?? task.status}</Status>
                <span className="text-muted">{TASK_SOURCE[task.sourceType] ?? task.sourceType}</span>
                <span className="text-muted">{task.dueAt ? formatAdminDate(task.dueAt) : "Sem prazo"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {user.reminders.active > 0 ? (
        <p className="text-sm text-muted">
          Lembretes ativos: {user.reminders.active}
          {user.reminders.next ? ` · Próximo em ${formatAdminDate(user.reminders.next)}` : ""}
        </p>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold">Compras</h2>
        {user.orders.length === 0 ? <p className="mt-3 text-sm text-muted">{EMPTY_PURCHASES}</p> : (
          <ul className="mt-4 space-y-3">
            {user.orders.map((order) => (
              <li key={order.id} className="rounded-lg border border-border p-4 text-sm">
                <p>
                  <Link className="underline underline-offset-4" href={`/admin/compras/${order.id}`}>{formatAdminDate(order.createdAt)}</Link>
                  {" · "}{order.items.map((item) => item.titleSnapshot).join(", ") || "Sem item"}
                  {" · "}{formatPriceCents(order.totalCents)}
                  {" · "}{ORDER_STATUS[order.status] ?? order.status}
                </p>
                {order.payments.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-muted">
                    {order.payments.map((payment, index) => (
                      <li key={`${order.id}-payment-${index}`}>
                        {PAYMENT_STATUS[payment.status] ?? payment.status} · {payment.provider} · {formatPriceCents(payment.amountCents)}
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-muted">Sem pagamento registrado.</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Acessos</h2>
        {user.entitlements.length === 0 ? <p className="mt-3 text-sm text-muted">{EMPTY_ACCESS}</p> : (
          <ul className="mt-4 space-y-2 text-sm">
            {user.entitlements.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2">
                <span>{item.lessonTitle}</span>
                <span className="text-muted">{item.source}</span>
                <Status>{item.status === "ACTIVE" ? "Ativo" : "Revogado"}</Status>
                <span className="text-muted">{formatAdminDate(item.grantedAt)}</span>
                <Link className="underline underline-offset-4" href={`/admin/compras/${item.orderId}`}>Pedido</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
