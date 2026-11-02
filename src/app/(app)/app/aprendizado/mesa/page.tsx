import type { Metadata } from "next";
import { StudyDesk } from "@/components/learning/StudyDesk";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { loadStudyDesk } from "@/lib/learning/load-study-desk";
import { parseStudyDeskArea } from "@/lib/learning/study-desk";

export const metadata: Metadata = {
  title: "Mesa de estudo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudyDeskPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const session = await requireSession();
  const query = await searchParams;
  const desk = await loadStudyDesk(session.user.id);

  return (
    <Container className="max-w-3xl">
      <StudyDesk desk={desk} area={parseStudyDeskArea(query.area)} />
    </Container>
  );
}
