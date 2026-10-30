import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseJourney } from "../src/components/learning/CourseJourney";
import { activeStudentItem } from "../src/lib/home/student-nav";
import {
  buildCourseJourney,
  JOURNEY_PUBLICATION_LESSON_SLUG,
  courseLandingPicture,
  lessonStudyFromRecord,
  type CourseJourneySource,
  type JourneyLessonInput,
  type JourneyModuleInput,
  type LandingPageJourneyInput,
} from "../src/lib/learning/course-journey";
import { isLessonComplete, type ProgressRuleBlock } from "../src/lib/learning/progress";
import { SITE_PUBLICATION_SLUG } from "../src/lib/landing-page/publication/lesson-flow";
import { needsSession } from "../src/proxy";

const text: ProgressRuleBlock = {
  blockKey: "text-caminho",
  countsForProgress: true,
  required: true,
  retiredAt: null,
  data: { type: "TEXT", body: "Texto da aula." },
};

function lesson(id: string, slug: string, patch: Partial<JourneyLessonInput> = {}): JourneyLessonInput {
  return {
    id,
    slug,
    title: slug,
    summary: "",
    accessType: "PAID",
    entitled: false,
    completed: false,
    inProgress: false,
    lastActiveAt: null,
    resultSaved: false,
    ...patch,
  };
}

function moduleRow(id: string, title: string, lessons: JourneyLessonInput[], description = `Objetivo de ${title}.`): JourneyModuleInput {
  return { id, title, description, lessons };
}

function page(patch: Partial<LandingPageJourneyInput> & Pick<LandingPageJourneyInput, "id" | "status" | "updatedAt">): LandingPageJourneyInput {
  return { title: patch.id, userId: "user-a", publishedPublicationId: null, ...patch };
}

function source(slug: string, modules: JourneyModuleInput[], landingPages: LandingPageJourneyInput[] = []): CourseJourneySource {
  return {
    viewerId: "user-a",
    course: { slug, title: slug === "trafego-pago-na-pratica" ? "Tráfego Pago na Prática" : "Sites que Convertem", subtitle: null, description: "Descrição." },
    modules,
    landingPages,
  };
}

test("a jornada não conclui aula por percentual e preserva isLessonComplete", () => {
  assert.equal(lessonStudyFromRecord(null), "not_started");
  assert.equal(lessonStudyFromRecord({ completedAt: null }), "in_progress");
  assert.equal(lessonStudyFromRecord({ completedAt: new Date("2026-10-01") }), "completed");
  assert.equal(isLessonComplete([text], {}, false), false);
  assert.equal(isLessonComplete([text], { "text-caminho": { viewed: true } }, false), true);
  const journey = readFileSync(new URL("../src/lib/learning/course-journey.ts", import.meta.url), "utf8");
  const loader = readFileSync(new URL("../src/lib/learning/load-course-journey.ts", import.meta.url), "utf8");
  assert.equal(journey.includes("isLessonComplete"), false);
  assert.equal(journey.includes("progressPercent"), false);
  assert.equal(loader.includes("percent"), false);
  assert.equal(JOURNEY_PUBLICATION_LESSON_SLUG, SITE_PUBLICATION_SLUG);
});

test("aluno sem progresso começa pela primeira aula acessível", () => {
  const view = buildCourseJourney(
    source("trafego-pago-na-pratica", [
      moduleRow("m1", "Antes de investir", [lesson("l1", "como-funciona-o-trafego-pago", { accessType: "FREE", title: "Como funciona" })]),
      moduleRow("m2", "Google Ads na prática", [lesson("l2", "campanha-de-pesquisa", { title: "Pesquisa" })]),
    ]),
  );
  assert.ok(view);
  assert.equal(view.status, "not_started");
  assert.equal(view.progressLabel, "0 de 2 aulas publicadas");
  assert.equal(view.accessLabel, "0 de 1 aula acessível");
  assert.equal(view.primary?.label, "Começar");
  assert.equal(view.primary?.href, "/aulas/como-funciona-o-trafego-pago");
  assert.equal(view.phases[1]?.lessons[0]?.cta, "Ver prévia");
  assert.equal(view.phases[1]?.lessons[0]?.statusLabel, "Não adquirida");
  assert.equal(view.campaignExecuted, false);
  assert.equal(view.sequentialGate, false);
  assert.match(view.independenceNote ?? "", /Google e Meta/);
  const html = renderToStaticMarkup(createElement(CourseJourney, { view }));
  assert.match(html, /Você está aqui/);
  assert.match(html, /Começar/);
  assert.match(html, /Como funciona/);
});

