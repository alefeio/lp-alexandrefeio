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
const conclusionBlock = z.object({ type: z.literal("CONCLUSION"), body: text });
const imageBlock = z.object({
  type: z.literal("IMAGE"),
  url: z.string().url().refine((value) => value.startsWith("https://"), "https"),
  alt: z.string().trim().min(1).max(180),
  publicId: z.string().trim().min(1).max(120).optional(),
});

export const lessonBlockDataSchema = z.discriminatedUnion("type", [
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
]);

export type LessonBlockData = z.infer<typeof lessonBlockDataSchema>;

export const checkpointResponseSchema = z.object({ optionId });
export const activityResponseSchema = z.object({ text: z.string().trim().min(1).max(4000) });
export const checklistResponseSchema = z.object({ checkedIds: z.array(optionId).max(12) });
export const resultResponseSchema = z.record(optionId, z.string().trim().max(40));
export const noteBodySchema = z.string().trim().min(1).max(2000);

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
