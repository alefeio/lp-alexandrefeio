import type { Metadata } from "next";
import { CourseCatalog } from "@/components/course/CourseCatalog";
import { getSession } from "@/lib/auth/session";
import { catalogPageCopy } from "@/lib/learning/catalog-copy";
import { loadCourseCatalog } from "@/lib/learning/course-catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: catalogPageCopy.eyebrow,
  description: catalogPageCopy.description,
  alternates: { canonical: "/cursos" },
  robots: { index: true, follow: true },
  openGraph: {
    title: catalogPageCopy.eyebrow,
    description: catalogPageCopy.description,
    url: "/cursos",
  },
};

export default async function CoursesPage() {
  const session = await getSession();
  const courses = await loadCourseCatalog(session?.user.id);
  return <CourseCatalog courses={courses} />;
}
