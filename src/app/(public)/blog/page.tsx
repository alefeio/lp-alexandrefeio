import type { Metadata } from "next";
import { BlogDiscoveryAside } from "@/components/blog/BlogDiscoveryAside";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { Container } from "@/components/ui/Container";
import { BLOG_EMPTY_MESSAGE } from "@/lib/blog/catalog";
import { listPublishedPostCards } from "@/lib/blog/service";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const posts = await listPublishedPostCards();
  return {
    title: "Blog",
    description: "Conteúdo para atrair, converter, medir e melhorar.",
    alternates: { canonical: "/blog" },
    robots: posts.length === 0 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function BlogIndexPage() {
  const posts = await listPublishedPostCards();

  return (
    <Container className="py-16 sm:py-20">
      <div className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Blog</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Conteúdo para atrair, converter, medir e melhorar.</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Artigos práticos para quem precisa decidir o próximo passo de aquisição, página e mensuração.
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="mt-10 text-base text-muted">{BLOG_EMPTY_MESSAGE}</p>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(16rem,3fr)] lg:items-start lg:gap-12">
          <div className="min-w-0">
            <ul className="grid gap-10">
              {posts.map((post, index) => (
                <li key={post.slug} className="border-t border-border pt-8 first:border-t-0 first:pt-0">
                  <BlogPostCard post={post} priority={index === 0} />
                </li>
              ))}
            </ul>
          </div>
          <BlogDiscoveryAside />
        </div>
      )}
    </Container>
  );
}