test("retomada usa a última atividade e o link de continuar", () => {
  const view = buildCourseJourney(
    source("trafego-pago-na-pratica", [
      moduleRow("m1", "Antes de investir", [
        lesson("l1", "como-funciona-o-trafego-pago", { accessType: "FREE", completed: true, title: "Mapa" }),
      ]),
      moduleRow("google", "Google Ads na prática", [
        lesson("g1", "campanha-de-pesquisa", { entitled: true, inProgress: true, lastActiveAt: new Date("2026-08-01"), title: "Pesquisa" }),
      ]),
      moduleRow("meta", "Meta Ads na prática", [
        lesson("m1l", "objetivo-publico-estrutura", { entitled: true, inProgress: true, lastActiveAt: new Date("2026-10-20"), title: "Meta" }),
      ]),
    ]),
  );
  assert.ok(view);
  assert.equal(view.status, "in_progress");
  assert.equal(view.here?.lessonTitle, "Meta");
  assert.equal(view.primary?.href, "/aulas/objetivo-publico-estrutura?continuar=1");
  assert.equal(view.phases.find((phase) => phase.id === "google")?.status, "in_progress");
  assert.equal(view.phases.find((phase) => phase.id === "meta")?.status, "in_progress");
  assert.equal(view.phases.find((phase) => phase.id === "google")?.lessons[0]?.cta, "Continuar");
  assert.equal(view.sequentialGate, false);
  assert.equal(view.coursePromiseMet, false);
});

test("google e meta não se bloqueiam quando só um foi iniciado", () => {
  const view = buildCourseJourney(
    source("trafego-pago-na-pratica", [
      moduleRow("google", "Google Ads na prática", [lesson("g1", "campanha-de-pesquisa", { entitled: true, title: "Pesquisa" })]),
      moduleRow("meta", "Meta Ads na prática", [lesson("m1", "objetivo-publico-estrutura", { entitled: true, inProgress: true, lastActiveAt: new Date("2026-10-02"), title: "Meta" })]),
    ]),
  );
  assert.ok(view);
  assert.equal(view.phases[0]?.status, "not_started");
  assert.equal(view.phases[0]?.lessons[0]?.cta, "Começar");
  assert.equal(view.phases[1]?.status, "in_progress");
  assert.equal(view.phases[1]?.lessons[0]?.href, "/aulas/objetivo-publico-estrutura?continuar=1");
  assert.equal(view.here?.lessonTitle, "Meta");
});

