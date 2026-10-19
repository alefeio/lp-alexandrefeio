import { parseBlockData, type LessonBlockData } from "@/lib/learning/blocks";

const MARKERS = ["lorem ipsum", "[placeholder]", "escreva aqui", "texto de exemplo", "todo:"];

export type ReadyBlock = {
  blockKey: string;
  retiredAt: Date | string | null;
  payload: unknown;
};

export type ReadyLesson = {
  title: string;
  summary: string;
  publicPreview: string | null;
  estimatedMinutes: number | null;
  accessType: "FREE" | "PAID";
  status: "DRAFT" | "PUBLISHED";
  priceCents: number | null;
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
};

export type Assessment = { ready: boolean; issues: string[] };

export function assessLesson(lesson: ReadyLesson, blocks: ReadyBlock[]): Assessment {
  const issues: string[] = [];
  if (!lesson.title.trim()) issues.push("Falta o título.");
  if (!lesson.summary.trim()) issues.push("Falta o resumo.");
  if (!lesson.publicPreview?.trim()) issues.push("Falta o preview público.");
  if (!lesson.estimatedMinutes || lesson.estimatedMinutes <= 0) issues.push("Informe os minutos estimados.");
  if (lesson.accessType === "PAID" && (lesson.priceCents == null || lesson.priceCents <= 0)) {
    issues.push("A aula paga precisa de um preço válido.");
  }

  const active = blocks.filter((block) => !block.retiredAt);
  const parsed: LessonBlockData[] = [];
  for (const block of active) {
    const data = parseBlockData(block.payload);
    if (!data) {
      issues.push(`O bloco ${block.blockKey} está inválido.`);
      continue;
    }
    parsed.push(data);
    const marker = markerIn(data);
    if (marker) issues.push(`O bloco ${block.blockKey} ainda tem um placeholder (${marker}).`);
  }

  if (!parsed.some((data) => data.type === "TEXT" || data.type === "EXAMPLE" || data.type === "CALLOUT" || data.type === "ACTIVITY" || data.type === "CHECKLIST")) {
    issues.push("Falta um bloco de conteúdo.");
  }
  if (!parsed.some((data) => data.type === "CONCLUSION")) issues.push("Falta a conclusão.");
  const hasPracticalResult = parsed.some(
    (data) =>
      data.type === "RESULT" ||
      (data.type === "TOOL" &&
        (data.toolKey === "CAMPAIGN_BRIEF_V1" ||
          data.toolKey === "DESTINATION_MEASUREMENT_PLAN_V1" ||
          data.toolKey === "SEARCH_CAMPAIGN_BLUEPRINT_V1" ||
          data.toolKey === "KEYWORD_INTENT_PLAN_V1" ||
          data.toolKey === "RESPONSIVE_SEARCH_AD_PLAN_V1" ||
          data.toolKey === "META_CAMPAIGN_BLUEPRINT_V1")),
  );
  if (lesson.accessType === "PAID" && !hasPracticalResult) {
    issues.push("A aula paga precisa de um bloco de resultado.");
  }
  for (const data of parsed) {
    if (data.type === "CHECKPOINT" && (!data.correctOptionId || !data.explanation)) {
      issues.push("Um checkpoint precisa da opção correta e da explicação.");
    }
    if (data.type === "IMAGE" && data.decorative !== true && !data.alt?.trim()) {
      issues.push("Uma imagem precisa de texto alternativo ou ser marcada como decorativa.");
    }
  }

  return { ready: issues.length === 0, issues: unique(issues) };
}

export function lessonSaleReady(lesson: ReadyLesson, assessment: Assessment): Assessment {
  const issues = [...assessment.issues];
  if (lesson.status !== "PUBLISHED") issues.push("A aula precisa estar publicada.");
  if (lesson.accessType !== "PAID") issues.push("Só uma aula paga pode ir à venda.");
  if (lesson.priceCents == null || lesson.priceCents <= 0) issues.push("Informe um preço válido.");
  return { ready: issues.length === 0, issues: unique(issues) };
}

export function bundleSaleReady(kind: "módulo" | "curso", lessons: Pick<ReadyLesson, "accessType" | "status" | "commerceStatus" | "title">[]): Assessment {
  const paid = lessons.filter((lesson) => lesson.accessType === "PAID");
  if (paid.length === 0) return { ready: false, issues: [`Este ${kind} não tem aula paga.`] };
  const pending = paid.filter((lesson) => lesson.status !== "PUBLISHED" || lesson.commerceStatus !== "AVAILABLE");
  if (pending.length === 0) return { ready: true, issues: [] };
  return {
    ready: false,
    issues: pending.map((lesson) => `${lesson.title} ainda não está publicada e disponível para venda.`),
  };
}

function markerIn(data: LessonBlockData): string | null {
  const texts = collectText(data);
  const found = MARKERS.find((marker) => texts.some((text) => text.toLowerCase().includes(marker)));
  return found ?? null;
}

function collectText(data: LessonBlockData): string[] {
  switch (data.type) {
    case "TEXT":
    case "CONCLUSION":
      return [data.body];
    case "HEADING":
      return [data.text];
    case "CALLOUT":
    case "EXAMPLE":
      return [data.title ?? "", data.body];
    case "CHECKPOINT":
      return [data.question, data.explanation ?? "", ...data.options.map((option) => option.label)];
    case "ACTIVITY":
      return [data.prompt];
    case "CHECKLIST":
      return data.items.map((item) => item.label);
    case "RESULT":
      return [data.title, data.prompt, ...data.fields.map((field) => field.label)];
    case "IMAGE":
      return [data.alt ?? ""];
    case "TOOL":
      return [data.title, data.description];
    default:
      return [];
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
