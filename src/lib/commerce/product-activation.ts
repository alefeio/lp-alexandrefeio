import { assessLesson, lessonSaleReady, type ReadyBlock } from "@/lib/editorial/readiness";
import { readDatabaseEnvLabel } from "@/lib/db/urls";
import type { PrismaClient } from "@/generated/prisma/client";
import { FIRST_COURSE_SLUG } from "@/lib/learning/first-course";
import { LESSON_04_SLUG } from "@/lib/learning/lesson-04";
import { LESSON_05_SLUG } from "@/lib/learning/lesson-05";
import { LESSON_06_SLUG } from "@/lib/learning/lesson-06";
import { LESSON_07_SLUG } from "@/lib/learning/lesson-07";
import { LESSON_08_SLUG } from "@/lib/learning/lesson-08";
import { LESSON_09_SLUG } from "@/lib/learning/lesson-09";
import { LESSON_10_SLUG } from "@/lib/learning/lesson-10";
import { LESSON_11_SLUG, LESSON_12_SLUG } from "@/lib/learning/lesson-11";
import { PUBLIC_PREVIEW_TYPES } from "@/lib/learning/public-preview";
import { SITE_LESSON_04_SLUG } from "@/lib/learning/site-oferta-publico-acao-principal";
import { SITE_LESSON_05_SLUG } from "@/lib/learning/site-jornada-do-visitante";
import { SITE_LESSON_06_SLUG } from "@/lib/learning/site-organize-as-secoes-da-pagina";
import { SITE_LESSON_07_SLUG } from "@/lib/learning/site-mensagem-que-deixa-a-oferta-clara";
import { SITE_LESSON_08_SLUG } from "@/lib/learning/site-hierarquia-visual-e-atencao";
import { SITE_LESSON_09_SLUG } from "@/lib/learning/site-construa-confianca";
import { SITE_LESSON_10_SLUG } from "@/lib/learning/site-pagina-mobile-e-experiencia";
import { SITE_LESSON_11_SLUG } from "@/lib/learning/site-configure-o-que-precisa-ser-medido";
import { SITE_LESSON_12_SLUG } from "@/lib/learning/site-revisao-antes-do-trafego";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

export const COMMERCE_CATALOG_CONFIRM = "production";
export const COMMERCE_SHARED_CONFIRM = "shared";

export const SALE_ALLOWLIST = [
  { kind: "lesson" as const, slug: LESSON_04_SLUG, priceCents: 2990 },
  { kind: "lesson" as const, slug: LESSON_05_SLUG, priceCents: 3490 },
  { kind: "lesson" as const, slug: LESSON_06_SLUG, priceCents: 3990 },
  { kind: "lesson" as const, slug: LESSON_07_SLUG, priceCents: 3990 },
  { kind: "lesson" as const, slug: LESSON_08_SLUG, priceCents: 3490 },
  { kind: "lesson" as const, slug: LESSON_09_SLUG, priceCents: 3990 },
  { kind: "lesson" as const, slug: LESSON_10_SLUG, priceCents: 3990 },
  { kind: "lesson" as const, slug: LESSON_11_SLUG, priceCents: 3490 },
  { kind: "lesson" as const, slug: LESSON_12_SLUG, priceCents: 3990 },
  { kind: "module" as const, slug: "planeje-antes-de-anunciar", priceCents: 5790 },
  { kind: "module" as const, slug: "google-ads-na-pratica", priceCents: 10390 },
  { kind: "module" as const, slug: "meta-ads-na-pratica", priceCents: 7190 },
  { kind: "module" as const, slug: "entenda-e-melhore", priceCents: 6790 },
  { kind: "course" as const, slug: FIRST_COURSE_SLUG, priceCents: 24990 },
  { kind: "lesson" as const, slug: SITE_LESSON_04_SLUG, priceCents: 3490 },
  { kind: "lesson" as const, slug: SITE_LESSON_05_SLUG, priceCents: 3490 },
  { kind: "lesson" as const, slug: SITE_LESSON_06_SLUG, priceCents: 3990 },
  { kind: "lesson" as const, slug: SITE_LESSON_07_SLUG, priceCents: 3990 },
  { kind: "lesson" as const, slug: SITE_LESSON_08_SLUG, priceCents: 3490 },
  { kind: "lesson" as const, slug: SITE_LESSON_09_SLUG, priceCents: 3490 },
  { kind: "lesson" as const, slug: SITE_LESSON_10_SLUG, priceCents: 3490 },
  { kind: "lesson" as const, slug: SITE_LESSON_11_SLUG, priceCents: 3990 },
  { kind: "lesson" as const, slug: SITE_LESSON_12_SLUG, priceCents: 3990 },
  { kind: "module" as const, slug: "planeje-antes-de-desenhar", priceCents: 6290 },
  { kind: "module" as const, slug: "estruture-e-comunique", priceCents: 7190 },
  { kind: "module" as const, slug: "atencao-e-confianca", priceCents: 6290 },
  { kind: "module" as const, slug: "publique-mea-e-melhore", priceCents: 10390 },
  { kind: "course" as const, slug: SITES_COURSE_SLUG, priceCents: 24990 },
];

