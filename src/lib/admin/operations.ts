/**
 * Regras do admin operacional. Só leitura e sem acesso ao banco.
 * “Última atividade” é a data mais recente entre os registros operacionais
 * que já existem. Não é rastreamento de page view.
 */

export const ADMIN_PAGE_SIZE = 20;

export const ADMIN_FILTERS = [
  "todos",
  "verificados",
  "nao-verificados",
  "com-aprendizado",
  "com-diagnostico",
  "com-compra",
] as const;

export type AdminFilter = (typeof ADMIN_FILTERS)[number];

export const ADMIN_FILTER_LABEL: Record<AdminFilter, string> = {
  todos: "Todos",
  verificados: "Verificados",
  "nao-verificados": "Não verificados",
  "com-aprendizado": "Com aprendizado",
  "com-diagnostico": "Com diagnóstico",
  "com-compra": "Com compra",
};

const RESULT_LABEL_BY_SLUG: Record<string, string> = {
  "como-funciona-o-trafego-pago": "Meu primeiro mapa de tráfego",
  "google-ads-ou-meta-ads": "Minha indicação inicial de canal",
  "objetivo-oferta-orcamento": "Brief Inicial de Campanha",
  "destino-e-mensuracao": "Plano de Destino e Mensuração",
  "campanha-de-pesquisa": "Blueprint de Campanha de Pesquisa",
};

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "accesstoken",
  "refreshtoken",
  "sessiontoken",
  "cvv",
  "providerpaymentid",
  "idempotencykey",
  "answers",
  "payload",
  "resultsnapshot",
  "checkoutkey",
]);

export type PaymentRevenueStatus =
  | "PENDING"
  | "IN_PROCESS"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "CHARGED_BACK";

export type AdminUserSignals = {
  name: string;
  email: string;
  emailVerified: boolean;
  startedLessons: number;
  diagnostics: number;
  orders: number;
};

export function adminFilter(raw: string | undefined): AdminFilter {
  return ADMIN_FILTERS.includes(raw as AdminFilter) ? (raw as AdminFilter) : "todos";
}

export function adminSearch(raw: string | undefined): string {
  return (raw ?? "").trim().slice(0, 80);
}

export function userMatchesSearch(user: { name: string; email: string }, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle);
}

/** Com diagnóstico = qualquer Diagnostic. Com compra = qualquer Order. */
export function userMatchesFilter(user: AdminUserSignals, filter: AdminFilter): boolean {
  if (filter === "verificados") return user.emailVerified;
  if (filter === "nao-verificados") return !user.emailVerified;
  if (filter === "com-aprendizado") return user.startedLessons > 0;
  if (filter === "com-diagnostico") return user.diagnostics > 0;
  if (filter === "com-compra") return user.orders > 0;
  return true;
}

export function adminUsersHref(input: { page?: number; filter?: AdminFilter; search?: string } = {}) {
  const params = new URLSearchParams();
  if (input.filter && input.filter !== "todos") params.set("filtro", input.filter);
  if (input.search) params.set("q", input.search);
  if (input.page && input.page > 1) params.set("pagina", String(input.page));
  const query = params.toString();
  return query ? `/admin/usuarios?${query}` : "/admin/usuarios";
}

export const EMPTY_PURCHASES = "Nenhuma compra realizada.";
export const EMPTY_PROJECTS = "Nenhum projeto criado.";
export const EMPTY_ACCESS = "Nenhum acesso pago.";
export const LAST_ACTIVITY_NOTE =
  "Última atividade é uma estimativa operacional baseada no registro mais recente disponível.";

export function adminPage(raw: string | undefined, total: number, pageSize = ADMIN_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const requested = Number(raw);
  const page = Number.isInteger(requested) && requested > 0 ? Math.min(requested, pages) : 1;
  return { page, pages, pageSize, skip: (page - 1) * pageSize };
}

export function latestActivity(dates: Array<Date | string | null | undefined>): Date | null {
  let latest: Date | null = null;
  for (const value of dates) {
    if (!value) continue;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    if (!latest || date.getTime() > latest.getTime()) latest = date;
  }
  return latest;
}

export function formatAdminDate(value: Date | string | null | undefined): string {
  if (!value) return "Sem registro";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem registro";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(date);
}

/** Receita recebida: só pagamento aprovado ou parcialmente reembolsado, já líquido do estorno registrado. */
export function receivedRevenueCents(
  payments: Array<{ status: PaymentRevenueStatus; amountCents: number; refundedAmountCents: number }>,
): number {
  return payments.reduce((sum, payment) => {
    if (payment.status !== "APPROVED" && payment.status !== "PARTIALLY_REFUNDED") return sum;
    return sum + Math.max(0, payment.amountCents - payment.refundedAmountCents);
  }, 0);
}

export function lessonResultLabel(slug: string): string {
  return RESULT_LABEL_BY_SLUG[slug] ?? "Resultado prático";
}

export function lessonOperation(input: {
  access: "FREE" | "PAID";
  percent: number | null;
  completedAt: Date | string | null;
  activeEntitlement: boolean;
  revokedEntitlement: boolean;
}) {
  const started = input.percent != null;
  const completed = Boolean(input.completedAt);
  const learning = completed ? "Concluída" : started ? "Em andamento" : "Não iniciada";
  const access =
    input.access === "FREE"
      ? null
      : input.activeEntitlement
        ? "Entitlement ativo"
        : input.revokedEntitlement
          ? "Acesso revogado"
          : "Sem acesso";
  return { learning, access, percent: started ? input.percent : null };
}

export function pickOperationalTasks<T extends { status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED"; updatedAt: string }>(
  tasks: T[],
  limit = 8,
): T[] {
  const rank = { TODO: 0, IN_PROGRESS: 1, DONE: 2, CANCELLED: 3 };
  return [...tasks]
    .sort((a, b) => rank[a.status] - rank[b.status] || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export function containsSensitiveAdminKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => containsSensitiveAdminKey(item));
  return Object.entries(value).some(([key, nested]) => {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) return true;
    return containsSensitiveAdminKey(nested);
  });
}

export type OverviewNumbers = {
  registered: number;
  verified: number;
  lessonsStarted: number;
  lessonsCompleted: number;
  projects: number;
  diagnosticsCompleted: number;
  orders: number;
  approvedPayments: number;
  receivedRevenueCents: number;
  funnel: {
    registered: number;
    startedLesson: number;
    completedLesson: number;
    completedDiagnostic: number;
    purchased: number;
  };
};

export function overviewCards(input: OverviewNumbers) {
  return [
    { group: "Usuários", label: "Cadastrados", value: String(input.registered) },
    { group: "Usuários", label: "E-mail verificado", value: String(input.verified) },
    { group: "Aprendizado", label: "Aulas iniciadas", value: String(input.lessonsStarted) },
    { group: "Aprendizado", label: "Aulas concluídas", value: String(input.lessonsCompleted) },
    { group: "Projetos", label: "Criados", value: String(input.projects) },
    { group: "Diagnósticos", label: "Concluídos", value: String(input.diagnosticsCompleted) },
    { group: "Commerce", label: "Pedidos", value: String(input.orders) },
    { group: "Commerce", label: "Pagamentos aprovados", value: String(input.approvedPayments) },
    { group: "Commerce", label: "Receita recebida", value: input.receivedRevenueCents },
  ] as const;
}
