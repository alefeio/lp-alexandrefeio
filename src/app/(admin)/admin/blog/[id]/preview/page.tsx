import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/blog/BlogArticle";
import { Container } from "@/components/ui/Container";
import { getBlogPost, relatedPosts } from "@/lib/blog/service";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pré-visualização", robots: { index: false, follow: false } };

export default async function BlogPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return null;
  const { id } = await params;
  const post = await getBlogPost(id);
  if (!post) notFound();
  const related = post.categorySlug ? await relatedPosts(post.slug, post.categorySlug) : [];
  return (
    <Container className="py-4">
      <p className="mb-6 rounded-md border border-border px-3 py-2 text-sm">Pré-visualização. Este endereço não é público.</p>
      <BlogArticle post={post} related={related} />
    </Container>
  );
}
