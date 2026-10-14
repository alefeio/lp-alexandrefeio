import { assessLesson, lessonSaleReady, type ReadyBlock } from "@/lib/editorial/readiness";
import { readDatabaseEnvLabel } from "@/lib/db/urls";
import type { PrismaClient } from "@/generated/prisma/client";
import { FIRST_COURSE_SLUG } from "@/lib/learning/first-course";
import { LESSON_04_SLUG } from "@/lib/learning/lesson-04";
import { LESSON_05_SLUG } from "@/lib/learning/lesson-05";
import { LESSON_06_SLUG } from "@/lib/learning/lesson-06";
import { PUBLIC_PREVIEW_TYPES } from "@/lib/learning/public-preview";

export const COMMERCE_CATALOG_CONFIRM = "production";

export const FIRST_SALE_ALLOWLIST = [
  { kind: "lesson" as const, slug: LESSON_04_SLUG, priceCents: 2990 },
  { kind: "lesson" as const, slug: LESSON_05_SLUG, priceCents: 3490 },
  { kind: "lesson" as const, slug: LESSON_06_SLUG, priceCents: 3990 },
  { kind: "module" as const, slug: "planeje-antes-de-anunciar", priceCents: 5790 },
];

const MODULE_LESSONS: Record<string, readonly string[]> = {
  "planeje-antes-de-anunciar": [LESSON_04_SLUG, LESSON_05_SLUG],
};

const INCOMPLETE_MODULES = new Set(["google-ads-na-pratica", "meta-ads-na-pratica", "entenda-e-melhore"]);

const INCOMPLETE_LESSONS = new Set([
  "palavras-chave-com-intencao",
  "anuncios-alinhados-a-conversao",
  "objetivo-publico-estrutura",
  "campanhas-leads-whatsapp",
  "leia-os-numeros",
  "o-que-mudar",
]);

export type CommerceStatusName = "NOT_FOR_SALE" | "AVAILABLE";
export type ProductKind = "lesson" | "module" | "course";

export type ProductPlan = {
  kind: ProductKind;
  slug: string;
  title: string;
  priceCents: number | null;
  current: CommerceStatusName;
  intended: CommerceStatusName;
  allowed: boolean;
  reason: string | null;
};

export type CommerceWriteGate =
  | { ok: true; write: boolean }
  | { ok: false; write: false; message: string };

type Env = Record<string, string | undefined>;

export function commerceWriteGate(env: Env, apply: boolean): CommerceWriteGate {
  if (env.VERCEL_ENV === "production") {
    return { ok: false, write: false, message: "Este comando não roda dentro do runtime de production." };
  }
  if (!apply) return { ok: true, write: false };
  const label = readDatabaseEnvLabel(env);
  if (label === "production" && env.COMMERCE_CATALOG_CONFIRM !== COMMERCE_CATALOG_CONFIRM) {
    return {
      ok: false,
      write: false,
      message: "Em production, a alteração comercial exige COMMERCE_CATALOG_CONFIRM=production.",
    };
  }
  if (label !== "development" && label !== "test" && label !== "production") {
    return { ok: false, write: false, message: "DATABASE_ENV precisa ser development, test ou production confirmado." };
  }
  return { ok: true, write: true };
}

export type LessonShape = {
  slug: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  accessType: "FREE" | "PAID";
  priceCents: number | null;
  commerceStatus: CommerceStatusName;
  publicPreview: string | null;
  contentReady: boolean;
  contentIssues: string[];
  hasPublicPreviewBlocks: boolean;
};

export function planLessonEnable(lesson: LessonShape): ProductPlan {
  const base = {
    kind: "lesson" as const,
    slug: lesson.slug,
    title: lesson.title,
    priceCents: lesson.priceCents,
    current: lesson.commerceStatus,
    intended: "AVAILABLE" as const,
  };
  const allowed = allowlistItem("lesson", lesson.slug);
  if (!allowed) {
    return { ...base, allowed: false, reason: blockedReason("lesson", lesson.slug) };
  }
  if (lesson.priceCents !== allowed.priceCents) {
    return { ...base, allowed: false, reason: "O preço não confere com o valor aprovado." };
  }
  const sale = lessonSaleReady(
    {
      title: lesson.title,
      summary: "resumo",
      publicPreview: lesson.publicPreview,
      estimatedMinutes: 1,
      accessType: lesson.accessType,
      status: lesson.status,
      priceCents: lesson.priceCents,
      commerceStatus: lesson.commerceStatus,
    },
    { ready: lesson.contentReady, issues: lesson.contentIssues },
  );
  if (!sale.ready) return { ...base, allowed: false, reason: sale.issues[0] ?? "A aula não está pronta para venda." };
  if (!lesson.publicPreview?.trim() || !lesson.hasPublicPreviewBlocks) {
    return { ...base, allowed: false, reason: "Falta a amostra pública." };
  }
  return { ...base, allowed: true, reason: null };
}

