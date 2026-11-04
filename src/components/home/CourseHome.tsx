import type { ReactNode } from "react";
import { ConnectedCourses } from "@/components/home/ConnectedCourses";
import { FreeCourseJourney } from "@/components/home/FreeCourseJourney";
import { HomeAbout } from "@/components/home/HomeAbout";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeRecentArticles } from "@/components/home/HomeRecentArticles";
import { HomeResults } from "@/components/home/HomeResults";
import type { PublishedBlogCard } from "@/lib/blog/service";
import type { CourseCatalogCard } from "@/lib/learning/course-catalog";

export function CourseHome({
  courses,
  continuation = null,
  recentPosts = [],
}: {
  courses: CourseCatalogCard[];
  continuation?: ReactNode;
  recentPosts?: PublishedBlogCard[];
}) {
  return (
    <>
      <HomeHero />
      {continuation}
      <ConnectedCourses courses={courses} />
      <HomeResults courses={courses} />
      <FreeCourseJourney courses={courses} />
      <HomeAbout />
      <HomeRecentArticles posts={recentPosts} />
    </>
  );
}
