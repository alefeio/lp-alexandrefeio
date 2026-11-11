import { canReadLessonBody } from "@/lib/learning/access";
import { lessonBlockHref } from "@/lib/learning/lesson-hash";

export type StudyDeskArea = "tudo" | "notas" | "revisar";

export type StudyDeskNote = {
  id: string;
  kind: "lesson" | "personal";
  body: string;
  updatedLabel: string;
  courseTitle: string;
  lessonTitle: string;
  sectionTitle: string | null;
  sectionFallback: string | null;
  href: string | null;
  linkLabel: string;
  lessonSlug: string | null;
  blockKey: string | null;
};

export type StudyDeskReview = {
  id: string;
  updatedLabel: string;
  courseTitle: string;
  lessonTitle: string;
  sectionTitle: string | null;
  sectionFallback: string | null;
  href: string | null;
  linkLabel: string;
  lessonSlug: string | null;
  blockKey: string | null;
};

export type StudyDeskResource = {
  title: string;
  description: string;
  href: string;
};

export type StudyDesk = {
  notes: StudyDeskNote[];
  reviews: StudyDeskReview[];
  resources: StudyDeskResource[];
};

export type DeskLessonAccess = {
  userId: string;
  blockKey: string;
  lessonId: string;
  lessonSlug: string;
  lessonTitle: string;
  lessonStatus: "DRAFT" | "PUBLISHED";
  accessType: "FREE" | "PAID";
  entitled: boolean;
  courseTitle: string;
  blockActive: boolean;
  sectionTitle: string | null;
};

export type DeskNoteRecord = DeskLessonAccess & {
  id: string;
  body: string;
  updatedAt: Date;
};

export type DeskReviewRecord = DeskLessonAccess & {
  id: string;
  createdAt: Date;
};

export type DeskPersonalNoteRecord = {
  id: string;
  userId: string;
  body: string;
  updatedAt: Date;
  lessonId: string | null;
  blockKey: string | null;
  lessonSlug: string | null;
  lessonTitle: string | null;
  lessonStatus: "DRAFT" | "PUBLISHED" | null;
  accessType: "FREE" | "PAID" | null;
  entitled: boolean;
  courseTitle: string | null;
  blockActive: boolean;
  sectionTitle: string | null;
};

export const STUDY_DESK_RESOURCES: StudyDeskResource[] = [
  {
    title: "Diagnósticos",
    description: "Veja diagnósticos em andamento e os resultados dos seus projetos.",
    href: "/app/diagnosticos",
  },
  {
    title: "Meu negócio",
    description: "Abra os projetos que guardam o contexto de cada negócio.",
    href: "/app/projetos",
  },
];

const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Belem",
});

export function formatDeskDate(date: Date): string {
  return dateFormat.format(date).replace(".", "").replace(" de ", " ");
}

function place(record: DeskLessonAccess): Pick<
  StudyDeskNote,
  "courseTitle" | "lessonTitle" | "sectionTitle" | "sectionFallback" | "href" | "linkLabel" | "lessonSlug" | "blockKey"
> {
  if (record.lessonStatus !== "PUBLISHED") {
    return {
      courseTitle: "",
      lessonTitle: "Aula indisponível",
      sectionTitle: null,
      sectionFallback: null,
      href: null,
      linkLabel: "Abrir na aula",
      lessonSlug: null,
      blockKey: null,
    };
  }
  const readable = canReadLessonBody(
    { status: record.lessonStatus, accessType: record.accessType },
    { entitled: record.entitled },
  );
  if (!readable) {
    return {
      courseTitle: record.courseTitle,
      lessonTitle: record.lessonTitle,
      sectionTitle: null,
      sectionFallback: null,
      href: `/aulas/${record.lessonSlug}`,
      linkLabel: `Abrir a aula ${record.lessonTitle}`,
      lessonSlug: record.lessonSlug,
      blockKey: null,
    };
  }
  if (!record.blockActive) {
    return {
      courseTitle: record.courseTitle,
      lessonTitle: record.lessonTitle,
      sectionTitle: null,
      sectionFallback: "Trecho da aula atualizado",
      href: `/aulas/${record.lessonSlug}`,
      linkLabel: `Abrir a aula ${record.lessonTitle}`,
      lessonSlug: record.lessonSlug,
      blockKey: null,
    };
  }
  const section = record.sectionTitle;
  return {
    courseTitle: record.courseTitle,
    lessonTitle: record.lessonTitle,
    sectionTitle: section,
    sectionFallback: null,
    href: lessonBlockHref(record.lessonSlug, record.blockKey),
    linkLabel: section ? `Abrir na aula ${record.lessonTitle}, ${section}` : `Abrir a aula ${record.lessonTitle}`,
    lessonSlug: record.lessonSlug,
    blockKey: record.blockKey,
  };
}

