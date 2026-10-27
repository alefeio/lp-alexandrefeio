import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { blogCategoryLabel } from "@/lib/blog/catalog";
import { listAdminPosts } from "@/lib/blog/service";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Blog", robots: { index: false, follow: false } };

export default async function AdminBlogPage() {
  const session = await requireAdmin();
  if (!session) return null;
  const posts = await listAdminPosts();

  return (
    <Container>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Admin</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Blog</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/blog/planejamento" className="underline underline-offset-4">Planejamento</Link>
          <Link href="/admin/blog/novo" className="underline underline-offset-4">Novo artigo</Link>
        </div>
      </div>
      {posts.length === 0 ? <p className="mt-8 text-sm text-muted">Nenhum artigo ainda.</p> : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <caption className="sr-only">Artigos do blog</caption>
            <thead>
              <tr className="border-b border-border text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Título</th>
                <th scope="col" className="px-3 py-2 font-medium">Categoria</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Publicação</th>
                <th scope="col" className="px-3 py-2 font-medium">Atualização</th>
                <th scope="col" className="px-3 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b border-border">
                  <th scope="row" className="py-2 pr-3 font-normal">{post.title}</th>
                  <td className="px-3 py-2">{post.categorySlug ? blogCategoryLabel(post.categorySlug) : "Sem categoria"}</td>
                  <td className="px-3 py-2">{post.status === "PUBLISHED" ? "Publicado" : "Rascunho"}</td>
                  <td className="px-3 py-2">{post.publishedAt ? post.publishedAt.toISOString().slice(0, 10) : "—"}</td>
                  <td className="px-3 py-2">{post.updatedAt.toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/blog/${post.id}`} className="underline underline-offset-4">Editar</Link>
                    {" · "}
                    <Link href={`/admin/blog/${post.id}/preview`} className="underline underline-offset-4">Pré-visualizar</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
