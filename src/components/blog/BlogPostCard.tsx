import Link from "next/link";
import { BlogCoverImage } from "@/components/blog/BlogCoverImage";
import { blogCategoryLabel } from "@/lib/blog/catalog";
import type { PublishedBlogCard } from "@/lib/blog/service";
import { cn } from "@/lib/cn";

export function BlogPostCard({
  post,
  priority = false,
  headingLevel = "h2",
  className,
}: {
  post: PublishedBlogCard;
  priority?: boolean;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const href = `/blog/${post.slug}`;
  const Heading = headingLevel;
  const category = post.categorySlug ? blogCategoryLabel(post.categorySlug) : null;
  const coverAlt = post.coverImageAlt?.trim() || `Capa: ${post.title}`;

  return (
    <article className={cn("min-w-0", className)}>
      <Link href={href} className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta">
        <BlogCoverImage src={post.coverImageUrl} alt={coverAlt} priority={priority} />
        {category ? <p className="mt-4 text-sm text-muted">{category}</p> : null}
        <Heading className={cn("font-semibold tracking-tight group-hover:underline group-hover:underline-offset-4", category ? "mt-2" : "mt-4", headingLevel === "h2" ? "text-xl sm:text-2xl" : "text-lg sm:text-xl")}>
          {post.title}
        </Heading>
        {post.excerpt ? <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{post.excerpt}</p> : null}
        <p className="mt-3 text-sm font-medium text-cta">Ler artigo</p>
      </Link>
    </article>
  );
}
