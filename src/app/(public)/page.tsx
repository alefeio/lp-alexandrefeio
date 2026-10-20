import type { Metadata } from "next";
import { CourseHome } from "@/components/home/CourseHome";
import { HomeContinuation } from "@/components/home/HomeContinuation";
import { loadHomeContinuation } from "@/lib/home/load-home-continuation";
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
  const course = await getPublishedCourse(FIRST_COURSE_SLUG);
  const lessons = course?.modules.flatMap((moduleRow) => moduleRow.lessons) ?? [];
  const freeLessonCount = lessons.filter((lesson) => lesson.accessType === "FREE").length;

  let continuation = null;
  if (session?.user.id) {
    const card = await loadHomeContinuation(session.user.id, session.user.name);
    if (homeBelongsToViewer(card.userId, session.user.id)) {
      continuation = <HomeContinuation card={card} />;
    }
  }

  return (
    <CourseHome
      courseTitle={course?.title ?? "Tráfego Pago na Prática para Pequenos Negócios"}
      courseSlug={course?.slug ?? FIRST_COURSE_SLUG}
      lessonCount={lessons.length || 12}
      moduleCount={course?.modules.length || 5}
      freeLessonCount={freeLessonCount}
      continuation={continuation}
    />
  );
}