test("acesso gratuito, compra parcial e curso integral distinguem conclusão", () => {
  const freeOnly = buildCourseJourney(
    source("trafego-pago-na-pratica", [
      moduleRow("m1", "Antes de investir", [lesson("free", "como-funciona-o-trafego-pago", { accessType: "FREE", completed: true })]),
      moduleRow("m2", "Planeje antes de anunciar", [lesson("paid", "objetivo-oferta-orcamento")]),
    ]),
  );
  assert.equal(freeOnly?.status, "available_complete");
  assert.equal(freeOnly?.progressLabel, "1 de 2 aulas publicadas");
  assert.equal(freeOnly?.statusLabel, "Aulas disponíveis concluídas");
  assert.equal(freeOnly?.coursePromiseMet, false);
  assert.equal(freeOnly?.primary?.label, "Ver a prévia da próxima aula");

  const partial = buildCourseJourney(
    source("trafego-pago-na-pratica", [
      moduleRow("m1", "Antes de investir", [
        lesson("free", "como-funciona-o-trafego-pago", { accessType: "FREE", completed: true }),
        lesson("owned", "google-ads-ou-meta-ads", { entitled: true, completed: true }),
        lesson("locked", "negocio-pronto-para-anunciar"),
      ]),
    ]),
  );
  assert.equal(partial?.status, "available_complete");
  assert.equal(partial?.accessLabel, "2 de 2 aulas acessíveis");
  assert.equal(partial?.coursePromiseMet, false);

  const ownedOpen = buildCourseJourney(
    source("trafego-pago-na-pratica", [
      moduleRow("m1", "Antes de investir", [
        lesson("a", "como-funciona-o-trafego-pago", { accessType: "FREE", completed: true }),
        lesson("b", "google-ads-ou-meta-ads", { entitled: true, inProgress: true, lastActiveAt: new Date("2026-10-03") }),
      ]),
    ]),
  );
  assert.equal(ownedOpen?.status, "in_progress");
  assert.equal(ownedOpen?.accessibleLessonCount, ownedOpen?.publishedLessonCount);

  const done = buildCourseJourney(
    source("trafego-pago-na-pratica", [
      moduleRow("m1", "Antes de investir", [lesson("a", "como-funciona-o-trafego-pago", { accessType: "FREE", completed: true, resultSaved: true })]),
      moduleRow("m2", "Entenda e melhore os resultados", [lesson("b", "o-que-mudar", { entitled: true, completed: true })]),
    ]),
  );
  assert.equal(done?.status, "lessons_complete");
  assert.equal(done?.coursePromiseMet, true);
  assert.equal(done?.campaignExecuted, false);
  assert.equal(done?.accessLabel, null);
  assert.match(done?.outcomeNote ?? "", /campanha executada/);
  assert.equal(done?.artifacts[0]?.label, "Resultado salvo");
  assert.equal(done?.artifacts[0]?.produced, false);
  assert.equal(done?.artifacts[1]?.label, "Aula concluída");
});

test("sites separa rascunho, prévia e publicação e não vaza projeto de outro aluno", () => {
  const modules = [
    moduleRow("m1", "Antes de construir", [lesson("a", "site-ajuda-a-vender", { accessType: "FREE", completed: true, resultSaved: true })]),
    moduleRow("m2", "Publique, meça e melhore", [lesson("pub", JOURNEY_PUBLICATION_LESSON_SLUG, { entitled: true, completed: true, resultSaved: true, title: "Publicar" })]),
  ];
  const preview = buildCourseJourney(
    source("sites-que-convertem", modules, [page({ id: "preview", status: "READY_TO_PREVIEW", updatedAt: new Date("2026-10-02") })]),
  );
  assert.equal(preview?.coursePromiseMet, false);
  assert.equal(preview?.status, "lessons_complete");
  assert.match(preview?.landing?.label ?? "", /não é uma publicação/);
  assert.equal(preview?.artifacts.find((item) => item.id === "pub")?.produced, false);
  assert.match(preview?.artifacts.find((item) => item.id === "pub")?.label ?? "", /ainda não publicada/);

  const draft = buildCourseJourney(source("sites-que-convertem", modules, [page({ id: "draft", status: "DRAFT", updatedAt: new Date("2026-10-02") })]));
  assert.match(draft?.landing?.label ?? "", /rascunho/i);
  assert.equal(draft?.coursePromiseMet, false);

  const live = buildCourseJourney(
    source("sites-que-convertem", modules, [page({ id: "live", status: "PUBLISHED", publishedPublicationId: "pub-1", updatedAt: new Date("2026-10-02") })]),
  );
  assert.equal(live?.coursePromiseMet, true);
  assert.equal(live?.artifacts.find((item) => item.id === "pub")?.produced, true);
  assert.equal(live?.artifacts.find((item) => item.id === "pub")?.label, "Landing page publicada");

  const missingPointer = courseLandingPicture("user-a", [page({ id: "broken", status: "PUBLISHED", publishedPublicationId: null, updatedAt: new Date("2026-10-02") })]);
  assert.equal(missingPointer.published, false);
  assert.notEqual(missingPointer.state, "PUBLISHED");

  const foreign = buildCourseJourney(
    source("sites-que-convertem", modules, [page({ id: "foreign", userId: "user-b", status: "PUBLISHED", publishedPublicationId: "pub-1", updatedAt: new Date("2026-10-02") })]),
  );
  assert.equal(foreign?.landing?.state, "none");
  assert.match(foreign?.landing?.label ?? "", /ainda não começou/);
  assert.equal(foreign?.coursePromiseMet, false);

  const empty = buildCourseJourney(source("sites-que-convertem", [moduleRow("m1", "Antes de construir", [lesson("a", "site-ajuda-a-vender", { accessType: "FREE" })])]));
  assert.match(empty?.landing?.label ?? "", /ainda não começou/);
  assert.equal(empty?.artifacts[0]?.label, "Resultado esperado");
  assert.equal(empty?.artifacts[0]?.produced, false);
});

