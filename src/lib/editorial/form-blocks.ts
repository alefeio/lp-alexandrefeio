import { blockKeySchema, lessonBlockDataSchema, type LessonBlockData } from "@/lib/learning/blocks";
import { slugify } from "@/lib/editorial/keys";

export function blockFromForm(form: FormData): { ok: true; data: LessonBlockData; blockKey: string } | { ok: false; message: string } {
  const type = String(form.get("type") ?? "");
  const blockKey = String(form.get("blockKey") ?? "").trim();
  if (!blockKeySchema().safeParse(blockKey).success) return { ok: false, message: "A chave do bloco precisa usar letras minúsculas, números e hífen." };
  const data = payload(type, form);
  if (!data.ok) return data;
  const parsed = lessonBlockDataSchema.safeParse(data.data);
  if (!parsed.success) return { ok: false, message: "Revise os campos deste bloco." };
  return { ok: true, data: parsed.data, blockKey };
}

function payload(type: string, form: FormData): { ok: true; data: unknown } | { ok: false; message: string } {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  if (type === "TEXT" || type === "CONCLUSION") return { ok: true, data: { type, body: text("body") } };
  if (type === "HEADING") {
    const level = text("level") === "3" ? 3 : 2;
    return { ok: true, data: { type, text: text("text"), level } };
  }
  if (type === "CALLOUT") return { ok: true, data: { type, title: text("title") || undefined, body: text("body"), tone: tone(text("tone")) } };
  if (type === "EXAMPLE") return { ok: true, data: { type, title: text("title") || undefined, body: text("body") } };
  if (type === "CHECKPOINT") {
    const options = optionLines(text("options"));
    if (!options.ok) return options;
    const correct = Number(text("correct"));
    const correctOptionId = options.items[correct - 1]?.id;
    return {
      ok: true,
      data: {
        type,
        question: text("question"),
        options: options.items,
        correctOptionId,
        explanation: text("explanation") || undefined,
      },
    };
  }
  if (type === "ACTIVITY") {
    return {
      ok: true,
      data: {
        type,
        prompt: text("prompt"),
        inputType: text("inputType") === "long_text" ? "long_text" : "short_text",
        placeholder: text("placeholder") || undefined,
      },
    };
  }
  if (type === "CHECKLIST") {
    const items = optionLines(text("items"));
    if (!items.ok) return items;
    return { ok: true, data: { type, items: items.items } };
  }
  if (type === "RESULT") {
    const fields = text("fields")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((label, index) => ({ key: uniqueKey(slugify(label).slice(0, 30) || `campo-${index + 1}`, index), label }));
    return { ok: true, data: { type, title: text("title"), prompt: text("prompt"), fields } };
  }
  if (type === "TOOL") {
    const toolKey = text("toolKey") === "CAMPAIGN_BRIEF_V1" ? "CAMPAIGN_BRIEF_V1" : "TRAFFIC_READINESS_V1";
    return {
      ok: true,
      data: { type, toolKey, title: text("title"), description: text("description") },
    };
  }
  if (type === "IMAGE") {
    return {
      ok: true,
      data: {
        type,
        url: text("url"),
        alt: text("alt") || undefined,
        decorative: form.get("decorative") === "on",
        publicId: text("publicId") || undefined,
      },
    };
  }
  return { ok: false, message: "Este tipo de bloco não existe." };
}

function tone(value: string): "info" | "warning" | "tip" {
  if (value === "warning" || value === "tip") return value;
  return "info";
}

function optionLines(raw: string): { ok: true; items: { id: string; label: string }[] } | { ok: false; message: string } {
  const labels = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (labels.length === 0) return { ok: false, message: "Informe pelo menos um item, um por linha." };
  const items = labels.map((label, index) => ({ id: uniqueKey(slugify(label).slice(0, 30) || `item-${index + 1}`, index), label }));
  const ids = new Set<string>();
  for (const item of items) {
    let id = item.id;
    let n = 2;
    while (ids.has(id)) id = `${item.id}-${n++}`.slice(0, 40);
    item.id = id;
    ids.add(id);
  }
  return { ok: true, items };
}

function uniqueKey(base: string, index: number): string {
  return base || `item-${index + 1}`;
}
