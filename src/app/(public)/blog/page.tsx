import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { BLOG_EMPTY_MESSAGE, blogCategoryLabel } from "@/lib/blog/catalog";
import { readingTimeMinutes } from "@/lib/blog/rules";
import { listPublishedPosts } from "@/lib/blog/service";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const posts = await listPublishedPosts();
  return {
    title: "Blog",
    description: "Conteúdo para atrair, converter, medir e melhorar.",
    alternates: { canonical: "/blog" },
    robots: posts.length === 0 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function BlogIndexPage() {
  const posts = await listPublishedPosts();
  const [latest, ...rest] = posts;
  return (
    <Container className="py-16 sm:py-20">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Blog</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">Conteúdo para atrair, converter, medir e melhorar.</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">Artigos práticos para quem precisa decidir o próximo passo de aquisição, página e mensuração.</p>
      {latest ? (
        <article className="mt-10 max-w-3xl border-t border-border pt-8">
          <p className="text-sm text-muted">{blogCategoryLabel(latest.categorySlug)}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            <Link href={`/blog/${latest.slug}`} className="underline-offset-4 hover:underline">{latest.title}</Link>
          </h2>
          <p className="mt-3 leading-relaxed text-muted">{latest.excerpt}</p>
          <p className="mt-3 text-sm text-muted">{latest.publishedAt ? formatDate(latest.publishedAt) : ""} · {readingTimeMinutes(latest.contentMarkdown)} min de leitura</p>
        </article>
      ) : (
        <p className="mt-10 text-base text-muted">{BLOG_EMPTY_MESSAGE}</p>
      )}
      {rest.length > 0 ? (
        <ul className="mt-8 grid gap-6">
          {rest.map((post) => (
            <li key={post.slug} className="max-w-3xl border-t border-border pt-6">
              <p className="text-sm text-muted">{blogCategoryLabel(post.categorySlug)}</p>
              <h2 className="mt-2 text-xl font-semibold">
                <Link href={`/blog/${post.slug}`} className="underline-offset-4 hover:underline">{post.title}</Link>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{post.excerpt}</p>
              <p className="mt-2 text-sm text-muted">{post.publishedAt ? formatDate(post.publishedAt) : ""} · {readingTimeMinutes(post.contentMarkdown)} min de leitura</p>
            </li>
          ))}
        </ul>
      ) : null}
    </Container>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "long", year: "numeric" }).format(value);
}
