import type { LessonBlockData } from "@/lib/learning/blocks";

export type LessonSnapshot = {
  percent: number;
  completed: boolean;
  lastBlockKey: string | null;
  viewedBlockKeys: string[];
  completedBlockKeys: string[];
  responses: Record<string, unknown>;
  notes: Record<string, string>;
  bookmarks: string[];
  result: Record<string, string> | null;
};

export type ReaderBlock = {
  blockKey: string;
  position: number;
  countsForProgress: boolean;
  required: boolean;
  data: LessonBlockData;
};

export type ReaderLesson = {
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number | null;
  accessType: "FREE" | "PAID";
  courseSlug: string;
  courseTitle: string;
  moduleTitle: string;
};

