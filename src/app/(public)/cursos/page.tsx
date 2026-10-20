import type { Metadata } from "next";
import { CourseCatalog } from "@/components/course/CourseCatalog";
import { getSession } from "@/lib/auth/session";
import { loadCourseCatalog } from "@/lib/learning/course-catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cursos",
  description: "Aprenda aplicando em projetos reais, com ferramentas práticas para avançar do conhecimento à execução.",
  alternates: { canonical: "/cursos" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Cursos",
    description: "Aprenda aplicando em projetos reais, com ferramentas práticas para avançar do conhecimento à execução.",
    url: "/cursos",
  },
};

export default async function CoursesPage() {
  const session = await getSession();
  const courses = await loadCourseCatalog(session?.user.id);
  return <CourseCatalog courses={courses} />;
}
