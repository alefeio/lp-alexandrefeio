import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { CourseJourney } from "@/components/learning/CourseJourney";
import { requireSession } from "@/lib/auth/session";
import { loadCourseJourney } from "@/lib/learning/load-course-journey";

export const metadata: Metadata = { title: "Jornada do curso" };
export const dynamic = "force-dynamic";

export default async function CourseJourneyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requireSession();
  const view = await loadCourseJourney(session.user.id, slug);
  if (!view) notFound();

  return (
    <Container>
      <CourseJourney view={view} />
    </Container>
  );
}
