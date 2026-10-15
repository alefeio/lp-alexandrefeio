import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ADMIN_PAGE_SIZE,
  EMPTY_ACCESS,
  EMPTY_PROJECTS,
  EMPTY_PURCHASES,
  LAST_ACTIVITY_NOTE,
  adminFilter,
  adminPage,
  adminSearch,
  adminUsersHref,
  containsSensitiveAdminKey,
  latestActivity,
  lessonOperation,
  lessonResultLabel,
  overviewCards,
  pickOperationalTasks,
  receivedRevenueCents,
  userMatchesFilter,
  userMatchesSearch,
  type AdminUserSignals,
} from "../src/lib/admin/operations";

function user(patch: Partial<AdminUserSignals> = {}): AdminUserSignals {
  return { name: "Alexandre Feio", email: "alexandre@example.com", emailVerified: true, startedLessons: 0, diagnostics: 0, orders: 0, ...patch };
}

test("aluno comum não recebe papel de admin e a área exige sessão de administrador", () => {
  const session = readFileSync(new URL("../src/lib/auth/session.ts", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../src/app/(admin)/admin/layout.tsx", import.meta.url), "utf8");
  const proxy = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
  assert.match(session, /session\.user\.role !== USER_ROLES\.admin/);
  assert.match(session, /return null/);
  assert.match(layout, /requireAdmin/);
  assert.match(layout, /Sem acesso/);
  assert.match(proxy, /pathname === "\/admin"/);
  for (const file of ["page.tsx", "usuarios/page.tsx", "usuarios/[id]/page.tsx", "compras/page.tsx", "compras/[id]/page.tsx"]) {
    const source = readFileSync(new URL(`../src/app/(admin)/admin/${file}`, import.meta.url), "utf8");
    assert.match(source, /requireAdmin/);
    assert.match(source, /if \(!session\) return null/);
  }
});

test("visão geral agrega contagens definidas e não inventa conversão", () => {
  const cards = overviewCards({
    registered: 3,
    verified: 2,
    lessonsStarted: 4,
    lessonsCompleted: 1,
    projects: 1,
    diagnosticsCompleted: 1,
    orders: 0,
    approvedPayments: 0,
    receivedRevenueCents: 0,
    funnel: { registered: 3, startedLesson: 2, completedLesson: 1, completedDiagnostic: 1, purchased: 0 },
  });
  assert.deepEqual(cards.map((card) => [card.group, card.label, card.value]), [
    ["Usuários", "Cadastrados", "3"],
    ["Usuários", "E-mail verificado", "2"],
    ["Aprendizado", "Aulas iniciadas", "4"],
    ["Aprendizado", "Aulas concluídas", "1"],
    ["Projetos", "Criados", "1"],
    ["Diagnósticos", "Concluídos", "1"],
    ["Commerce", "Pedidos", "0"],
    ["Commerce", "Pagamentos aprovados", "0"],
    ["Commerce", "Receita recebida", 0],
  ]);
  assert.equal(JSON.stringify(cards).includes("convers"), false);
  const home = readFileSync(new URL("../src/app/(admin)/admin/page.tsx", import.meta.url), "utf8");
  assert.match(home, /loadAdminOverview/);
  assert.equal(home.includes("trackEvent"), false);
});

test("lista pagina no servidor e a busca não olha resposta de aula", () => {
  assert.equal(ADMIN_PAGE_SIZE, 20);
  assert.deepEqual(adminPage("2", 45), { page: 2, pages: 3, pageSize: 20, skip: 20 });
  assert.equal(adminPage("0", 45).page, 1);
  assert.equal(adminPage("9", 5).page, 1);
  assert.equal(adminPage("abc", 0).skip, 0);
  assert.equal(adminSearch("  feio  "), "feio");
  assert.equal(userMatchesSearch(user(), "FEIO"), true);
  assert.equal(userMatchesSearch(user(), "EXAMPLE.COM"), true);
  assert.equal(userMatchesSearch(user(), "resposta secreta"), false);
  const loader = readFileSync(new URL("../src/lib/admin/load-operations.ts", import.meta.url), "utf8");
  assert.match(loader, /take: page\.pageSize/);
  assert.match(loader, /mode: "insensitive"/);
  assert.equal(loader.includes("lessonResponse: { some"), false);
});

test("filtros da v1 separam verificação, estudo, diagnóstico e compra", () => {
  assert.equal(adminFilter("inventado"), "todos");
  assert.equal(userMatchesFilter(user({ emailVerified: false }), "nao-verificados"), true);
  assert.equal(userMatchesFilter(user(), "verificados"), true);
  assert.equal(userMatchesFilter(user({ startedLessons: 1 }), "com-aprendizado"), true);
  assert.equal(userMatchesFilter(user({ diagnostics: 1 }), "com-diagnostico"), true);
  assert.equal(userMatchesFilter(user(), "com-diagnostico"), false);
  assert.equal(userMatchesFilter(user({ orders: 1 }), "com-compra"), true);
  assert.equal(userMatchesFilter(user(), "todos"), true);
  assert.equal(adminUsersHref({ filter: "verificados", search: "feio", page: 2 }), "/admin/usuarios?filtro=verificados&q=feio&pagina=2");
});

test("detalhe distingue aula em andamento, concluída e acesso pago", () => {
  assert.deepEqual(lessonOperation({ access: "FREE", percent: 42, completedAt: null, activeEntitlement: false, revokedEntitlement: false }), {
    learning: "Em andamento",
    access: null,
    percent: 42,
  });
  assert.equal(lessonOperation({ access: "FREE", percent: 100, completedAt: "2026-10-15", activeEntitlement: false, revokedEntitlement: false }).learning, "Concluída");
  assert.equal(lessonOperation({ access: "FREE", percent: null, completedAt: null, activeEntitlement: false, revokedEntitlement: false }).learning, "Não iniciada");
  assert.equal(lessonOperation({ access: "PAID", percent: null, completedAt: null, activeEntitlement: false, revokedEntitlement: false }).access, "Sem acesso");
  assert.equal(lessonOperation({ access: "PAID", percent: 10, completedAt: null, activeEntitlement: true, revokedEntitlement: true }).access, "Entitlement ativo");
  assert.equal(lessonOperation({ access: "PAID", percent: null, completedAt: null, activeEntitlement: false, revokedEntitlement: true }).access, "Acesso revogado");
  assert.equal(lessonResultLabel("como-funciona-o-trafego-pago"), "Meu primeiro mapa de tráfego");
  assert.equal(lessonResultLabel("destino-e-mensuracao"), "Plano de Destino e Mensuração");
  assert.equal(lessonResultLabel("campanha-de-pesquisa"), "Blueprint de Campanha de Pesquisa");
  const detail = readFileSync(new URL("../src/app/(admin)/admin/usuarios/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(detail, /notFound\(\)/);
  assert.equal(detail.includes("trackEvent"), false);
});

test("projeto, diagnóstico, tarefa, pedido, pagamento e acesso ficam somente leitura", () => {
  const tasks = pickOperationalTasks([
    { title: "Fechada", status: "DONE" as const, sourceType: "USER", dueAt: null, updatedAt: "2026-10-15T12:00:00.000Z" },
    { title: "Aberta", status: "TODO" as const, sourceType: "DIAGNOSTIC", dueAt: null, updatedAt: "2026-10-14T12:00:00.000Z" },
    ...Array.from({ length: 8 }, (_, index) => ({ title: `Extra ${index}`, status: "TODO" as const, sourceType: "SYSTEM", dueAt: null, updatedAt: `2026-10-13T0${index}:00:00.000Z` })),
  ]);
  assert.equal(tasks.length, 8);
  assert.equal(tasks[0]?.title, "Aberta");
  assert.equal(tasks.some((task) => task.title === "Fechada"), false);
  const view = readFileSync(new URL("../src/components/admin/Operations.tsx", import.meta.url), "utf8");
  assert.match(view, /Possui respostas/);
  assert.match(view, /Possui resultado prático/);
  assert.match(view, /Ver detalhes operacionais/);
  assert.match(view, /EMPTY_PURCHASES/);
  assert.match(view, /EMPTY_PROJECTS/);
  assert.match(view, /EMPTY_ACCESS/);
  assert.equal(view.includes("Entrar como"), false);
  assert.equal(view.includes("refund"), false);
  assert.equal(EMPTY_PURCHASES, "Nenhuma compra realizada.");
  assert.equal(EMPTY_PROJECTS, "Nenhum projeto criado.");
  assert.equal(EMPTY_ACCESS, "Nenhum acesso pago.");
});

test("receita recebida ignora pendente, recusa, cancelamento e reembolso total", () => {
  const cents = receivedRevenueCents([
    { status: "APPROVED", amountCents: 10000, refundedAmountCents: 0 },
    { status: "PARTIALLY_REFUNDED", amountCents: 10000, refundedAmountCents: 4000 },
    { status: "PENDING", amountCents: 5000, refundedAmountCents: 0 },
    { status: "IN_PROCESS", amountCents: 5000, refundedAmountCents: 0 },
    { status: "REJECTED", amountCents: 5000, refundedAmountCents: 0 },
    { status: "CANCELLED", amountCents: 5000, refundedAmountCents: 0 },
    { status: "REFUNDED", amountCents: 8000, refundedAmountCents: 0 },
    { status: "CHARGED_BACK", amountCents: 8000, refundedAmountCents: 0 },
    { status: "APPROVED", amountCents: 1000, refundedAmountCents: 5000 },
  ]);
  assert.equal(cents, 16000);
});

test("última atividade usa o registro mais recente e não dados sensíveis", () => {
  const latest = latestActivity([null, "2026-10-14T18:00:00.000Z", new Date("2026-10-15T12:00:00.000Z"), "invalida"]);
  assert.equal(latest?.toISOString(), "2026-10-15T12:00:00.000Z");
  assert.equal(latestActivity([null, undefined]), null);
  assert.match(LAST_ACTIVITY_NOTE, /estimativa operacional/);
  const loader = readFileSync(new URL("../src/lib/admin/load-operations.ts", import.meta.url), "utf8");
  assert.match(loader, /prisma\.session\.groupBy/);
  assert.equal(loader.includes("password"), false);
  assert.equal(loader.includes("providerPaymentId"), false);
  assert.equal(loader.includes("idempotencyKey"), false);
  assert.equal(loader.includes("answers:"), false);
  assert.equal(loader.includes("resultSnapshot"), false);
  assert.equal(loader.includes("token: true"), false);
  assert.equal(containsSensitiveAdminKey({ user: { password: "x" } }), true);
  assert.equal(containsSensitiveAdminKey({ payment: { providerPaymentId: "mp" } }), true);
  assert.equal(containsSensitiveAdminKey({ diagnostic: { answers: [] } }), true);
  assert.equal(containsSensitiveAdminKey({ name: "Ana", email: "ana@example.com", percent: 42 }), false);
});

test("admin permanece fora do índice e a compra aponta para o usuário", () => {
  const layout = readFileSync(new URL("../src/app/(admin)/admin/layout.tsx", import.meta.url), "utf8");
  const robots = readFileSync(new URL("../src/app/robots.ts", import.meta.url), "utf8");
  const purchases = readFileSync(new URL("../src/app/(admin)/admin/compras/page.tsx", import.meta.url), "utf8");
  const order = readFileSync(new URL("../src/app/(admin)/admin/compras/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(layout, /index: false/);
  assert.match(layout, /follow: false/);
  assert.match(layout, /Visão geral/);
  assert.match(layout, /Usuários/);
  assert.match(robots, /\/admin/);
  assert.match(purchases, /\/admin\/usuarios\/\$\{order\.user\.id\}/);
  assert.match(purchases, /EMPTY_PURCHASES/);
  assert.match(order, /Ver usuário/);
  assert.equal(order.includes("providerPaymentId"), false);
  assert.equal(purchases.includes("trackEvent"), false);
  const sitemap = readFileSync(new URL("../src/lib/seo/public-sitemap.ts", import.meta.url), "utf8");
  assert.equal(sitemap.includes("/admin"), false);
});
