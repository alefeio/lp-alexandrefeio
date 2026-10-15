import { dimensionLabel, knownDimension } from "@/lib/diagnostic/score";
import { getPrisma } from "@/lib/db/prisma";
import {
  adminFilter,
  adminPage,
  adminSearch,
  latestActivity,
  lessonOperation,
  lessonResultLabel,
  overviewCards,
  pickOperationalTasks,
  receivedRevenueCents,
  type AdminFilter,
  type OverviewNumbers,
} from "@/lib/admin/operations";

const USER_LIST_SELECT = { id: true, name: true, email: true, emailVerified: true, createdAt: true } as const;

function editorialBlockLabel(type: string, payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.title === "string" && record.title.trim()) return record.title.trim();
  if (typeof record.question === "string" && record.question.trim()) return record.question.trim();
  if (type === "HEADING" && typeof record.text === "string" && record.text.trim()) return record.text.trim();
  return null;
}

export async function loadAdminOverview(): Promise<OverviewNumbers> {
  const prisma = getPrisma();
  const [
    registered,
    verified,
    lessonsStarted,
    lessonsCompleted,
    projects,
    diagnosticsCompleted,
    orders,
    approvedPayments,
    revenueRows,
    startedUsers,
    completedUsers,
    diagnosticUsers,
    paidUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.lessonProgress.count(),
    prisma.lessonProgress.count({ where: { completedAt: { not: null } } }),
    prisma.project.count(),
    prisma.diagnostic.count({ where: { status: "COMPLETED" } }),
    prisma.order.count(),
    prisma.payment.count({ where: { status: "APPROVED" } }),
    prisma.payment.findMany({
      where: { status: { in: ["APPROVED", "PARTIALLY_REFUNDED"] } },
      select: { status: true, amountCents: true, refundedAmountCents: true },
    }),
    prisma.lessonProgress.groupBy({ by: ["userId"] }),
    prisma.lessonProgress.groupBy({ by: ["userId"], where: { completedAt: { not: null } } }),
    prisma.diagnostic.groupBy({ by: ["userId"], where: { status: "COMPLETED" } }),
    prisma.order.groupBy({ by: ["userId"], where: { status: "PAID" } }),
  ]);

  return {
    registered,
    verified,
    lessonsStarted,
    lessonsCompleted,
    projects,
    diagnosticsCompleted,
    orders,
    approvedPayments,
    receivedRevenueCents: receivedRevenueCents(revenueRows),
    funnel: {
      registered,
      startedLesson: startedUsers.length,
      completedLesson: completedUsers.length,
      completedDiagnostic: diagnosticUsers.length,
      purchased: paidUsers.length,
    },
  };
}

export function adminOverviewView(numbers: OverviewNumbers) {
  return { cards: overviewCards(numbers), funnel: numbers.funnel };
}

function userListWhere(filter: AdminFilter, search: string) {
  const searchWhere = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] }
    : {};
  if (filter === "verificados") return { ...searchWhere, emailVerified: true };
  if (filter === "nao-verificados") return { ...searchWhere, emailVerified: false };
  if (filter === "com-aprendizado") return { ...searchWhere, lessonProgress: { some: {} } };
  if (filter === "com-diagnostico") return { ...searchWhere, diagnostics: { some: {} } };
  if (filter === "com-compra") return { ...searchWhere, orders: { some: {} } };
  return searchWhere;
}

export async function loadAdminUsers(query: { pagina?: string; filtro?: string; q?: string }) {
  const prisma = getPrisma();
  const filter = adminFilter(query.filtro);
  const search = adminSearch(query.q);
  const where = userListWhere(filter, search);
  const total = await prisma.user.count({ where });
  const page = adminPage(query.pagina, total);
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: page.skip,
    take: page.pageSize,
    select: USER_LIST_SELECT,
  });
  const ids = users.map((user) => user.id);
  const signals = await userSignals(ids);
  return {
    filter,
    search,
    total,
    page: page.page,
    pages: page.pages,
    rows: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      verified: user.emailVerified,
      createdAt: user.createdAt,
      lastActivity: signals.get(user.id)?.lastActivity ?? null,
      started: signals.get(user.id)?.started ?? 0,
      completed: signals.get(user.id)?.completed ?? 0,
      projects: signals.get(user.id)?.projects ?? 0,
      diagnostics: signals.get(user.id)?.diagnostics ?? 0,
      orders: signals.get(user.id)?.orders ?? 0,
      activeAccess: signals.get(user.id)?.activeAccess ?? 0,
    })),
  };
}

