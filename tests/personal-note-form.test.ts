import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  personalNoteOwnerWhere,
  runPersonalNoteSave,
  type PersonalNoteActionResult,
} from "../src/lib/learning/personal-note-form";

test("save assíncrono bem-sucedido limpa o fluxo e devolve a nota", async () => {
  let calls = 0;
  const save = async (input: { body: string }): Promise<PersonalNoteActionResult> => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return {
      ok: true,
      note: { id: "n1", body: input.body, lessonId: null, blockKey: null },
    };
  };
  const typed = "Texto que deve sobreviver até o sucesso";
  const result = await runPersonalNoteSave(save, { body: typed });
  assert.equal(calls, 1);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.note.body, typed);
});

test("falha assíncrona preserva o texto para o caller reaplicar", async () => {
  const typed = "Rascunho que não pode sumir";
  const save = async (): Promise<PersonalNoteActionResult> => {
    await new Promise((resolve) => setTimeout(resolve, 15));
    return { ok: false, message: "Não foi possível salvar a nota." };
  };
  const result = await runPersonalNoteSave(save, { body: typed });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /salvar/);
  assert.equal(typed, "Rascunho que não pode sumir");
});

test("body vazio não chama o save", async () => {
  let calls = 0;
  const result = await runPersonalNoteSave(async () => {
    calls += 1;
    return { ok: true, note: { id: "x", body: "x", lessonId: null, blockKey: null } };
  }, { body: "   " });
  assert.equal(calls, 0);
  assert.equal(result.ok, false);
});

test("update e delete sempre amarram o proprietário", () => {
  assert.deepEqual(personalNoteOwnerWhere("aluno", "note-1"), { id: "note-1", userId: "aluno" });
  const actions = readFileSync(new URL("../src/lib/learning/personal-notes.ts", import.meta.url), "utf8");
  assert.match(actions, /updateMany\(/);
  assert.match(actions, /where: \{ id: existing\.id, userId \}/);
  assert.match(actions, /deleteMany\(/);
  assert.match(actions, /ownedByUser\(userId\)/);
  assert.match(actions, /ownedRecord\(userId, input\.noteId\)/);
  assert.match(actions, /updateLink/);
});

test("composer não usa event.currentTarget após await", () => {
  const composer = readFileSync(new URL("../src/components/learning/PersonalNoteComposer.tsx", import.meta.url), "utf8");
  assert.match(composer, /formRef/);
  assert.match(composer, /runPersonalNoteSave/);
  assert.equal(/await[\s\S]*currentTarget/.test(composer), false);
  assert.match(composer, /setBody\(snapshot\)/);
  assert.match(composer, /disabled=\{pending/);
});

test("mesa gerencia editar\/excluir e modal preserva aula", () => {
  const managed = readFileSync(new URL("../src/components/learning/ManagedStudyDesk.tsx", import.meta.url), "utf8");
  const modal = readFileSync(new URL("../src/components/learning/StudyDeskModal.tsx", import.meta.url), "utf8");
  const reader = readFileSync(new URL("../src/components/learning/LessonReader.tsx", import.meta.url), "utf8");
  assert.match(managed, /window\.confirm/);
  assert.match(managed, /deletePersonalNote/);
  assert.match(managed, /Editar anotação pessoal|noteId=\{editing\.id\}/);
  assert.match(modal, /showModal/);
  assert.equal(modal.includes("<iframe"), false);
  assert.match(reader, /StudyDeskModal/);
  assert.equal(reader.includes('href="/app/aprendizado/mesa"'), false);
});

test("migration aditiva e rollback sem DROP TABLE", () => {
  const sql = readFileSync(
    new URL("../prisma/migrations/20261111010000_add_personal_note/migration.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /CREATE TABLE "personal_note"/);
  assert.equal(sql.includes("DROP"), false);
  assert.equal(sql.includes("lesson_note"), false);
  const previousReader = readFileSync(new URL("../src/components/learning/StudyDesk.tsx", import.meta.url), "utf8");
  assert.equal(previousReader.includes("personalNote"), false);
});