test("várias landing pages preservam uma publicação anterior e ignoram outro aluno", () => {
  const modules = [
    moduleRow("m1", "Antes de construir", [lesson("a", "site-ajuda-a-vender", { accessType: "FREE", completed: true, resultSaved: true })]),
    moduleRow("m2", "Publique, meça e melhore", [lesson("pub", JOURNEY_PUBLICATION_LESSON_SLUG, { entitled: true, completed: true, resultSaved: true })]),
  ];
  const publishedThenDraft = buildCourseJourney(
    source("sites-que-convertem", modules, [
      page({ id: "old", status: "PUBLISHED", publishedPublicationId: "pub-1", updatedAt: new Date("2026-08-01") }),
      page({ id: "new", status: "DRAFT", updatedAt: new Date("2026-10-20") }),
    ]),
  );
  assert.equal(publishedThenDraft?.landing?.published, true);
  assert.equal(publishedThenDraft?.coursePromiseMet, true);
  assert.equal(publishedThenDraft?.artifacts.find((item) => item.id === "pub")?.produced, true);
  assert.equal(publishedThenDraft?.artifacts.find((item) => item.id === "pub")?.label, "Landing page publicada");
  assert.equal(`${publishedThenDraft?.landing?.label} ${publishedThenDraft?.outcomeNote}`.includes("a landing page ainda não está publicada"), false);

  const publishedThenPreview = buildCourseJourney(
    source("sites-que-convertem", modules, [
      page({ id: "old", status: "PUBLISHED", publishedPublicationId: "pub-1", updatedAt: new Date("2026-08-01") }),
      page({ id: "new", status: "READY_TO_PREVIEW", updatedAt: new Date("2026-10-21") }),
    ]),
  );
  assert.equal(publishedThenPreview?.landing?.published, true);
  assert.equal(publishedThenPreview?.coursePromiseMet, true);
  assert.equal(publishedThenPreview?.artifacts.find((item) => item.id === "pub")?.produced, true);
  assert.equal(`${publishedThenPreview?.landing?.label} ${publishedThenPreview?.outcomeNote}`.includes("a landing page ainda não está publicada"), false);

  const nonePublished = buildCourseJourney(
    source("sites-que-convertem", modules, [
      page({ id: "draft", status: "DRAFT", updatedAt: new Date("2026-09-01") }),
      page({ id: "preview", status: "READY_TO_PREVIEW", updatedAt: new Date("2026-10-22") }),
    ]),
  );
  assert.equal(nonePublished?.coursePromiseMet, false);
  assert.equal(nonePublished?.landing?.published, false);
  assert.equal(nonePublished?.landing?.state, "READY_TO_PREVIEW");
  assert.match(nonePublished?.landing?.label ?? "", /não é uma publicação/);
  assert.equal(nonePublished?.artifacts.find((item) => item.id === "pub")?.produced, false);

  const unpublishedHistory = buildCourseJourney(
    source("sites-que-convertem", modules, [
      page({ id: "retired", status: "UNPUBLISHED", publishedPublicationId: "pub-old", updatedAt: new Date("2026-10-23") }),
    ]),
  );
  assert.equal(unpublishedHistory?.landing?.published, false);
  assert.equal(unpublishedHistory?.coursePromiseMet, false);
  assert.equal(unpublishedHistory?.artifacts.find((item) => item.id === "pub")?.produced, false);
  assert.match(unpublishedHistory?.landing?.label ?? "", /fora do ar/i);

  const foreignPublished = buildCourseJourney(
    source("sites-que-convertem", modules, [
      page({ id: "other", userId: "user-b", status: "PUBLISHED", publishedPublicationId: "pub-b", updatedAt: new Date("2026-10-24") }),
      page({ id: "mine", status: "DRAFT", updatedAt: new Date("2026-10-01") }),
    ]),
  );
  assert.equal(foreignPublished?.landing?.published, false);
  assert.equal(foreignPublished?.landing?.state, "DRAFT");
  assert.equal(foreignPublished?.coursePromiseMet, false);
});