function personalPlace(record: DeskPersonalNoteRecord): Pick<
  StudyDeskNote,
  "courseTitle" | "lessonTitle" | "sectionTitle" | "sectionFallback" | "href" | "linkLabel" | "lessonSlug" | "blockKey"
> {
  if (!record.lessonId || !record.lessonSlug) {
    return {
      courseTitle: "",
      lessonTitle: "Nota pessoal",
      sectionTitle: null,
      sectionFallback: null,
      href: null,
      linkLabel: "",
      lessonSlug: null,
      blockKey: null,
    };
  }
  if (!record.blockKey) {
    const published = record.lessonStatus === "PUBLISHED";
    return {
      courseTitle: published ? (record.courseTitle ?? "") : "",
      lessonTitle: published ? (record.lessonTitle ?? "Aula") : "Aula indisponível",
      sectionTitle: null,
      sectionFallback: null,
      href: published ? `/aulas/${record.lessonSlug}` : null,
      linkLabel: published ? `Abrir a aula ${record.lessonTitle ?? ""}`.trim() : "",
      lessonSlug: published ? record.lessonSlug : null,
      blockKey: null,
    };
  }
  return place({
    userId: record.userId,
    blockKey: record.blockKey,
    lessonId: record.lessonId,
    lessonSlug: record.lessonSlug,
    lessonTitle: record.lessonTitle ?? "Aula",
    lessonStatus: record.lessonStatus ?? "DRAFT",
    accessType: record.accessType ?? "PAID",
    entitled: record.entitled,
    courseTitle: record.courseTitle ?? "",
    blockActive: record.blockActive,
    sectionTitle: record.sectionTitle,
  });
}

export function studyDeskFromRecords(
  userId: string,
  notes: readonly DeskNoteRecord[],
  reviews: readonly DeskReviewRecord[],
  personalNotes: readonly DeskPersonalNoteRecord[] = [],
): StudyDesk {
  const ownLessonNotes = notes
    .filter((note) => note.userId === userId)
    .map((note) => ({
      id: note.id,
      kind: "lesson" as const,
      body: note.body,
      updatedAt: note.updatedAt,
      ...place(note),
    }));
  const ownPersonal = personalNotes
    .filter((note) => note.userId === userId)
    .map((note) => ({
      id: note.id,
      kind: "personal" as const,
      body: note.body,
      updatedAt: note.updatedAt,
      ...personalPlace(note),
    }));
  const mergedNotes = [...ownLessonNotes, ...ownPersonal].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  const ownReviews = reviews
    .filter((review) => review.userId === userId)
    .slice()
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  return {
    notes: mergedNotes.map(({ updatedAt: _updatedAt, ...note }) => ({
      ...note,
      updatedLabel: `Atualizada em ${formatDeskDate(_updatedAt)}`,
    })),
    reviews: ownReviews.map((review) => ({
      id: review.id,
      updatedLabel: `Marcado em ${formatDeskDate(review.createdAt)}`,
      ...place(review),
    })),
    resources: STUDY_DESK_RESOURCES,
  };
}

export function parseStudyDeskArea(value: string | undefined): StudyDeskArea {
  if (value === "notas" || value === "revisar") return value;
  return "tudo";
}

export function areaHref(area: StudyDeskArea): string {
  if (area === "tudo") return "/app/aprendizado/mesa";
  return `/app/aprendizado/mesa?area=${area}`;
}
