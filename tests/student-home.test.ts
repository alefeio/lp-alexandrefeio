import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { homeAudience, homeBelongsToViewer, publicHomeCopy, publicHomeMetadata, studentHomeRendering } from "../src/lib/home/public-home";
import {
  buildStudentHome,
  recommendedAccess,
  studentHomeHasPrivateKeys,
  type StudentHomeInput,
} from "../src/lib/home/student-home";
import { lessonRail, lessonRailSectionState } from "../src/lib/learning/lesson-rail";

const now = "2026-10-14T15:00:00.000Z";

function input(patch: Partial<StudentHomeInput> = {}): StudentHomeInput {
  return {
    userId: "user-a",
    firstName: "Alexandre Feio",
    courseTitle: "Tráfego Pago na Prática",
    continue: { kind: "start", slug: "como-funciona-o-trafego-pago", title: "Como funciona o tráfego pago" },
    completedCount: 0,
    inProgressCount: 0,
    openCount: 3,
    lockedCount: 9,
    project: null,
    diagnostic: "none",
    next: { kind: "none" },
    tasks: [],
    reminder: null,
    recommended: null,
    now,
    ...patch,
  };
}

test("anônimo permanece na home pública e a metadata não muda", () => {
  assert.equal(homeAudience(false), "anonymous");
  assert.equal(publicHomeCopy.hero, "Aprenda tráfego pago aplicando no seu próprio negócio.");
  assert.equal(publicHomeCopy.primaryCta, "Começar gratuitamente");
  assert.equal(publicHomeCopy.secondaryCta, "Prefiro contratar a gestão");
  assert.equal(publicHomeMetadata.canonical, "/");
  assert.equal(publicHomeMetadata.title, "Aprenda tráfego pago na prática");
  assert.equal(studentHomeRendering.dynamic, "force-dynamic");
  assert.equal(studentHomeRendering.sharedCache, false);
  const page = readFileSync(new URL("../src/app/(public)/page.tsx", import.meta.url), "utf8");
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.equal(page.includes("student_home_view"), false);
});

test("autenticado recebe home personalizada e o dado de outro usuário não entra", () => {
  assert.equal(homeAudience(true), "student");
  const view = buildStudentHome(input());
  assert.match(view.greeting, /Olá, Alexandre/);
  assert.equal(view.userId, "user-a");
  assert.equal(homeBelongsToViewer(view.userId, "user-a"), true);
  assert.equal(homeBelongsToViewer(view.userId, "user-b"), false);
  assert.equal(studentHomeHasPrivateKeys(view), false);
  assert.equal(JSON.stringify(view).includes("segredo-do-outro"), false);
});

test("sem progresso convida a Aula 1", () => {
  const view = buildStudentHome(input());
  assert.equal(view.continue.kind, "start");
  assert.equal(view.continue.cta, "Começar Aula 1");
  assert.equal(view.continue.href, "/aulas/como-funciona-o-trafego-pago");
  assert.match(view.continue.title, /aulas gratuitas/);
});

test("aula em andamento destaca continuar", () => {
  const view = buildStudentHome(input({
    continue: { kind: "resume", slug: "google-ads-ou-meta-ads", title: "Google Ads ou Meta Ads: qual escolher?", percent: 62, remainingMinutes: 8 },
    inProgressCount: 1,
    openCount: 2,
  }));
  assert.equal(view.continue.cta, "Continuar aula");
  assert.match(view.continue.detail ?? "", /62%/);
  assert.match(view.continue.detail ?? "", /8 min/);
  assert.equal(view.continue.href, "/aulas/google-ads-ou-meta-ads?continuar=1");
});

test("aula concluída sugere a próxima", () => {
  const view = buildStudentHome(input({
    continue: { kind: "done", title: "Como funciona o tráfego pago", next: { slug: "google-ads-ou-meta-ads", title: "Google Ads ou Meta Ads: qual escolher?" } },
    completedCount: 1,
  }));
  assert.match(view.continue.title, /Você concluiu Como funciona o tráfego pago/);
  assert.equal(view.continue.cta, "Começar próxima aula");
  assert.equal(view.continue.href, "/aulas/google-ads-ou-meta-ads");
});

test("sem projeto pede para criar um", () => {
  const view = buildStudentHome(input());
  assert.equal(view.project, null);
  assert.match(view.projectEmpty?.body ?? "", /Crie um projeto/);
  assert.equal(view.projectEmpty?.cta, "Criar meu projeto");
});