test("os dois cursos usam os módulos recebidos e não travam a fase seguinte", () => {
  const traffic = buildCourseJourney(
    source("trafego-pago-na-pratica", [
      moduleRow("a", "Antes de investir", [lesson("1", "como-funciona-o-trafego-pago", { accessType: "FREE" })]),
      moduleRow("b", "Planeje antes de anunciar", [lesson("2", "objetivo-oferta-orcamento", { entitled: true })]),
      moduleRow("c", "Google Ads na prática", [lesson("3", "campanha-de-pesquisa", { entitled: true })]),
      moduleRow("d", "Meta Ads na prática", [lesson("4", "objetivo-publico-estrutura", { entitled: true })]),
      moduleRow("e", "Entenda e melhore os resultados", [lesson("5", "leia-os-numeros", { entitled: true })]),
    ]),
  );
  const sites = buildCourseJourney(
    source("sites-que-convertem", [
      moduleRow("a", "Antes de construir", [lesson("1", "site-ajuda-a-vender", { accessType: "FREE" })]),
      moduleRow("b", "Planeje antes de desenhar", [lesson("2", "oferta-publico-acao-principal", { entitled: true })]),
      moduleRow("c", "Estruture e comunique", [lesson("3", "organize-as-secoes-da-pagina", { entitled: true })]),
      moduleRow("d", "Atenção e confiança", [lesson("4", "construa-confianca", { entitled: true })]),
      moduleRow("e", "Publique, meça e melhore", [lesson("5", JOURNEY_PUBLICATION_LESSON_SLUG, { entitled: true })]),
    ]),
  );
  assert.deepEqual(
    traffic?.phases.map((phase) => phase.title),
    ["Antes de investir", "Planeje antes de anunciar", "Google Ads na prática", "Meta Ads na prática", "Entenda e melhore os resultados"],
  );
  assert.deepEqual(
    sites?.phases.map((phase) => phase.title),
    ["Antes de construir", "Planeje antes de desenhar", "Estruture e comunique", "Atenção e confiança", "Publique, meça e melhore"],
  );
  assert.equal(traffic?.phases[3]?.lessons[0]?.cta, "Começar");
  assert.equal(sites?.phases[4]?.lessons[0]?.cta, "Começar");
  assert.equal(traffic?.artifacts[0]?.title, "Meu primeiro mapa de tráfego");
  assert.match(sites?.sharedProjectNote ?? "", /projeto separado/);
  assert.equal((sites?.sharedProjectNote ?? "").includes("a mesma landing page"), false);
  assert.equal(buildCourseJourney(source("trafego-pago-na-pratica", [])), null);
});

test("a rota autenticada lê o catálogo do próprio aluno e a navegação marca Meus cursos", () => {
  const page = readFileSync(new URL("../src/app/(app)/app/cursos/[slug]/page.tsx", import.meta.url), "utf8");
  const loader = readFileSync(new URL("../src/lib/learning/load-course-journey.ts", import.meta.url), "utf8");
  const publicPage = readFileSync(new URL("../src/app/(public)/cursos/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /requireSession/);
  assert.match(page, /notFound/);
  assert.match(loader, /getPublishedCourse/);
  assert.match(loader, /userId/);
  assert.match(loader, /landingPageProject.findMany/);
  assert.equal(loader.includes("findFirst"), false);
  assert.equal(loader.includes("diagnostic.create"), false);
  assert.equal(publicPage.includes("loadCourseJourney"), false);
  assert.equal(needsSession("/app/cursos/trafego-pago-na-pratica"), true);
  assert.equal(activeStudentItem("/app/cursos/trafego-pago-na-pratica"), "cursos");
  assert.equal(activeStudentItem("/cursos/trafego-pago-na-pratica"), null);
  assert.equal(activeStudentItem("/app/projetos/x/plano"), "negocio");
  assert.equal(activeStudentItem("/app/aprendizado"), "cursos");
});
