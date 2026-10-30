import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { StudentCourseHub } from "@/components/learning/StudentCourseHub";
import { requireSession } from "@/lib/auth/session";
import { loadStudentCourseHub } from "@/lib/learning/load-student-course-hub";

export const metadata: Metadata = {
  title: "Meus cursos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const session = await requireSession();
  const hub = await loadStudentCourseHub(session.user.id);

  return (
    <Container className="max-w-3xl">
      <StudentCourseHub hub={hub} />
    </Container>
  );
}