test("com projeto e diagnóstico mostra resumo curto", () => {
  const view = buildStudentHome(input({
    project: { id: "proj-1", name: "Alexandre Feio", score: 80, bottleneck: "Mensuração", recommendation: "Prepare o destino e a mensuração", otherProjects: true },
    diagnostic: "completed",
    next: { kind: "learn", title: "Prepare o destino e a mensuração", href: "/aulas/destino-e-mensuracao" },
  }));
  assert.equal(view.project?.name, "Alexandre Feio");
  assert.equal(view.project?.score, "80/100");
  assert.equal(view.project?.bottleneck, "Mensuração");
  assert.equal(view.project?.href, "/app/projetos/proj-1");
  assert.equal(view.project?.allHref, "/app/projetos");
  assert.match(view.diagnostic?.body ?? "", /80\/100/);
  assert.equal(view.nextStep?.href, "/aulas/destino-e-mensuracao");
});

test("recomendação LEARN abre conteúdo e WAIT não inventa tarefa", () => {
  const learn = buildStudentHome(input({
    project: { id: "proj-1", name: "Negócio", score: null, bottleneck: null, recommendation: "Estude o canal", otherProjects: false },
    next: { kind: "learn", title: "Estruture uma campanha de Pesquisa", href: "/aulas/campanha-de-pesquisa" },
  }));
  assert.equal(learn.nextStep?.cta, "Abrir conteúdo");
  const wait = buildStudentHome(input({
    project: { id: "proj-1", name: "Negócio", score: 70, bottleneck: "Mensuração", recommendation: null, otherProjects: false },
    diagnostic: "completed",
    next: { kind: "wait", title: "Revisão da campanha" },
  }));
  assert.match(wait.nextStep?.body ?? "", /melhor próximo passo é aguardar/);
  assert.equal(wait.nextStep?.cta, null);
});

test("tarefas abertas aparecem e a seção some quando não há", () => {
  const view = buildStudentHome(input({
    project: { id: "proj-1", name: "Negócio", score: null, bottleneck: null, recommendation: null, otherProjects: false },
    tasks: [
      { title: "Validar conversão do formulário", status: "TODO", priority: "HIGH", dueAt: "2026-10-10T12:00:00.000Z" },
      { title: "Preparar palavras-chave", status: "TODO", priority: "LOW", dueAt: null },
      { title: "Revisar campanha", status: "IN_PROGRESS", priority: "MEDIUM", dueAt: null },
      { title: "Quarta ação", status: "TODO", priority: "HIGH", dueAt: null },
    ],
  }));
  assert.equal(view.tasks?.items.length, 3);
  assert.equal(view.tasks?.items[0], "Validar conversão do formulário");
  assert.equal(buildStudentHome(input()).tasks, null);
});

test("aula paga sem acesso não vira compra e com acesso continua", () => {
  const locked = recommendedAccess({
    slug: "destino-e-mensuracao",
    title: "Destino",
    access: "PAID",
    commerce: "NOT_FOR_SALE",
    entitled: false,
    forSale: false,
    reason: "Seu diagnóstico indicou este passo.",
  });
  assert.equal(locked.label, "Ver prévia");
  assert.equal(locked.note, "Disponível em breve.");
  const owned = recommendedAccess({
    slug: "destino-e-mensuracao",
    title: "Destino",
    access: "PAID",
    commerce: "AVAILABLE",
    entitled: true,
    forSale: true,
    reason: "Continuar.",
  });
  assert.equal(owned.label, "Continuar aula");
  assert.equal(owned.note, null);
  const view = buildStudentHome(input({ lockedCount: 4, openCount: 3, completedCount: 1, inProgressCount: 1 }));
  assert.equal(view.progress.locked, 4);
  assert.match(view.progress.note ?? "", /sem acesso/);
  assert.equal(view.progress.percent, Math.round((1 / 5) * 100));
});

test("índice da aula fica sticky com a logo e no mobile não vira sidebar", () => {
  assert.equal(lessonRail.logoHref, "/");
  assert.equal(lessonRail.logoLabel, "Página inicial — Alexandre Feio");
  assert.match(lessonRail.desktopClass, /sticky/);
  assert.equal(lessonRail.desktopClass.includes("fixed"), false);
  assert.match(lessonRail.desktopClass, /overflow-y-auto/);
  assert.match(lessonRail.desktopClass, /lg:block/);
  assert.match(lessonRail.mobileClass, /lg:hidden/);
  assert.equal(lessonRail.appliesInReader, true);
  assert.equal(lessonRail.appliesInAdminPreview, true);
  assert.equal(lessonRailSectionState(1, 1), "Você está aqui");
  assert.equal(lessonRailSectionState(0, 1), "Já passou");
  assert.equal(lessonRailSectionState(2, 1), "Adiante");
});
