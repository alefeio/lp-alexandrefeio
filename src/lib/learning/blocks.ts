import { z } from "zod";

export const BLOCK_TYPES = [
  "TEXT",
  "HEADING",
  "CALLOUT",
  "EXAMPLE",
  "CHECKPOINT",
  "ACTIVITY",
  "CHECKLIST",
  "RESULT",
  "CONCLUSION",
  "IMAGE",
  "TOOL",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

const blockKey = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);

const text = z.string().trim().min(1).max(8000);
const optionId = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(40);

const textBlock = z.object({ type: z.literal("TEXT"), body: text });
const headingBlock = z.object({
  type: z.literal("HEADING"),
  text: z.string().trim().min(1).max(180),
  level: z.union([z.literal(2), z.literal(3)]),
});
const calloutBlock = z.object({
  type: z.literal("CALLOUT"),
  title: z.string().trim().min(1).max(120).optional(),
  body: text,
  tone: z.enum(["info", "warning", "tip"]),
});
const exampleBlock = z.object({
  type: z.literal("EXAMPLE"),
  title: z.string().trim().min(1).max(120).optional(),
  body: text,
});
const checkpointBlock = z.object({
  type: z.literal("CHECKPOINT"),
  question: z.string().trim().min(1).max(500),
  options: z
    .array(z.object({ id: optionId, label: z.string().trim().min(1).max(240) }))
    .min(2)
    .max(6),
  correctOptionId: optionId.optional(),
  explanation: z.string().trim().min(1).max(1000).optional(),
});
const activityBlock = z.object({
  type: z.literal("ACTIVITY"),
  prompt: z.string().trim().min(1).max(1000),
  inputType: z.enum(["short_text", "long_text"]),
  placeholder: z.string().trim().min(1).max(160).optional(),
});
const checklistBlock = z.object({
  type: z.literal("CHECKLIST"),
  items: z
    .array(z.object({ id: optionId, label: z.string().trim().min(1).max(240) }))
    .min(1)
    .max(12),
});
const resultBlock = z.object({
  type: z.literal("RESULT"),
  title: z.string().trim().min(1).max(160),
  prompt: z.string().trim().min(1).max(1000),
  fields: z
    .array(
      z.object({
        key: optionId,
        label: z.string().trim().min(1).max(80),
      }),
    )
    .min(1)
    .max(8),
});
export const TOOL_KEYS = ["TRAFFIC_READINESS_V1", "CAMPAIGN_BRIEF_V1", "DESTINATION_MEASUREMENT_PLAN_V1", "SEARCH_CAMPAIGN_BLUEPRINT_V1", "KEYWORD_INTENT_PLAN_V1", "RESPONSIVE_SEARCH_AD_PLAN_V1", "META_CAMPAIGN_BLUEPRINT_V1", "META_LEAD_CONVERSION_PLAN_V1", "CAMPAIGN_PERFORMANCE_DIAGNOSIS_V1", "CAMPAIGN_NEXT_ACTION_PLAN_V1", "CONVERSION_JOURNEY_MAP_V1", "DIGITAL_PRESENCE_DECISION_V1", "CONVERSION_PAGE_READINESS_V1", "CONVERSION_PAGE_BRIEF_V1", "VISITOR_DECISION_JOURNEY_V1", "LANDING_PAGE_WIREFRAME_V1", "LANDING_PAGE_COPY_ASSIST_V1", "LANDING_PAGE_VISUAL_DIRECTION_V1"] as const;

const toolBlock = z.object({
  type: z.literal("TOOL"),
  toolKey: z.enum(TOOL_KEYS),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2000),
});
const conclusionBlock = z.object({ type: z.literal("CONCLUSION"), body: text });
const imageBlock = z.object({
  type: z.literal("IMAGE"),
  url: z.string().url().refine((value) => value.startsWith("https://"), "https"),
  alt: z.string().trim().max(180).optional(),
  decorative: z.boolean().optional(),
  publicId: z.string().trim().min(1).max(120).optional(),
});

export const lessonBlockDataSchema = z
  .discriminatedUnion("type", [
    textBlock,
    headingBlock,
    calloutBlock,
    exampleBlock,
    checkpointBlock,
    activityBlock,
    checklistBlock,
    resultBlock,
    conclusionBlock,
    imageBlock,
    toolBlock,
  ])
  .superRefine((data, ctx) => {
    if (data.type === "IMAGE" && data.decorative !== true && !data.alt?.trim()) {
      ctx.addIssue({ code: "custom", message: "Informe o texto alternativo ou marque a imagem como decorativa.", path: ["alt"] });
    }
  });

export type LessonBlockData = z.infer<typeof lessonBlockDataSchema>;

export const RESULT_FIELD_MAX = 200;

export const checkpointResponseSchema = z.object({ optionId });
export const activityResponseSchema = z.object({ text: z.string().trim().min(1).max(4000) });
export const checklistResponseSchema = z.object({ checkedIds: z.array(optionId).max(12) });
export const resultResponseSchema = z.record(optionId, z.string().trim().max(RESULT_FIELD_MAX));
export const toolResponseSchema = z
  .object({
    projectId: z.string().trim().min(1).max(80),
    diagnosticId: z.string().trim().min(1).max(80),
  })
  .strict();
export const noteBodySchema = z.string().trim().min(1).max(2000);

export function resultValuesError(values: Record<string, string>): string | null {
  if (Object.values(values).some((value) => value.trim().length > RESULT_FIELD_MAX)) {
    return `Cada campo do resultado aceita até ${RESULT_FIELD_MAX} caracteres.`;
  }
  if (!resultResponseSchema.safeParse(values).success) return "Resultado inválido.";
  return null;
}

export function parseBlockData(value: unknown): LessonBlockData | null {
  const parsed = lessonBlockDataSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function blockKeySchema() {
  return blockKey;
}

/** O enunciado público não leva a resposta correta. */
export function toPublicBlockData(data: LessonBlockData): LessonBlockData {
  if (data.type !== "CHECKPOINT") return data;
  return {
    type: "CHECKPOINT",
    question: data.question,
    options: data.options,
  };
}
