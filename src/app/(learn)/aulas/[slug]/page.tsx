import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonReader } from "@/components/learning/LessonReader";
import { Container } from "@/components/ui/Container";
import { getSession } from "@/lib/auth/session";
import { canIndexLesson, canReadLessonBody } from "@/lib/learning/access";
import { getPublicLesson, getReaderSnapshot } from "@/lib/learning/catalog";
import { formatPriceCents } from "@/lib/learning/money";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ continuar?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublicLesson(slug);
  if (!page) return { robots: { index: false, follow: false } };
  const indexable = canIndexLesson(page.lesson, page.hasBody);
  return {
    title: page.lesson.title,
    description: page.lesson.summary,
    alternates: { canonical: `/aulas/${page.lesson.slug}` },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function LessonPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const page = await getPublicLesson(slug);
  if (!page) notFound();

  if (!canReadLessonBody(page.lesson) || !page.hasBody) {
    return <LessonGate lesson={page.lesson} hasBody={page.hasBody} />;
  }

  const session = await getSession();
  const initial: LessonSnapshot = session
    ? await getReaderSnapshot(session.user.id, page.lesson.id)
    : emptySnapshot();

  return (
    <LessonReader
      lesson={{
        slug: page.lesson.slug,
        title: page.lesson.title,
        summary: page.lesson.summary,
        estimatedMinutes: page.lesson.estimatedMinutes,
        accessType: page.lesson.accessType,
        courseSlug: page.lesson.courseSlug,
        courseTitle: page.lesson.courseTitle,
        moduleTitle: page.lesson.moduleTitle,
      }}
      blocks={page.blocks}
      initial={initial}
      authenticated={Boolean(session)}
      resume={query.continuar === "1"}
    />
  );
}

function LessonGate({
  lesson,
  hasBody,
}: {
  lesson: {
    title: string;
    summary: string;
    publicPreview: string | null;
    accessType: "FREE" | "PAID";
    priceCents: number | null;
    courseSlug: string;
    courseTitle: string;
    moduleTitle: string;
  };
  hasBody: boolean;
}) {
  const paid = lesson.accessType === "PAID";
  return (
    <Container className="max-w-2xl py-16">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">{lesson.moduleTitle}</p>
      <h1 className="mt-3 text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">{lesson.title}</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">{lesson.summary}</p>
      {lesson.publicPreview ? <p className="mt-4 text-base leading-relaxed">{lesson.publicPreview}</p> : null}
      {paid ? (
        <p className="mt-6 text-sm text-muted">
          {lesson.priceCents != null ? `${formatPriceCents(lesson.priceCents)}. ` : ""}
          Disponível em breve.
        </p>
      ) : null}
      {!paid && !hasBody ? <p className="mt-6 text-sm text-muted">O texto completo desta aula ainda está em preparação.</p> : null}
      <p className="mt-8 text-sm">
        <Link className="underline underline-offset-4" href={`/cursos/${lesson.courseSlug}`}>
          Voltar para {lesson.courseTitle}
        </Link>
      </p>
    </Container>
  );
}

function emptySnapshot(): LessonSnapshot {
  return {
    percent: 0,
    completed: false,
    lastBlockKey: null,
    viewedBlockKeys: [],
    completedBlockKeys: [],
    responses: {},
    notes: {},
    bookmarks: [],
    result: null,
  };
}
