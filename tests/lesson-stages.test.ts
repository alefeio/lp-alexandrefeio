import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { lesson01Blocks } from "../src/lib/learning/lesson-01";
import { lesson03Blocks } from "../src/lib/learning/lesson-03";
import {
  buildLessonStages,
  firstPendingStageId,
  resumeStageId,
  stageVisitLabel,
  visualReach,
  type StageSourceBlock,
} from "../src/lib/learning/lesson-stages";
import { isLessonComplete, type ProgressRuleBlock } from "../src/lib/learning/progress";
import { siteLesson04Blocks } from "../src/lib/learning/site-oferta-publico-acao-principal";

function block(blockKey: string, type: string, extra: Partial<StageSourceBlock["data"]> = {}, retiredAt: string | null = null): StageSourceBlock {
  return { blockKey, retiredAt, data: { type, ...extra } };
}

test("o builder cobre ordem, unicidade, inativos e ids estáveis", () => {
  const blocks = [
    block("intro", "TEXT", { text: "antes" }),
    block("outro", "TEXT", { text: "ainda antes" }),
    block("titulo", "HEADING", { text: "O conceito" }),
    block("vazio", "HEADING", { text: "Não fica sozinho" }),
    block("texto", "TEXT", { text: "contexto" }),
    block("acao", "ACTIVITY", { prompt: "Decida" }),
    block("resultado", "RESULT", { title: "Seu mapa" }),
    block("sumiu", "TEXT", { text: "inativo" }, "2026-01-01"),
    block("fecha", "CONCLUSION", { text: "fim" }),
  ];
  const first = buildLessonStages(blocks);
  const second = buildLessonStages(blocks);
  assert.deepEqual(first, second);
  const keys = first.flatMap((stage) => stage.blocks.map((item) => item.blockKey));
  assert.deepEqual(keys, ["intro", "outro", "titulo", "vazio", "texto", "acao", "resultado", "fecha"]);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.includes("sumiu"), false);
  assert.equal(first.some((stage) => stage.blocks.length === 0), false);
  assert.equal(first[0].id, "stage:intro");
  assert.equal(first.at(-1)?.blocks.at(-1)?.data.type, "CONCLUSION");
  assert.equal(first[0].title, "Etapa 1");
  assert.equal(first[1].title, "O conceito");
  assert.notEqual(first[1].id, "stage-2");
});

test("textos antes do primeiro título ficam na primeira etapa e headings seguidos não criam vazio", () => {
  const stages = buildLessonStages([
    block("a", "TEXT"),
    block("b", "HEADING", { text: "Um" }),
    block("c", "HEADING", { text: "Dois" }),
    block("d", "TEXT"),
  ]);
  assert.deepEqual(stages[0].blocks.map((item) => item.blockKey), ["a"]);
  assert.deepEqual(stages[1].blocks.map((item) => item.blockKey), ["b", "c", "d"]);
  assert.equal(stages[1].title, "Um");
});

test("aula sem heading, com um bloco ou só com conclusão continua válida", () => {
  const plain = buildLessonStages([block("solo", "TEXT", { text: "só isso" })]);
  assert.equal(plain.length, 1);
  assert.equal(plain[0].blocks[0].blockKey, "solo");
  assert.equal(plain[0].title, "Etapa 1");
  const ending = buildLessonStages([block("fim", "CONCLUSION", { text: "acabou" })]);
  assert.equal(ending.length, 1);
  assert.equal(ending[0].blocks[0].data.type, "CONCLUSION");
  assert.equal(ending[0].title, "Conclusão");
  assert.equal(ending[0].id, "stage:fim");
  const named = buildLessonStages([
    block("h", "HEADING", { text: "Fechamento" }),
    block("c", "CONCLUSION"),
  ]);
  assert.equal(named.length, 1);
  assert.equal(named[0].title, "Fechamento");
  assert.equal(named[0].id, "stage:h");
});

test("a navegação visual não conclui a aula nem reduz o alcance", () => {
  const blocks = [
    block("leia", "TEXT"),
    block("faca", "ACTIVITY", { prompt: "Escreva" }),
    block("fim", "CONCLUSION"),
  ];
  const stages = buildLessonStages(blocks);
  const rules: ProgressRuleBlock[] = blocks.map((item) => ({
    blockKey: item.blockKey,
    countsForProgress: true,
    required: item.data.type === "ACTIVITY",
    retiredAt: null,
    data: item.data.type === "ACTIVITY"
      ? { type: "ACTIVITY", prompt: "Escreva", inputType: "short_text" }
      : item.data.type === "CONCLUSION"
        ? { type: "CONCLUSION", body: "fim" }
        : { type: "TEXT", body: "leia" },
  }));
  assert.equal(stages.at(-1)?.id, resumeStageId(stages, "fim"));
  assert.equal(isLessonComplete(rules, {}, false), false);
  assert.equal(firstPendingStageId(stages, ["faca"]), resumeStageId(stages, "faca"));
  let reach = visualReach(0, 0);
  reach = visualReach(reach, 2);
  reach = visualReach(reach, 0);
  assert.equal(reach, 2);
  assert.equal(stageVisitLabel(0, 0, [0, 2]), "Atual");
  assert.equal(stageVisitLabel(2, 0, [0, 2]), "Visitada");
  assert.equal(stageVisitLabel(1, 0, [0, 2]), "A seguir");
});

