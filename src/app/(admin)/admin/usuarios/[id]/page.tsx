import { notFound } from "next/navigation";
import { UserDetailView } from "@/components/admin/Operations";
import { Container } from "@/components/ui/Container";
import { loadAdminUser } from "@/lib/admin/load-operations";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usuário", robots: { index: false, follow: false } };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return null;
  const { id } = await params;
  const user = await loadAdminUser(id);
  if (!user) notFound();

  return (
    <Container>
      <UserDetailView user={user} />
    </Container>
  );
}
