import type { Metadata } from "next";
import { StudentDashboard } from "@/components/app/StudentDashboard";
import { requireSession } from "@/lib/auth/session";
import { loadFirstValueCardForDashboard } from "@/lib/home/load-first-value-card";
import { loadStudentDashboard } from "@/lib/home/load-student-dashboard";

export const metadata: Metadata = {
  title: "Área do aluno",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const session = await requireSession();
  const [view, firstValue] = await Promise.all([
    loadStudentDashboard(session.user.id, session.user.name),
    loadFirstValueCardForDashboard(session.user.id),
  ]);
  return <StudentDashboard view={{ ...view, firstValue }} />;
}
