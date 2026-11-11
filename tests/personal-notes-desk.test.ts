import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StudyDeskPanel } from "../src/components/learning/StudyDeskPanel";
import { activeStudentItem } from "../src/lib/home/student-nav";
import {
  studyDeskFromRecords,
  type DeskNoteRecord,
  type DeskPersonalNoteRecord,
} from "../src/lib/learning/study-desk";

function lessonNote(patch: Partial<DeskNoteRecord> = {}): DeskNoteRecord {
  return {
    id: "note-lesson",
    userId: "aluno",
    body: "Nota vinculada",
    updatedAt: new Date("2026-11-02T15:00:00.000Z"),
    blockKey: "cinco-partes-trafego",
    lessonId: "lesson-1",
    lessonSlug: "como-funciona-o-trafego-pago",
    lessonTitle: "Como funciona o tráfego pago",
    lessonStatus: "PUBLISHED",
    accessType: "FREE",
    entitled: true,
    courseTitle: "Tráfego Pago na Prática",
    blockActive: true,
    sectionTitle: "O caminho de uma campanha",
    ...patch,
  };
}

function personal(patch: Partial<DeskPersonalNoteRecord> = {}): DeskPersonalNoteRecord {
  return {
    id: "note-personal",
    userId: "aluno",
    body: "Ideia livre",
    updatedAt: new Date("2026-11-03T15:00:00.000Z"),
    lessonId: null,
    blockKey: null,
    lessonSlug: null,
    lessonTitle: null,
    lessonStatus: null,
    accessType: null,
    entitled: false,
    courseTitle: null,
    blockActive: false,
    sectionTitle: null,
    ...patch,
  };
}

test("lista unificada mistura notas de aula e pessoais sem link fictício", () => {
  const desk = studyDeskFromRecords("aluno", [lessonNote()], [], [personal(), personal({ id: "intrusa", userId: "outro" })]);
  assert.deepEqual(
    desk.notes.map((item) => item.id),
    ["note-personal", "note-lesson"],
  );
  const free = desk.notes.find((item) => item.id === "note-personal");
  assert.equal(free?.kind, "personal");
  assert.equal(free?.href, null);
  assert.equal(free?.lessonTitle, "Nota pessoal");
  assert.equal(desk.notes.some((item) => item.id === "intrusa"), false);
});

test("mesa na nav e modal não usam iframe", () => {
  assert.equal(activeStudentItem("/app/aprendizado/mesa"), "mesa");
  assert.equal(activeStudentItem("/app/aprendizado"), "cursos");
  const modal = readFileSync(new URL("../src/components/learning/StudyDeskModal.tsx", import.meta.url), "utf8");
  const reader = readFileSync(new URL("../src/components/learning/LessonReader.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/app/(learn)/aulas/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(modal, /showModal/);
  assert.equal(modal.includes("<iframe"), false);
  assert.match(reader, /StudyDeskModal/);
  assert.equal(reader.includes('href="/app/aprendizado/mesa"'), false);
  assert.match(page, /courseHref/);
  assert.match(page, /LessonContextBar/);
  assert.equal(page.includes("function LessonTrail"), false);
  assert.equal(page.includes("function LessonPlace"), false);
  const html = renderToStaticMarkup(
    createElement(StudyDeskPanel, {
      desk: studyDeskFromRecords("aluno", [lessonNote()], [], [personal()]),
      area: "notas",
      currentLessonSlug: "como-funciona-o-trafego-pago",
    }),
  );
  assert.match(html, /Nota pessoal/);
  assert.match(html, /Ideia livre/);
  assert.match(html, /Abrir na aula/);
});

test("migration de personal_note é aditiva", () => {
  const sql = readFileSync(
    new URL("../prisma/migrations/20261111010000_add_personal_note/migration.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /CREATE TABLE "personal_note"/);
  assert.equal(sql.includes("DROP TABLE"), false);
  assert.equal(sql.includes("lesson_note"), false);
});
