import type { Metadata } from "next";
import { CourseHome } from "@/components/home/CourseHome";
import { getPublishedCourse } from "@/lib/learning/catalog";
import { FIRST_COURSE_SLUG } from "@/lib/learning/first-course";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aprenda tráfego pago na prática",
  description:
    "Alexandre Feio ensina tráfego pago para aplicar no próprio negócio e também faz a gestão para quem prefere delegar.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Aprenda tráfego pago na prática",
    description:
      "Alexandre Feio ensina tráfego pago para aplicar no próprio negócio e também faz a gestão para quem prefere delegar.",
    url: "/",
  },
};

export default async function Home() {
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