type ModuleLesson = {
  slug: string;
  title: string;
  commerceStatus: CommerceStatusName;
  ready: boolean;
  status: "DRAFT" | "PUBLISHED";
  accessType: "FREE" | "PAID";
};

export function planModuleEnable(input: {
  slug: string;
  title: string;
  priceCents: number | null;
  commerceStatus: CommerceStatusName;
  status: "DRAFT" | "PUBLISHED";
  lessons: ModuleLesson[];
}): ProductPlan {
  const base = {
    kind: "module" as const,
    slug: input.slug,
    title: input.title,
    priceCents: input.priceCents,
    current: input.commerceStatus,
    intended: "AVAILABLE" as const,
  };
  const allowed = allowlistItem("module", input.slug);
  if (!allowed) return { ...base, allowed: false, reason: blockedReason("module", input.slug) };
  if (input.status !== "PUBLISHED") return { ...base, allowed: false, reason: "O módulo precisa estar publicado." };
  if (input.priceCents !== allowed.priceCents) {
    return { ...base, allowed: false, reason: "O preço não confere com o valor aprovado." };
  }
  const required = MODULE_LESSONS[input.slug] ?? [];
  const issues: string[] = [];
  for (const slug of required) {
    const lesson = input.lessons.find((item) => item.slug === slug);
    if (!lesson) {
      issues.push(`A aula ${slug} não está neste módulo.`);
      continue;
    }
    if (lesson.commerceStatus !== "AVAILABLE") issues.push(`${lesson.title} ainda não está disponível para venda.`);
    if (!lesson.ready || lesson.status !== "PUBLISHED") issues.push(`${lesson.title} ainda não passou na prontidão editorial.`);
  }
  if (issues.length > 0) return { ...base, allowed: false, reason: issues[0] ?? "O módulo não pode ir à venda." };
  return { ...base, allowed: true, reason: null };
}

export function planCourseEnable(input: {
  slug: string;
  title: string;
  priceCents: number | null;
  commerceStatus: CommerceStatusName;
}): ProductPlan {
  return {
    kind: "course",
    slug: input.slug,
    title: input.title,
    priceCents: input.priceCents,
    current: input.commerceStatus,
    intended: "AVAILABLE",
    allowed: false,
    reason: "O curso completo está bloqueado nesta fase.",
  };
}

export function planDisable(input: {
  kind: ProductKind;
  slug: string;
  title: string;
  priceCents: number | null;
  commerceStatus: CommerceStatusName;
}): ProductPlan {
  return {
    kind: input.kind,
    slug: input.slug,
    title: input.title,
    priceCents: input.priceCents,
    current: input.commerceStatus,
    intended: "NOT_FOR_SALE",
    allowed: true,
    reason: null,
  };
}

function allowlistItem(kind: "lesson" | "module", slug: string) {
  return FIRST_SALE_ALLOWLIST.find((item) => item.kind === kind && item.slug === slug) ?? null;
}

function blockedReason(kind: "lesson" | "module", slug: string): string {
  if (kind === "module" && INCOMPLETE_MODULES.has(slug)) return "Este módulo ainda não está editorialmente completo.";
  if (kind === "lesson" && INCOMPLETE_LESSONS.has(slug)) return "Esta aula ainda não está pronta para venda.";
  if (slug === FIRST_COURSE_SLUG) return "O curso completo está bloqueado nesta fase.";
  return "Este produto está fora da allowlist desta fase.";
}

export type CommerceDb = Pick<PrismaClient, "course" | "module" | "lesson" | "lessonBlock">;

export type CommerceRequest = {
  action: "list" | "enable" | "disable";
  slugs: string[];
  apply: boolean;
};

export type CommerceRun = {
  ok: boolean;
  write: boolean;
  written: boolean;
  message: string | null;
  plans: ProductPlan[];
  inventory: ProductPlan[];
};

