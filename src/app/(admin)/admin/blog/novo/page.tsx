import { BlogEditor } from "@/components/admin/blog/BlogEditor";
import { Container } from "@/components/ui/Container";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novo artigo", robots: { index: false, follow: false } };

export default async function NewBlogPostPage() {
  const session = await requireAdmin();
  if (!session) return null;
  return (
    <Container>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Novo artigo</h1>
      <BlogEditor />
    </Container>
  );
}
