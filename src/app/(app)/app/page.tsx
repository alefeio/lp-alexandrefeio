import type { Metadata } from "next";
import { StudentDashboard } from "@/components/app/StudentDashboard";
import { requireSession } from "@/lib/auth/session";
import { loadStudentDashboard } from "@/lib/home/load-student-dashboard";

export const metadata: Metadata = {
  title: "Área do aluno",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const session = await requireSession();
  const view = await loadStudentDashboard(session.user.id, session.user.name);
  return <StudentDashboard view={view} />;
}
