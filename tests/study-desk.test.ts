import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StudyDesk } from "../src/components/learning/StudyDesk";
import { activeStudentItem } from "../src/lib/home/student-nav";
import { studyDeskFromRecords, type DeskNoteRecord, type DeskReviewRecord } from "../src/lib/learning/study-desk";

function note(patch: Partial<DeskNoteRecord> = {}): DeskNoteRecord {
  return {
    id: "note-1",
    userId: "aluno",
    body: "Preciso verificar isso no anúncio da clínica.",
    updatedAt: new Date("2026-11-02T15:00:00.000Z"),
    blockKey: "cinco-partes-trafego",
    lessonId: "lesson-1",
    lessonSlug: "como-funciona-o-trafego-pago",
    lessonTitle: "Como funciona o tráfego pago",
    lessonStatus: "PUBLISHED",
    accessType: "FREE",
    entitled: false,
    courseTitle: "Tráfego Pago na Prática",
    blockActive: true,
    sectionTitle: "O caminho de uma campanha",
    ...patch,
  };
}

function review(patch: Partial<DeskReviewRecord> = {}): DeskReviewRecord {
  return {
    id: "review-1",
    userId: "aluno",
    createdAt: new Date("2026-11-01T15:00:00.000Z"),
    blockKey: "checkpoint-clique-conversao",
    lessonId: "lesson-1",
    lessonSlug: "como-funciona-o-trafego-pago",
    lessonTitle: "Como funciona o tráfego pago",
    lessonStatus: "PUBLISHED",
    accessType: "FREE",
    entitled: false,
    courseTitle: "Tráfego Pago na Prática",
    blockActive: true,
    sectionTitle: "O caminho de uma campanha",
    ...patch,
  };
}

test("a mesa isola o aluno, ordena e monta o deep link da seção", () => {
  const longBody = "ideia ".repeat(80);
  const desk = studyDeskFromRecords("aluno", [
    note({ id: "antiga", updatedAt: new Date("2026-10-01T15:00:00.000Z"), body: "antiga" }),
    note({ id: "outra-pessoa", userId: "intruso", body: "segredo" }),
    note({ id: "recente", updatedAt: new Date("2026-11-02T15:00:00.000Z"), body: longBody }),
  ], [
    review({ id: "marca-antiga", createdAt: new Date("2026-10-01T15:00:00.000Z") }),
    review({ id: "marca-alheia", userId: "intruso" }),
    review({ id: "marca-recente", createdAt: new Date("2026-11-03T15:00:00.000Z"), blockKey: "leilao-publicidade", sectionTitle: "Por que você paga?" }),
  ]);
  assert.deepEqual(desk.notes.map((item) => item.id), ["recente", "antiga"]);
  assert.equal(desk.notes.some((item) => item.body === "segredo"), false);
  assert.equal(desk.notes[0]?.body, longBody);
  assert.equal(desk.notes[0]?.courseTitle, "Tráfego Pago na Prática");
  assert.equal(desk.notes[0]?.lessonTitle, "Como funciona o tráfego pago");
  assert.equal(desk.notes[0]?.sectionTitle, "O caminho de uma campanha");
  assert.equal(desk.notes[0]?.href, "/aulas/como-funciona-o-trafego-pago#b-cinco-partes-trafego");
  assert.match(desk.notes[0]?.updatedLabel ?? "", /2 nov/);
  assert.deepEqual(desk.reviews.map((item) => item.id), ["marca-recente", "marca-antiga"]);
  assert.equal(desk.reviews[0]?.href, "/aulas/como-funciona-o-trafego-pago#b-leilao-publicidade");
  assert.equal(desk.reviews.some((item) => item.id === "marca-alheia"), false);
});

test("bloco removido, aula fechada e listas vazias não vazam conteúdo", () => {
  const retired = studyDeskFromRecords("aluno", [note({ blockActive: false, sectionTitle: "Segredo do bloco" })], []);
  assert.equal(retired.notes[0]?.sectionTitle, null);
  assert.equal(retired.notes[0]?.sectionFallback, "Trecho da aula atualizado");
  assert.equal(retired.notes[0]?.href, "/aulas/como-funciona-o-trafego-pago");
  assert.equal((retired.notes[0]?.body ?? "").includes("Segredo do bloco"), false);

  const paid = studyDeskFromRecords("aluno", [note({ accessType: "PAID", entitled: false, sectionTitle: "Heading pago" })], []);
  assert.equal(paid.notes[0]?.sectionTitle, null);
  assert.equal(paid.notes[0]?.href, "/aulas/como-funciona-o-trafego-pago");
  assert.equal((paid.notes[0]?.href ?? "").includes("#"), false);

  const draft = studyDeskFromRecords("aluno", [note({ lessonStatus: "DRAFT", lessonTitle: "Rascunho secreto", courseTitle: "Curso secreto" })], []);
  assert.equal(draft.notes[0]?.lessonTitle, "Aula indisponível");
  assert.equal(draft.notes[0]?.courseTitle, "");
  assert.equal(draft.notes[0]?.href, null);

  const empty = studyDeskFromRecords("aluno", [], []);
  assert.deepEqual(empty.notes, []);
  assert.deepEqual(empty.reviews, []);
  const html = renderToStaticMarkup(createElement(StudyDesk, { desk: empty, area: "tudo" }));
  assert.match(html, /Você ainda não fez anotações/);
  assert.match(html, /Você ainda não marcou nenhum conteúdo para revisar/);
  assert.match(html, /Diagnósticos/);
  assert.match(html, /href="\/app\/diagnosticos"/);
  assert.match(html, /Meu negócio/);
  assert.match(html, /href="\/app\/projetos"/);
  assert.equal(html.includes("pendência"), false);
  assert.equal(html.includes("<table"), false);
});

test("a mesa só lê os registros do usuário e continua dentro de Meus cursos", () => {
  const loader = readFileSync(new URL("../src/lib/learning/load-study-desk.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/app/(app)/app/aprendizado/mesa/page.tsx", import.meta.url), "utf8");
  const hub = readFileSync(new URL("../src/components/learning/StudentCourseHub.tsx", import.meta.url), "utf8");
  const reader = readFileSync(new URL("../src/components/learning/LessonReader.tsx", import.meta.url), "utf8");
  assert.equal(loader.includes(".create("), false);
  assert.equal(loader.includes(".update("), false);
  assert.equal(loader.includes(".delete("), false);
  assert.equal(loader.includes(".upsert("), false);
  assert.match(loader, /sectionTitlesFor/);
  assert.match(loader, /where: \{ userId \}/);
  assert.equal(page.includes("searchParams.userId"), false);
  assert.match(page, /requireSession/);
  assert.match(page, /Mesa de estudo/);
  assert.match(hub, /Abrir Mesa de estudo/);
  assert.match(reader, /Mesa de estudo/);
  assert.match(reader, /StudyDeskModal/);
  assert.equal(activeStudentItem("/app/aprendizado/mesa"), "mesa");
  assert.equal(activeStudentItem("/app/aprendizado"), "cursos");
  const desk = studyDeskFromRecords("aluno", [note()], [review()]);
  const html = renderToStaticMarkup(createElement(StudyDesk, { desk, area: "notas" }));
  assert.match(html, /line-clamp-4/);
  assert.match(html, /Abrir na aula/);
  assert.equal(html.includes("Marcado para revisar"), false);
  assert.equal(html.includes("id=\"mesa-revisar\""), false);
  assert.equal(desk.resources.some((resource) => resource.href === "/app/landing-pages"), false);
});