/** Nome histórico. A allowlist agora cobre os dois cursos. */
export const FIRST_SALE_ALLOWLIST = SALE_ALLOWLIST;

const MODULE_LESSONS: Record<string, readonly string[]> = {
  "planeje-antes-de-anunciar": [LESSON_04_SLUG, LESSON_05_SLUG],
  "google-ads-na-pratica": [LESSON_06_SLUG, LESSON_07_SLUG, LESSON_08_SLUG],
  "meta-ads-na-pratica": [LESSON_09_SLUG, LESSON_10_SLUG],
  "entenda-e-melhore": [LESSON_11_SLUG, LESSON_12_SLUG],
  "planeje-antes-de-desenhar": [SITE_LESSON_04_SLUG, SITE_LESSON_05_SLUG],
  "estruture-e-comunique": [SITE_LESSON_06_SLUG, SITE_LESSON_07_SLUG],
  "atencao-e-confianca": [SITE_LESSON_08_SLUG, SITE_LESSON_09_SLUG],
  "publique-mea-e-melhore": [SITE_LESSON_10_SLUG, SITE_LESSON_11_SLUG, SITE_LESSON_12_SLUG],
};

const COURSE_PAID_LESSONS_BY_SLUG: Record<string, readonly string[]> = {
  [FIRST_COURSE_SLUG]: [
    LESSON_04_SLUG,
    LESSON_05_SLUG,
    LESSON_06_SLUG,
    LESSON_07_SLUG,
    LESSON_08_SLUG,
    LESSON_09_SLUG,
    LESSON_10_SLUG,
    LESSON_11_SLUG,
    LESSON_12_SLUG,
  ],
  [SITES_COURSE_SLUG]: [
    SITE_LESSON_04_SLUG,
    SITE_LESSON_05_SLUG,
    SITE_LESSON_06_SLUG,
    SITE_LESSON_07_SLUG,
    SITE_LESSON_08_SLUG,
    SITE_LESSON_09_SLUG,
    SITE_LESSON_10_SLUG,
    SITE_LESSON_11_SLUG,
    SITE_LESSON_12_SLUG,
  ],
};

const INCOMPLETE_MODULES = new Set<string>();

