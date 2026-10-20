import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseSales } from "@/components/course/CourseSales";
import { getSession } from "@/lib/auth/session";
import { loadOwnedLessonIds } from "@/lib/commerce/catalog";
import { getPrisma } from "@/lib/db/prisma";
import { courseMetadataDescription } from "@/lib/learning/course-sales-copy";
import { PUBLIC_PREVIEW_TYPES } from "@/lib/learning/public-preview";
import { getPublishedCourse } from "@/lib/learning/catalog";
import { sitesCoursePlannedResultBySlug } from "@/lib/learning/sites-course";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

function metaDescription(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 160) return clean;
  return `${clean.slice(0, 157).trimEnd()}…`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublishedCourse(slug);
  if (!course) return { robots: { index: false, follow: false } };
  const description = metaDescription(courseMetadataDescription(course.slug, course.subtitle, course.description));
  return {
    title: course.title,
    description,
    alternates: { canonical: `/cursos/${course.slug}` },
    openGraph: { title: course.title, description, url: `/cursos/${course.slug}` },
    robots: { index: true, follow: true },
  };
}

export default async function CoursePage({ params }: PageProps) {
  const { slug } = await params;
  const course = await getPublishedCourse(slug);
  if (!course) notFound();

  const prisma = getPrisma();
  const lessonIds = course.modules.flatMap((moduleRow) => moduleRow.lessons.map((lesson) => lesson.id));
  const [previewRows, bodyRows] = await Promise.all([
    prisma.lessonBlock.groupBy({
      by: ["lessonId"],
      where: {
        retiredAt: null,
        isPublicPreview: true,
        type: { in: [...PUBLIC_PREVIEW_TYPES] },
        lessonId: { in: lessonIds },
      },
      _count: { _all: true },
    }),
    prisma.lessonBlock.groupBy({
      by: ["lessonId"],
      where: { retiredAt: null, lessonId: { in: lessonIds } },
      _count: { _all: true },
    }),
  ]);
  const previewIds = new Set(previewRows.filter((row) => row._count._all > 0).map((row) => row.lessonId));
  const bodyIds = new Set(bodyRows.filter((row) => row._count._all > 0).map((row) => row.lessonId));
  const session = await getSession();
  const ownedLessonIds = session ? await loadOwnedLessonIds(session.user.id) : [];

  return (
    <CourseSales
      ownedLessonIds={ownedLessonIds}
      course={{
        id: course.id,
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
        bundlePriceCents: course.bundlePriceCents,
        commerceStatus: course.commerceStatus,
        modules: course.modules.map((moduleRow) => ({
          id: moduleRow.id,
          title: moduleRow.title,
          description: moduleRow.description,
          bundlePriceCents: moduleRow.bundlePriceCents,
          commerceStatus: moduleRow.commerceStatus,
          lessons: moduleRow.lessons.map((lesson) => ({
            id: lesson.id,
            slug: lesson.slug,
            title: lesson.title,
            summary: lesson.summary,
            estimatedMinutes: lesson.estimatedMinutes,
            accessType: lesson.accessType,
            commerceStatus: lesson.commerceStatus,
            priceCents: lesson.priceCents,
            hasPublicPreview: previewIds.has(lesson.id),
            hasBody: bodyIds.has(lesson.id),
            plannedResult: sitesCoursePlannedResultBySlug(lesson.slug),
          })),
        })),
      }}
    />
  );
}
