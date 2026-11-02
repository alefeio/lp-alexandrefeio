import { canReadLessonBody } from "@/lib/learning/access";
import { lessonBlockHref } from "@/lib/learning/lesson-hash";

export type StudyDeskArea = "tudo" | "notas" | "revisar";

export type StudyDeskNote = {
  id: string;
  body: string;
  updatedLabel: string;
  courseTitle: string;
  lessonTitle: string;
  sectionTitle: string | null;
  sectionFallback: string | null;
  href: string | null;
  linkLabel: string;
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

function place(record: DeskLessonAccess): Pick<StudyDeskNote, "courseTitle" | "lessonTitle" | "sectionTitle" | "sectionFallback" | "href" | "linkLabel"> {
  if (record.lessonStatus !== "PUBLISHED") {
    return {
      courseTitle: "",
      lessonTitle: "Aula indisponível",
      sectionTitle: null,
      sectionFallback: null,
      href: null,
      linkLabel: "Abrir na aula",
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
    };
  }
  const section = record.sectionTitle;
  return {
    courseTitle: record.courseTitle,
    lessonTitle: record.lessonTitle,
    sectionTitle: section,
    sectionFallback: null,
    href: lessonBlockHref(record.lessonSlug, record.blockKey),
    linkLabel: section ? `Abrir na aula ${record.lessonTitle}, ${section}` : `Abrir na aula ${record.lessonTitle}`,
  };
}

export function studyDeskFromRecords(userId: string, notes: readonly DeskNoteRecord[], reviews: readonly DeskReviewRecord[]): StudyDesk {
  const ownNotes = notes
    .filter((note) => note.userId === userId)
    .slice()
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  const ownReviews = reviews
    .filter((review) => review.userId === userId)
    .slice()
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  return {
    notes: ownNotes.map((note) => ({
      id: note.id,
      body: note.body,
      updatedLabel: `Atualizada em ${formatDeskDate(note.updatedAt)}`,
      ...place(note),
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