const INCOMPLETE_LESSONS = new Set<string>();

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
  if (label === "production") {
    if (env.COMMERCE_CATALOG_CONFIRM !== COMMERCE_CATALOG_CONFIRM) {
      return {
        ok: false,
        write: false,
        message: "Em production, a alteração comercial exige COMMERCE_CATALOG_CONFIRM=production.",
      };
    }
    return { ok: true, write: true };
  }
  if (label !== "development" && label !== "test") {
    return { ok: false, write: false, message: "DATABASE_ENV precisa ser development, test ou production confirmado." };
  }
  if (env.COMMERCE_CATALOG_CONFIRM !== COMMERCE_SHARED_CONFIRM) {
    return {
      ok: false,
      write: false,
      message: "O banco é compartilhado com production. A alteração comercial exige COMMERCE_CATALOG_CONFIRM=shared.",
    };
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
  status?: "DRAFT" | "PUBLISHED";
  paidLessons?: ModuleLesson[];
}): ProductPlan {
  const base = {
    kind: "course" as const,
    slug: input.slug,
    title: input.title,
    priceCents: input.priceCents,
    current: input.commerceStatus,
    intended: "AVAILABLE" as const,
  };
  const allowed = allowlistItem("course", input.slug);
  if (!allowed) return { ...base, allowed: false, reason: blockedReason("course", input.slug) };
  if (input.status !== "PUBLISHED") {
    return { ...base, allowed: false, reason: "O curso precisa estar publicado." };
  }
  if (input.priceCents !== allowed.priceCents) {
    return { ...base, allowed: false, reason: "O preço não confere com o valor aprovado." };
  }
  const required = COURSE_PAID_LESSONS_BY_SLUG[input.slug];
  if (!required) {
    return { ...base, allowed: false, reason: "As aulas obrigatórias deste curso não estão configuradas." };
  }
  const lessons = input.paidLessons ?? [];
  const issues: string[] = [];
  for (const slug of required) {
    const lesson = lessons.find((item) => item.slug === slug);
    if (!lesson) {
      issues.push(`A aula ${slug} não está neste curso.`);
      continue;
    }
    if (lesson.commerceStatus !== "AVAILABLE") issues.push(`${lesson.title} ainda não está disponível para venda.`);
    if (!lesson.ready || lesson.status !== "PUBLISHED" || lesson.accessType !== "PAID") {
      issues.push(`${lesson.title} ainda não passou na prontidão comercial.`);
    }
  }
  if (issues.length > 0) return { ...base, allowed: false, reason: issues[0] ?? "O curso não pode ir à venda." };
  return { ...base, allowed: true, reason: null };
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

function allowlistItem(kind: "lesson" | "module" | "course", slug: string) {
  return SALE_ALLOWLIST.find((item) => item.kind === kind && item.slug === slug) ?? null;
}

function blockedReason(kind: "lesson" | "module" | "course", slug: string): string {
  if (kind === "module" && INCOMPLETE_MODULES.has(slug)) return "Este módulo ainda não está editorialmente completo.";
  if (kind === "lesson" && INCOMPLETE_LESSONS.has(slug)) return "Esta aula ainda não está pronta para venda.";
  if (kind === "course" && slug === FIRST_COURSE_SLUG) return "O curso completo está fora da allowlist desta fase.";
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
  if (found.course) return planCourseEnable(found.course);
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
  | { identity: ProductPlanIdentity; lesson: LessonShape; module?: undefined; course?: undefined }
  | { identity: ProductPlanIdentity; module: Parameters<typeof planModuleEnable>[0]; lesson?: undefined; course?: undefined }
  | {
      identity: ProductPlanIdentity;
      course: Parameters<typeof planCourseEnable>[0];
      lesson?: undefined;
      module?: undefined;
    }
  | { identity: ProductPlanIdentity; lesson?: undefined; module?: undefined; course?: undefined };

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

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      modules: {
        include: {
          lessons: {
            include: { blocks: { select: { blockKey: true, retiredAt: true, payload: true } } },
          },
        },
      },
    },
  });
  if (!course) return null;
  const paidLessons: ModuleLesson[] = course.modules.flatMap((moduleRow) =>
    moduleRow.lessons
      .filter((item) => item.accessType === "PAID")
      .map((item) => {
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
      }),
  );
  return {
    identity: {
      kind: "course",
      slug: course.slug,
      title: course.title,
      priceCents: course.bundlePriceCents,
      commerceStatus: course.commerceStatus,
    },
    course: {
      slug: course.slug,
      title: course.title,
      priceCents: course.bundlePriceCents,
      commerceStatus: course.commerceStatus,
      status: course.status,
      paidLessons,
    },
  };
}

async function listCommercialState(db: CommerceDb): Promise<ProductPlan[]> {
  const rows: ProductPlan[] = [];
  for (const slug of [FIRST_COURSE_SLUG, SITES_COURSE_SLUG]) {
    rows.push(...(await listCourseCommercialState(db, slug)));
  }
  return rows;
}

async function listCourseCommercialState(db: CommerceDb, courseSlug: string): Promise<ProductPlan[]> {
  const course = await db.course.findUnique({ where: { slug: courseSlug } });
  const modules = await db.module.findMany({
    where: { course: { slug: courseSlug } },
    orderBy: { sortOrder: "asc" },
    include: { lessons: { orderBy: { sortOrder: "asc" } } },
  });
  const rows: ProductPlan[] = [];
  if (course) {
    const courseAllowed = allowlistItem("course", course.slug);
    rows.push({
      kind: "course",
      slug: course.slug,
      title: course.title,
      priceCents: course.bundlePriceCents,
      current: course.commerceStatus,
      intended: course.commerceStatus,
      allowed: courseAllowed != null,
      reason: courseAllowed ? null : blockedReason("course", course.slug),
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
