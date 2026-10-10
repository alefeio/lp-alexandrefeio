import type { MetadataRoute } from "next";

export type SitemapCourse = { slug: string; updatedAt: Date };
export type SitemapLesson = { slug: string; updatedAt: Date; indexable: boolean };

export function marketingSitemap(origin: string): MetadataRoute.Sitemap {
  return [
    { url: origin, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${origin}/trafego-pago`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/privacidade`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}

export function buildPublicSitemap(
  origin: string,
  input: { courses: SitemapCourse[]; lessons: SitemapLesson[] },
): MetadataRoute.Sitemap {
  const courses = input.courses.map((course) => ({
    url: `${origin}/cursos/${course.slug}`,
    lastModified: course.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  const lessons = input.lessons
    .filter((lesson) => lesson.indexable)
    .map((lesson) => ({
      url: `${origin}/aulas/${lesson.slug}`,
      lastModified: lesson.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  const catalog =
    courses.length > 0
      ? [{ url: `${origin}/cursos`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.6 }]
      : [];

  return [...marketingSitemap(origin), ...catalog, ...courses, ...lessons];
}
