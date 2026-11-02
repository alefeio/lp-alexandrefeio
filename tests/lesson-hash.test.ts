import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { lesson01Blocks } from "../src/lib/learning/lesson-01";
import { blockKeyFromHash, openingStageId } from "../src/lib/learning/lesson-hash";
import { buildLessonStages } from "../src/lib/learning/lesson-stages";

const keys = lesson01Blocks.map((block) => block.blockKey);
const stages = buildLessonStages(lesson01Blocks);
const middle = "cinco-partes-trafego";

test("hash legado e canônico abrem a mesma etapa, e o hash vence a retomada", () => {
  const legacy = openingStageId({ hash: `#${middle}`, blockKeys: keys, stages, resume: true, resumeBlockId: keys[0] ?? null });
  const canonical = openingStageId({ hash: `#b-${middle}`, blockKeys: keys, stages, resume: true, resumeBlockId: keys[0] ?? null });
  assert.equal(blockKeyFromHash(`#${middle}`, keys), middle);
  assert.equal(blockKeyFromHash(`#b-${middle}`, keys), middle);
  assert.equal(legacy, canonical);
  assert.notEqual(legacy, stages[0]?.id);
  assert.equal(legacy, stages.find((stage) => stage.blocks.some((block) => block.blockKey === middle))?.id);
  assert.equal(openingStageId({ hash: "", blockKeys: keys, stages, resume: true, resumeBlockId: middle }), legacy);
  assert.equal(openingStageId({ hash: "", blockKeys: keys, stages, resume: false, resumeBlockId: middle }), stages[0]?.id);
});

test("hash inválido ou de outro bloco não quebra e não resolve fora da aula", () => {
  for (const hash of ["", "#", "#B-MAIUSCULO", "#../segredo", "#bloco_invalido", "#nao-existe-nesta-aula"]) {
    assert.equal(blockKeyFromHash(hash, keys), null);
  }
  assert.equal(blockKeyFromHash("#cinco-partes-trafego", ["outro-bloco"]), null);
  assert.equal(openingStageId({ hash: "#nao-existe-nesta-aula", blockKeys: keys, stages, resume: false, resumeBlockId: null }), stages[0]?.id);
});

test("o deep link trava o salto antes de focar o bloco e não marca leitura", () => {
  const reader = readFileSync(new URL("../src/components/learning/LessonReader.tsx", import.meta.url), "utf8");
  const hashEffect = reader.slice(reader.indexOf("if (hashKey && !chosenStageId"), reader.indexOf("if (!stageMoved.current)"));
  const lock = hashEffect.indexOf("jumpLock.current = true");
  const focus = hashEffect.indexOf("focusBlock(hashKey)");
  assert.ok(lock >= 0 && focus > lock);
  assert.equal(hashEffect.includes("setChosenStageId"), false);
  assert.equal(hashEffect.includes("setActiveStageId"), false);
  assert.equal(hashEffect.includes("saveViewedBlocks"), false);
  assert.equal(hashEffect.includes("markViewed"), false);
  assert.equal(hashEffect.includes("readingKeysFromUserScroll"), false);
  assert.match(reader, /useSyncExternalStore/);
  assert.match(reader, /chosenStageId \?\? hashStageId \?\? resumeStage/);
  assert.match(reader, /getElementById\(`b-\$\{hashKey\}`\)/);
  assert.match(reader, /getElementById\(`b-\$\{blockKey\}`\)/);
});