test("a retomada abre a etapa do bloco, não a primeira nem a última", () => {
  const stages = buildLessonStages(lesson01Blocks);
  const activity = lesson01Blocks.find((item) => item.blockKey === "atividade-primeiro-mapa");
  assert.ok(activity);
  const stageId = resumeStageId(stages, activity.blockKey);
  assert.equal(stageId, `stage:${stages.find((stage) => stage.blocks.some((item) => item.blockKey === activity.blockKey))?.firstBlockId}`);
  assert.notEqual(stageId, stages[0].id);
  assert.notEqual(stageId, stages.at(-1)?.id);
  assert.equal(stages.at(-1)?.blocks.some((item) => item.data.type === "CONCLUSION"), true);
  assert.equal(stages.at(-1)?.title, "Conclusão");
  assert.equal(stages.flatMap((stage) => stage.blocks).length, lesson01Blocks.length);
});

test("tráfego, sites e aula com ferramenta permanecem inteiras no builder", () => {
  for (const source of [lesson01Blocks, lesson03Blocks, siteLesson04Blocks]) {
    const stages = buildLessonStages(source);
    const keys = stages.flatMap((stage) => stage.blocks.map((item) => item.blockKey));
    assert.deepEqual(keys, source.map((item) => item.blockKey));
    assert.equal(stages.every((stage) => stage.blocks.length > 0), true);
    const tool = source.find((item) => item.data.type === "TOOL" || item.data.type === "CHECKPOINT");
    if (tool) assert.equal(keys.filter((key) => key === tool.blockKey).length, 1);
  }
  assert.equal(siteLesson04Blocks.some((item) => item.data.type === "TOOL"), true);
  assert.equal(lesson03Blocks.some((item) => item.data.type === "CHECKPOINT"), true);
});

test("a sala não duplica interação, não cria rota de etapa e não muda o contrato de conclusão", () => {
  const reader = readFileSync(new URL("../src/components/learning/LessonReader.tsx", import.meta.url), "utf8");
  const rail = readFileSync(new URL("../src/components/learning/LessonStageRail.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/app/(learn)/aulas/[slug]/page.tsx", import.meta.url), "utf8");
  assert.equal((reader.match(/<BlockView/g) ?? []).length, 1);
  assert.equal(reader.includes("DesktopLesson"), false);
  assert.equal(reader.includes("MobileLesson"), false);
  assert.match(reader, /hidden=\{stage\.id !== activeStage\?\.id\}/);
  assert.match(reader, /defaultValue=\{text\}/);
  assert.match(rail, /aria-current=\{current \? "step" : undefined\}/);
  assert.match(reader, /prefers-reduced-motion: reduce/);
  assert.match(reader, /tabIndex=\{-1\}/);
  assert.match(reader, /Revisar pendências/);
  assert.match(reader, /Você chegou ao final do conteúdo/);
  assert.match(reader, /Aula concluída/);
  assert.match(reader, /Etapa \{activeIndex \+ 1\} de \{stages\.length\}/);
  assert.equal(reader.includes("completedAt"), false);
  assert.equal(reader.includes("/etapa/"), false);
  assert.equal(page.includes("canReadLessonBody"), true);
  assert.match(page, /resume=\{query\.continuar === "1"\}/);
  const wireframe = readFileSync(new URL("../src/components/learning/LandingPageWireframeTool.tsx", import.meta.url), "utf8");
  assert.match(wireframe, /Processando\.\.\./);
  assert.match(wireframe, /aria-busy=\{pending\}/);
  assert.match(wireframe, /generating\.current/);
  const showStage = reader.slice(reader.indexOf("function showStage"), reader.indexOf("function onCheckpoint"));
  const sameStage = showStage.indexOf("stageId === activeStageId");
  const lock = showStage.indexOf("jumpLock.current = true");
  const activate = showStage.indexOf("setChosenStageId(stageId)");
  const guardReturn = showStage.indexOf("return", sameStage);
  assert.ok(sameStage >= 0 && guardReturn > sameStage && lock > guardReturn && activate > lock);
  assert.equal(showStage.includes("saveViewedBlocks"), false);
  assert.equal(showStage.includes("markViewed"), false);
  assert.equal(showStage.includes("readingKeysFromUserScroll"), false);
  assert.match(reader, /if \(jumpLock\.current\) \{\s*scheduleJumpRelease\(\);\s*return;\s*\}/);
});
