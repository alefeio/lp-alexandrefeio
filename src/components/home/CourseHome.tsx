import type { ReactNode } from "react";
import { ConnectedCourses } from "@/components/home/ConnectedCourses";
import { FreeCourseJourney } from "@/components/home/FreeCourseJourney";
import { HomeAbout } from "@/components/home/HomeAbout";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeResults } from "@/components/home/HomeResults";
import type { CourseCatalogCard } from "@/lib/learning/course-catalog";

export function CourseHome({
  courses,
  continuation = null,
}: {
  courses: CourseCatalogCard[];
  continuation?: ReactNode;
}) {
  return (
    <>
      <HomeHero />
      {continuation}
      <ConnectedCourses courses={courses} />
      <HomeResults courses={courses} />
      <FreeCourseJourney courses={courses} />
      <HomeAbout />
    </>
  );
}
