import Link from "next/link";
import { BlogCtaLink } from "@/components/blog/BlogCtaLink";
import { BlogReadingObserver } from "@/components/blog/BlogReadingObserver";
import { MarkdownBody } from "@/components/blog/MarkdownBody";
import { blogArticleClickParams } from "@/lib/blog/clicks";
import { blogCategoryLabel, blogCtaHref, siteAuthorName } from "@/lib/blog/public";
import { readingTimeMinutes } from "@/lib/blog/rules";
import { buttonClass } from "@/lib/button-styles";

export type BlogArticleModel = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentMarkdown: string;
  categorySlug: string;
  ctaKey: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
};

export function BlogArticle({ post, related }: { post: BlogArticleModel; related: Array<{ slug: string; title: string; excerpt: string }> }) {
  const cta = blogCtaHref(post.ctaKey);
  const ctaParams = blogArticleClickParams({ slug: post.slug, ctaKey: post.ctaKey });
  const published = post.publishedAt ? formatBlogDate(post.publishedAt) : null;
  const updated = formatBlogDate(post.updatedAt);
  return (
    <BlogReadingObserver blogPostId={post.id}>
      <article className="mx-auto w-full max-w-[44rem]">
        <nav aria-label="Trilha" className="text-sm text-muted">
          <Link href="/" className="underline-offset-4 hover:underline">Início</Link>
          <span aria-hidden="true"> / </span>
          <Link href="/blog" className="underline-offset-4 hover:underline">Blog</Link>
          <span aria-hidden="true"> / </span>
          <span>{post.title}</span>
        </nav>
        <p className="mt-6 text-sm text-muted">{blogCategoryLabel(post.categorySlug)}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{post.title}</h1>
        {post.excerpt ? <p className="mt-4 text-lg leading-relaxed text-muted">{post.excerpt}</p> : null}
        <p className="mt-4 text-sm text-muted">
          {published ? `Publicado em ${published}` : "Rascunho"}
          {published && updated !== published ? ` · Atualizado em ${updated}` : ""}
          {` · ${readingTimeMinutes(post.contentMarkdown)} min de leitura`}
        </p>
        {post.coverImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.coverImageUrl} alt={post.coverImageAlt || ""} className="mt-8 aspect-[16/9] w-full rounded-lg object-cover" />
          </>
        ) : null}
        <MarkdownBody markdown={post.contentMarkdown} />
        {cta && ctaParams ? (
          <p className="mt-10">
            <BlogCtaLink href={cta.href} className={buttonClass("primary")} event="cta_click" params={ctaParams}>
              {cta.label}
            </BlogCtaLink>
          </p>
        ) : null}
        <p className="mt-10 text-sm text-muted">Por {siteAuthorName()}</p>
        {related.length > 0 ? (
          <section className="mt-10 border-t border-border pt-6">
            <h2 className="text-lg font-semibold">Continue lendo</h2>
            <ul className="mt-4 space-y-3">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link href={`/blog/${item.slug}`} className="font-medium underline-offset-4 hover:underline">{item.title}</Link>
                  {item.excerpt ? <p className="mt-1 text-sm text-muted">{item.excerpt}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </BlogReadingObserver>
  );
}

function formatBlogDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "long", year: "numeric" }).format(value);
}