async function userSignals(ids: string[]) {
  const map = new Map<string, {
    dates: Array<Date | null>;
    started: number;
    completed: number;
    projects: number;
    diagnostics: number;
    orders: number;
    activeAccess: number;
    lastActivity: Date | null;
  }>();
  for (const id of ids) {
    map.set(id, { dates: [], started: 0, completed: 0, projects: 0, diagnostics: 0, orders: 0, activeAccess: 0, lastActivity: null });
  }
  if (ids.length === 0) return map;
  const prisma = getPrisma();
  const where = { userId: { in: ids } };
  const [progress, completed, responses, results, projects, diagnostics, orders, access, sessions] = await Promise.all([
    prisma.lessonProgress.groupBy({ by: ["userId"], where, _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.lessonProgress.groupBy({ by: ["userId"], where: { ...where, completedAt: { not: null } }, _count: { _all: true } }),
    prisma.lessonResponse.groupBy({ by: ["userId"], where, _max: { updatedAt: true } }),
    prisma.lessonResult.groupBy({ by: ["userId"], where, _max: { updatedAt: true } }),
    prisma.project.groupBy({ by: ["userId"], where, _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.diagnostic.groupBy({ by: ["userId"], where, _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.order.groupBy({ by: ["userId"], where, _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.entitlement.groupBy({ by: ["userId"], where: { ...where, status: "ACTIVE" }, _count: { _all: true } }),
    prisma.session.groupBy({ by: ["userId"], where, _max: { updatedAt: true } }),
  ]);

  for (const row of progress) {
    const item = map.get(row.userId);
    if (!item) continue;
    item.started = row._count._all;
    item.dates.push(row._max.updatedAt);
  }
  for (const row of completed) {
    const item = map.get(row.userId);
    if (item) item.completed = row._count._all;
  }
  for (const row of responses) map.get(row.userId)?.dates.push(row._max.updatedAt);
  for (const row of results) map.get(row.userId)?.dates.push(row._max.updatedAt);
  for (const row of projects) {
    const item = map.get(row.userId);
    if (!item) continue;
    item.projects = row._count._all;
    item.dates.push(row._max.updatedAt);
  }
  for (const row of diagnostics) {
    const item = map.get(row.userId);
    if (!item) continue;
    item.diagnostics = row._count._all;
    item.dates.push(row._max.updatedAt);
  }
  for (const row of orders) {
    const item = map.get(row.userId);
    if (!item) continue;
    item.orders = row._count._all;
    item.dates.push(row._max.updatedAt);
  }
  for (const row of access) {
    const item = map.get(row.userId);
    if (item) item.activeAccess = row._count._all;
  }
  for (const row of sessions) map.get(row.userId)?.dates.push(row._max.updatedAt);
  for (const item of map.values()) item.lastActivity = latestActivity(item.dates);
  return map;
}

export async function loadAdminUser(userId: string) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: USER_LIST_SELECT });
  if (!user) return null;

  const [lessons, progress, responses, results, entitlements, projects, tasks, reminderCount, nextReminder, orders, activity] = await Promise.all([
    prisma.lesson.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        slug: true,
        title: true,
        accessType: true,
        sortOrder: true,
        module: { select: { title: true, sortOrder: true, course: { select: { title: true, sortOrder: true } } } },
      },
    }),
    prisma.lessonProgress.findMany({
      where: { userId },
      select: { lessonId: true, percent: true, completedAt: true, lastBlockKey: true, updatedAt: true },
    }),
    prisma.lessonResponse.groupBy({ by: ["lessonId"], where: { userId }, _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.lessonResult.findMany({ where: { userId }, select: { lessonId: true, updatedAt: true } }),
    prisma.entitlement.findMany({
      where: { userId },
      orderBy: { grantedAt: "desc" },
      select: {
        id: true,
        status: true,
        grantedAt: true,
        revokedAt: true,
        lesson: { select: { id: true, title: true } },
        orderItem: { select: { titleSnapshot: true, order: { select: { id: true, createdAt: true } } } },
      },
    }),
    prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        diagnostics: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            version: true,
            status: true,
            overallScore: true,
            primaryBottleneck: true,
            createdAt: true,
            completedAt: true,
            updatedAt: true,
            recommendations: {
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { type: true, title: true, description: true },
            },
          },
        },
      },
    }),
    prisma.task.findMany({
      where: { project: { userId } },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { title: true, status: true, sourceType: true, dueAt: true, updatedAt: true },
    }),
    prisma.reminder.count({ where: { project: { userId }, dismissedAt: null } }),
    prisma.reminder.findFirst({
      where: { project: { userId }, dismissedAt: null },
      orderBy: { remindAt: "asc" },
      select: { remindAt: true },
    }),
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        totalCents: true,
        createdAt: true,
        updatedAt: true,
        items: { select: { titleSnapshot: true, finalPriceCents: true } },
        payments: {
          orderBy: { createdAt: "desc" },
          select: { status: true, provider: true, amountCents: true, createdAt: true },
        },
      },
    }),
    userSignals([userId]),
  ]);

  const progressByLesson = new Map(progress.map((row) => [row.lessonId, row]));
  const responseByLesson = new Map(responses.map((row) => [row.lessonId, row._count._all]));
  const resultLessons = new Set(results.map((row) => row.lessonId));
  const activeLessons = new Set(entitlements.filter((item) => item.status === "ACTIVE").map((item) => item.lesson.id));
  const revokedLessons = new Set(entitlements.filter((item) => item.status === "REVOKED").map((item) => item.lesson.id));
  const blockKeys = progress.map((row) => row.lastBlockKey).filter((key): key is string => Boolean(key));
  const blocks = blockKeys.length
    ? await prisma.lessonBlock.findMany({
        where: { blockKey: { in: blockKeys }, retiredAt: null },
        select: { lessonId: true, blockKey: true, type: true, payload: true },
      })
    : [];
  const blockLabel = new Map<string, string>();
  for (const block of blocks) {
    const label = editorialBlockLabel(block.type, block.payload);
    if (label) blockLabel.set(`${block.lessonId}:${block.blockKey}`, label);
  }

  const orderedLessons = [...lessons].sort((a, b) =>
    a.module.course.sortOrder - b.module.course.sortOrder
    || a.module.sortOrder - b.module.sortOrder
    || a.sortOrder - b.sortOrder,
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    verified: user.emailVerified,
    createdAt: user.createdAt,
    lastActivity: activity.get(userId)?.lastActivity ?? null,
    lessons: orderedLessons.map((lesson) => {
      const row = progressByLesson.get(lesson.id);
      const state = lessonOperation({
        access: lesson.accessType,
        percent: row ? row.percent : null,
        completedAt: row?.completedAt ?? null,
        activeEntitlement: activeLessons.has(lesson.id),
        revokedEntitlement: revokedLessons.has(lesson.id),
      });
      return {
        id: lesson.id,
        title: lesson.title,
        moduleTitle: lesson.module.title,
        ...state,
        completedAt: row?.completedAt ?? null,
        lastBlock: row?.lastBlockKey ? blockLabel.get(`${lesson.id}:${row.lastBlockKey}`) ?? row.lastBlockKey : null,
        responseCount: responseByLesson.get(lesson.id) ?? 0,
        resultLabel: resultLessons.has(lesson.id) ? lessonResultLabel(lesson.slug) : null,
      };
    }),
    entitlements: entitlements.map((item) => ({
      id: item.id,
      lessonTitle: item.lesson.title,
      source: item.orderItem.titleSnapshot,
      orderId: item.orderItem.order.id,
      status: item.status,
      grantedAt: item.grantedAt,
      revokedAt: item.revokedAt,
    })),
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      diagnostics: project.diagnostics.map((item) => ({
        id: item.id,
        version: item.version,
        status: item.status,
        score: item.overallScore,
        bottleneck: dimensionLabel(knownDimension(item.primaryBottleneck)),
        createdAt: item.createdAt,
        completedAt: item.completedAt,
        recommendation: item.recommendations[0]
          ? { type: item.recommendations[0].type, title: item.recommendations[0].title, description: item.recommendations[0].description }
          : null,
      })),
    })),
    tasks: pickOperationalTasks(tasks.map((task) => ({ ...task, updatedAt: task.updatedAt.toISOString() }))),
    reminders: { active: reminderCount, next: nextReminder?.remindAt ?? null },
    orders,
  };
}

export async function loadAdminOrders() {
  const prisma = getPrisma();
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      totalCents: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      items: { select: { titleSnapshot: true } },
    },
  });
}