export async function runCommerceProducts(db: CommerceDb, request: CommerceRequest, env: Env = process.env): Promise<CommerceRun> {
  const inventory = await listCommercialState(db);
  if (request.action === "list") {
    return { ok: true, write: false, written: false, message: null, plans: [], inventory };
  }
  const gate = commerceWriteGate(env, request.apply);
  const plans: ProductPlan[] = [];
  for (const slug of request.slugs) {
    plans.push(await planSlug(db, request.action, slug));
  }
  if (!gate.ok) {
    return { ok: false, write: false, written: false, message: gate.message, plans, inventory };
  }
  if (!gate.write) {
    return { ok: true, write: false, written: false, message: "Dry-run. Nada foi gravado.", plans, inventory };
  }
  const blocked = plans.find((plan) => !plan.allowed);
  if (blocked) {
    return { ok: false, write: true, written: false, message: blocked.reason, plans, inventory };
  }
  for (const plan of plans) {
    await writeStatus(db, plan);
  }
  return { ok: true, write: true, written: true, message: null, plans, inventory };
}

async function planSlug(db: CommerceDb, action: "enable" | "disable", slug: string): Promise<ProductPlan> {
  const found = await findProduct(db, slug);
  if (!found) {
    return {
      kind: "lesson",
      slug,
      title: slug,
      priceCents: null,
      current: "NOT_FOR_SALE",
      intended: action === "enable" ? "AVAILABLE" : "NOT_FOR_SALE",
      allowed: false,
      reason: "Produto não encontrado.",
    };
  }
  if (action === "disable") return planDisable(found.identity);
  if (found.lesson) return planLessonEnable(found.lesson);
  if (found.module) return planModuleEnable(found.module);
  return planCourseEnable(found.identity);
}

async function writeStatus(db: CommerceDb, plan: ProductPlan): Promise<void> {
  const data = { commerceStatus: plan.intended };
  if (plan.kind === "lesson") {
    await db.lesson.update({ where: { slug: plan.slug }, data });
    return;
  }
  if (plan.kind === "module") {
    const moduleRow = await db.module.findFirst({ where: { slug: plan.slug }, select: { id: true } });
    if (!moduleRow) throw new Error("Módulo não encontrado.");
    await db.module.update({ where: { id: moduleRow.id }, data });
    return;
  }
  await db.course.update({ where: { slug: plan.slug }, data });
}

type Found =
  | { identity: ProductPlanIdentity; lesson: LessonShape; module?: undefined }
  | { identity: ProductPlanIdentity; module: Parameters<typeof planModuleEnable>[0]; lesson?: undefined }
  | { identity: ProductPlanIdentity; lesson?: undefined; module?: undefined };

type ProductPlanIdentity = {
  kind: ProductKind;
  slug: string;
  title: string;
  priceCents: number | null;
  commerceStatus: CommerceStatusName;
};

