import type { Metadata } from "next";
import { CourseHome } from "@/components/home/CourseHome";
import { StudentHome } from "@/components/home/StudentHome";
import { loadStudentHome } from "@/lib/home/load-student-home";
import { homeBelongsToViewer, publicHomeMetadata } from "@/lib/home/public-home";
import { getSession } from "@/lib/auth/session";
import { getPublishedCourse } from "@/lib/learning/catalog";
import { FIRST_COURSE_SLUG } from "@/lib/learning/first-course";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: publicHomeMetadata.title,
  description: publicHomeMetadata.description,
  alternates: { canonical: publicHomeMetadata.canonical },
  openGraph: {
    title: publicHomeMetadata.title,
    description: publicHomeMetadata.description,
    url: publicHomeMetadata.canonical,
  },
};

export default async function Home() {
  const session = await getSession();
  if (session?.user.id) {
    const view = await loadStudentHome(session.user.id, session.user.name);
    if (homeBelongsToViewer(view.userId, session.user.id)) return <StudentHome view={view} />;
  }

  const course = await getPublishedCourse(FIRST_COURSE_SLUG);
  const freeLessons =
    course?.modules.flatMap((moduleRow) => moduleRow.lessons).filter((lesson) => lesson.accessType === "FREE") ?? [];

  return (
    <CourseHome
      courseTitle={course?.title ?? "Tráfego Pago na Prática para Pequenos Negócios"}
      coursePriceCents={course?.bundlePriceCents ?? null}
      freeLessons={freeLessons.map((lesson) => ({
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        estimatedMinutes: lesson.estimatedMinutes,
        accessType: lesson.accessType,
      }))}
    />
  );
}
