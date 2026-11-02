import { notFound } from "next/navigation";
import { BlogEditor, type BlogEditorValue } from "@/components/admin/blog/BlogEditor";
import { Container } from "@/components/ui/Container";
import { blogNoticeFeedback, blogNoticeFromQuery } from "@/lib/blog/editor-feedback";
import { getBlogPost } from "@/lib/blog/service";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar artigo", robots: { index: false, follow: false } };

export default async function EditBlogPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const session = await requireAdmin();
  if (!session) return null;
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const post = await getBlogPost(id);
  if (!post) notFound();
  const notice = blogNoticeFromQuery(query.notice);
  const initial: BlogEditorValue = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    contentMarkdown: post.contentMarkdown,
    categorySlug: post.categorySlug,
    ctaKey: post.ctaKey,
    seoTitle: post.seoTitle ?? "",
    seoDescription: post.seoDescription ?? "",
    coverImageAlt: post.coverImageAlt ?? "",
    coverImageUrl: post.coverImageUrl,
    status: post.status,
    slugLocked: Boolean(post.publishedAt),
  };
  return (
    <Container>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Editar artigo</h1>
      <BlogEditor initial={initial} initialFeedback={notice ? blogNoticeFeedback(notice, post.status) : null} />
    </Container>
  );
}
