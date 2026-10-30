import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseJourney } from "../src/components/learning/CourseJourney";
import { StudentCourseHub } from "../src/components/learning/StudentCourseHub";
import { selectCourseMaterial } from "../src/lib/learning/course-material";
import { buildCourseJourney, lessonStudyFromRecord, type JourneyLessonInput, type JourneyModuleInput } from "../src/lib/learning/course-journey";
import { buildStudentCourseHub, type StudentCourseHubSource } from "../src/lib/learning/student-course-hub";

function lesson(id: string, slug: string, title: string, patch: Partial<JourneyLessonInput> = {}): JourneyLessonInput {
  return {
    id,
    slug,
    title,
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

function moduleRow(id: string, title: string, lessons: JourneyLessonInput[]): JourneyModuleInput {
  return { id, slug: id, title, description: title, lessons };
}

function hubSource(courses: StudentCourseHubSource["courses"]): StudentCourseHubSource {
  return { viewerId: "user-a", courses };
}

test("o hub mostra todo curso publicado e leva à jornada, não à aula", () => {
  const trafficLesson = lesson("t1", "como-funciona-o-trafego-pago", "Como funciona o tráfego", {
    accessType: "FREE",
    inProgress: true,
    lastActiveAt: new Date("2026-10-20"),
  });
  const sitesLesson = lesson("s1", "site-ajuda-a-vender", "Seu site ajuda a vender", { accessType: "FREE" });
  const empty = hubSource([
    { course: { slug: "trafego-pago-na-pratica", title: "Tráfego Pago", subtitle: null, description: "Tráfego." }, modules: [moduleRow("antes-de-investir", "Antes de investir", [lesson("t0", "como-funciona-o-trafego-pago", "Como funciona", { accessType: "FREE" })])], landingPages: [] },
    { course: { slug: "sites-que-convertem", title: "Sites que Convertem", subtitle: null, description: "Sites." }, modules: [moduleRow("antes-de-construir", "Antes de construir", [lesson("s0", "site-ajuda-a-vender", "Mapa", { accessType: "FREE" })])], landingPages: [] },
  ]);
  const none = buildStudentCourseHub(empty);
  assert.deepEqual(none.courses.map((course) => course.slug), ["trafego-pago-na-pratica", "sites-que-convertem"]);
  assert.equal(none.courses.every((course) => course.statusLabel === "Ainda não iniciado"), true);
  assert.equal(none.courses.every((course) => course.ctaLabel === "Conhecer curso"), true);
  assert.deepEqual(none.courses.map((course) => course.href), ["/app/cursos/trafego-pago-na-pratica", "/app/cursos/sites-que-convertem"]);

  const onlyTraffic = buildStudentCourseHub(hubSource([
    { course: { slug: "trafego-pago-na-pratica", title: "Tráfego Pago", subtitle: null, description: "Tráfego." }, modules: [moduleRow("antes-de-investir", "Antes de investir", [trafficLesson])], landingPages: [] },
    { course: { slug: "sites-que-convertem", title: "Sites que Convertem", subtitle: null, description: "Sites." }, modules: [moduleRow("antes-de-construir", "Antes de construir", [sitesLesson])], landingPages: [] },
  ]));
  const traffic = onlyTraffic.courses.find((course) => course.slug === "trafego-pago-na-pratica");
  const sites = onlyTraffic.courses.find((course) => course.slug === "sites-que-convertem");
  assert.equal(traffic?.statusLabel, "Em andamento");
  assert.equal(traffic?.ctaLabel, "Continuar curso");
  assert.equal(traffic?.href, "/app/cursos/trafego-pago-na-pratica");
  assert.match(traffic?.positionLabel ?? "", /Como funciona o tráfego/);
  assert.equal((traffic?.positionLabel ?? "").includes("Seu site ajuda a vender"), false);
  assert.equal(sites?.statusLabel, "Ainda não iniciado");
  assert.equal(sites?.href, "/app/cursos/sites-que-convertem");
  assert.equal(traffic?.completedLessonCount, 0);
  assert.equal(lessonStudyFromRecord({ completedAt: null }), "in_progress");

  const onlySites = buildStudentCourseHub(hubSource([
    { course: { slug: "trafego-pago-na-pratica", title: "Tráfego Pago", subtitle: null, description: "Tráfego." }, modules: [moduleRow("antes-de-investir", "Antes de investir", [lesson("t0", "como-funciona-o-trafego-pago", "Como funciona", { accessType: "FREE" })])], landingPages: [] },
    { course: { slug: "sites-que-convertem", title: "Sites que Convertem", subtitle: null, description: "Sites." }, modules: [moduleRow("antes-de-construir", "Antes de construir", [lesson("s1", "site-ajuda-a-vender", "Seu site ajuda a vender", { accessType: "FREE", inProgress: true, lastActiveAt: new Date("2026-10-21") })])], landingPages: [] },
  ]));
  assert.equal(onlySites.courses.find((course) => course.slug === "trafego-pago-na-pratica")?.statusLabel, "Ainda não iniciado");
  assert.equal(onlySites.courses.find((course) => course.slug === "sites-que-convertem")?.statusLabel, "Em andamento");

  const partial = buildStudentCourseHub(hubSource([
    {
      course: { slug: "trafego-pago-na-pratica", title: "Tráfego Pago", subtitle: null, description: "Tráfego." },
      modules: [moduleRow("antes-de-investir", "Antes de investir", [
        lesson("free", "como-funciona-o-trafego-pago", "Como funciona", { accessType: "FREE", completed: true }),
        lesson("paid", "objetivo-oferta-orcamento", "Brief", {}),
      ])],
      landingPages: [],
    },
  ]));
  assert.equal(partial.courses[0]?.status, "available_complete");
  assert.equal(partial.courses[0]?.statusLabel, "Você concluiu as aulas que possui");
  assert.equal(partial.courses[0]?.ctaLabel, "Ver jornada");
  assert.equal(partial.courses[0]?.href, "/app/cursos/trafego-pago-na-pratica");

  const preview = buildStudentCourseHub(hubSource([
    {
      course: { slug: "sites-que-convertem", title: "Sites que Convertem", subtitle: null, description: "Sites." },
      modules: [moduleRow("publique-mea-e-melhore", "Publique", [lesson("pub", "revisao-antes-do-trafego", "Publicar", { entitled: true, completed: true })])],
      landingPages: [{ id: "p", title: "Página", userId: "user-a", status: "READY_TO_PREVIEW", publishedPublicationId: null, updatedAt: new Date("2026-10-02") }],
    },
  ]));
  assert.equal(preview.courses[0]?.statusLabel, "Aulas concluídas · publicação pendente");
  assert.equal(preview.courses[0]?.statusLabel.includes("publicada"), false);

  const html = renderToStaticMarkup(createElement(StudentCourseHub, { hub: onlyTraffic }));
  assert.equal(html.includes("/aulas/"), false);
  assert.match(html, /Tráfego Pago/);
  assert.match(html, /Sites que Convertem/);
  assert.match(html, /sm:grid-cols-2/);

  const page = readFileSync(new URL("../src/app/(app)/app/aprendizado/page.tsx", import.meta.url), "utf8");
  const loader = readFileSync(new URL("../src/lib/learning/load-student-course-hub.ts", import.meta.url), "utf8");
  assert.match(page, /loadStudentCourseHub/);
  assert.equal(page.includes("learningLists"), false);
  assert.equal(page.includes("continueStudying"), false);
  assert.equal(page.includes("/aulas/"), false);
  assert.match(loader, /listPublishedCourses/);
  assert.match(loader, /lessonStudyFromRecord/);
  assert.equal(loader.includes("isLessonComplete"), false);
  assert.equal(loader.includes("percent"), false);
  assert.equal(loader.includes(".create("), false);
});

test("notas e marcadores ficam no curso da aula e preservam o bloco", () => {
  const material = selectCourseMaterial(
    new Set(["site-lesson"]),
    [
      { id: "n-traffic", lessonId: "traffic-lesson", lessonSlug: "como-funciona-o-trafego-pago", lessonTitle: "Tráfego", blockKey: "bloco-t", body: "Nota de tráfego" },
      { id: "n-site", lessonId: "site-lesson", lessonSlug: "site-ajuda-a-vender", lessonTitle: "Sites", blockKey: "bloco-s", body: "Nota de sites" },
    ],
    [
      { id: "b-traffic", lessonId: "traffic-lesson", lessonSlug: "como-funciona-o-trafego-pago", lessonTitle: "Tráfego", blockKey: "marca-t" },
      { id: "b-site", lessonId: "site-lesson", lessonSlug: "site-ajuda-a-vender", lessonTitle: "Sites", blockKey: "marca-s" },
    ],
    { "site-lesson:bloco-s": "Seção do site", "traffic-lesson:bloco-t": "Seção do tráfego" },
  );
  assert.deepEqual(material.notes.map((note) => note.body), ["Nota de sites"]);
  assert.equal(material.notes[0]?.href, "/aulas/site-ajuda-a-vender#b-bloco-s");
  assert.equal(material.notes[0]?.sectionTitle, "Seção do site");
  assert.deepEqual(material.bookmarks.map((bookmark) => bookmark.id), ["b-site"]);
  assert.equal(material.bookmarks[0]?.href, "/aulas/site-ajuda-a-vender#b-marca-s");

  const trafficOnly = selectCourseMaterial(new Set(["traffic-lesson"]), [
    { id: "n-traffic", lessonId: "traffic-lesson", lessonSlug: "como-funciona-o-trafego-pago", lessonTitle: "Tráfego", blockKey: "bloco-t", body: "Nota de tráfego" },
    { id: "n-site", lessonId: "site-lesson", lessonSlug: "site-ajuda-a-vender", lessonTitle: "Sites", blockKey: "bloco-s", body: "Nota de sites" },
  ], [
    { id: "b-traffic", lessonId: "traffic-lesson", lessonSlug: "como-funciona-o-trafego-pago", lessonTitle: "Tráfego", blockKey: "marca-t" },
    { id: "b-site", lessonId: "site-lesson", lessonSlug: "site-ajuda-a-vender", lessonTitle: "Sites", blockKey: "marca-s" },
  ], {});
  assert.deepEqual(trafficOnly.notes.map((note) => note.body), ["Nota de tráfego"]);
  assert.deepEqual(trafficOnly.bookmarks.map((bookmark) => bookmark.id), ["b-traffic"]);
  assert.equal(trafficOnly.notes[0]?.href, "/aulas/como-funciona-o-trafego-pago#b-bloco-t");

  const view = buildCourseJourney({
    viewerId: "user-a",
    course: { slug: "sites-que-convertem", title: "Sites", subtitle: null, description: "Sites." },
    modules: [moduleRow("antes-de-construir", "Antes de construir", [lesson("s1", "site-ajuda-a-vender", "Mapa", { accessType: "FREE" })])],
    landingPages: [],
  });
  const html = renderToStaticMarkup(createElement(CourseJourney, { view: view!, material }));
  assert.match(html, /Nota de sites/);
  assert.equal(html.includes("Nota de tráfego"), false);
  assert.match(html, /#b-bloco-s/);
  assert.match(html, /Seu material neste curso/);

  const loader = readFileSync(new URL("../src/lib/learning/load-course-journey.ts", import.meta.url), "utf8");
  assert.match(loader, /lessonNote.findMany/);
  assert.match(loader, /lessonBookmark.findMany/);
  assert.match(loader, /lessonId: \{ in: lessonIds \}/);
});
