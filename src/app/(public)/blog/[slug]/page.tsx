import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/blog/BlogArticle";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container } from "@/components/ui/Container";
import { blogMetadata, blogPostingJsonLd } from "@/lib/blog/seo";
import { getPublishedPost, relatedPosts } from "@/lib/blog/service";
import { breadcrumbList } from "@/lib/seo/learning-jsonld";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { robots: { index: false, follow: false } };
  return blogMetadata({
    title: post.title,
    excerpt: post.excerpt,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    path: `/blog/${post.slug}`,
    image: post.coverImageUrl,
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post || !post.publishedAt) notFound();
  const related = await relatedPosts(post.slug, post.categorySlug);
  const path = `/blog/${post.slug}`;
  return (
    <Container className="py-16 sm:py-20">
      <JsonLd data={blogPostingJsonLd({ title: post.title, description: post.seoDescription || post.excerpt, path, publishedAt: post.publishedAt, updatedAt: post.updatedAt, image: post.coverImageUrl })} />
      <JsonLd data={breadcrumbList([{ name: "Início", path: "/" }, { name: "Blog", path: "/blog" }, { name: post.title, path }])} />
      <BlogArticle post={post} related={related} />
    </Container>
  );
}