async function findProduct(db: CommerceDb, slug: string): Promise<Found | null> {
  const lesson = await db.lesson.findUnique({
    where: { slug },
    include: { blocks: { select: { blockKey: true, retiredAt: true, payload: true, isPublicPreview: true, type: true } } },
  });
  if (lesson) {
    const blocks: ReadyBlock[] = lesson.blocks.map((block) => ({
      blockKey: block.blockKey,
      retiredAt: block.retiredAt,
      payload: block.payload,
    }));
    const readyLesson = {
      title: lesson.title,
      summary: lesson.summary,
      publicPreview: lesson.publicPreview,
      estimatedMinutes: lesson.estimatedMinutes,
      accessType: lesson.accessType,
      status: lesson.status,
      priceCents: lesson.priceCents,
      commerceStatus: lesson.commerceStatus,
    };
    const assessment = assessLesson(readyLesson, blocks);
    const hasPublicPreviewBlocks = lesson.blocks.some(
      (block) => !block.retiredAt && block.isPublicPreview && (PUBLIC_PREVIEW_TYPES as readonly string[]).includes(block.type),
    );
    const shape: LessonShape = {
      slug: lesson.slug,
      title: lesson.title,
      status: lesson.status,
      accessType: lesson.accessType,
      priceCents: lesson.priceCents,
      commerceStatus: lesson.commerceStatus,
      publicPreview: lesson.publicPreview,
      contentReady: assessment.ready,
      contentIssues: assessment.issues,
      hasPublicPreviewBlocks,
    };
    return {
      identity: {
        kind: "lesson",
        slug: lesson.slug,
        title: lesson.title,
        priceCents: lesson.priceCents,
        commerceStatus: lesson.commerceStatus,
      },
      lesson: shape,
    };
  }

  const moduleRow = await db.module.findFirst({
    where: { slug },
    include: {
      lessons: {
        include: { blocks: { select: { blockKey: true, retiredAt: true, payload: true } } },
      },
    },
  });
  if (moduleRow) {
    const lessons: ModuleLesson[] = moduleRow.lessons.map((item) => {
      const assessment = assessLesson(
        {
          title: item.title,
          summary: item.summary,
          publicPreview: item.publicPreview,
          estimatedMinutes: item.estimatedMinutes,
          accessType: item.accessType,
          status: item.status,
          priceCents: item.priceCents,
          commerceStatus: item.commerceStatus,
        },
        item.blocks.map((block) => ({ blockKey: block.blockKey, retiredAt: block.retiredAt, payload: block.payload })),
      );
      return {
        slug: item.slug,
        title: item.title,
        commerceStatus: item.commerceStatus,
        ready: assessment.ready,
        status: item.status,
        accessType: item.accessType,
      };
    });
    return {
      identity: {
        kind: "module",
        slug: moduleRow.slug,
        title: moduleRow.title,
        priceCents: moduleRow.bundlePriceCents,
        commerceStatus: moduleRow.commerceStatus,
      },
      module: {
        slug: moduleRow.slug,
        title: moduleRow.title,
        priceCents: moduleRow.bundlePriceCents,
        commerceStatus: moduleRow.commerceStatus,
        status: moduleRow.status,
        lessons,
      },
    };
  }

  const course = await db.course.findUnique({ where: { slug } });
  if (!course) return null;
  return {
    identity: {
      kind: "course",
      slug: course.slug,
      title: course.title,
      priceCents: course.bundlePriceCents,
      commerceStatus: course.commerceStatus,
    },
  };
}

async function listCommercialState(db: CommerceDb): Promise<ProductPlan[]> {
  const course = await db.course.findUnique({ where: { slug: FIRST_COURSE_SLUG } });
  const modules = await db.module.findMany({
    where: { course: { slug: FIRST_COURSE_SLUG } },
    orderBy: { sortOrder: "asc" },
    include: { lessons: { orderBy: { sortOrder: "asc" } } },
  });
  const rows: ProductPlan[] = [];
  if (course) {
    rows.push({
      kind: "course",
      slug: course.slug,
      title: course.title,
      priceCents: course.bundlePriceCents,
      current: course.commerceStatus,
      intended: course.commerceStatus,
      allowed: false,
      reason: "O curso completo está bloqueado nesta fase.",
    });
  }
  for (const moduleRow of modules) {
    const moduleAllowed = allowlistItem("module", moduleRow.slug);
    rows.push({
      kind: "module",
      slug: moduleRow.slug,
      title: moduleRow.title,
      priceCents: moduleRow.bundlePriceCents,
      current: moduleRow.commerceStatus,
      intended: moduleRow.commerceStatus,
      allowed: moduleAllowed != null,
      reason: moduleAllowed ? null : blockedReason("module", moduleRow.slug),
    });
    for (const lesson of moduleRow.lessons) {
      const lessonAllowed = allowlistItem("lesson", lesson.slug);
      rows.push({
        kind: "lesson",
        slug: lesson.slug,
        title: lesson.title,
        priceCents: lesson.priceCents,
        current: lesson.commerceStatus,
        intended: lesson.commerceStatus,
        allowed: lessonAllowed != null,
        reason: lessonAllowed ? null : blockedReason("lesson", lesson.slug),
      });
    }
  }
  return rows;
}

export function formatCents(cents: number | null): string {
  if (cents == null) return "sem preço";
  const reais = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, "0");
  return `R$ ${reais},${rest}`;
}

export function formatPlan(plan: ProductPlan): string {
  const lines = [
    `${plan.title} (${plan.slug})`,
    `tipo: ${plan.kind === "lesson" ? "aula" : plan.kind === "module" ? "módulo" : "curso"}`,
    `preço: ${formatCents(plan.priceCents)}`,
    `atual: ${plan.current}`,
    `pretendido: ${plan.intended}`,
    plan.allowed ? "resultado: permitido" : `resultado: bloqueado — ${plan.reason}`,
  ];
  return lines.join("\n");
}
