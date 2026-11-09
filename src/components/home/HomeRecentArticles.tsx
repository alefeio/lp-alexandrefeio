import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { Container } from "@/components/ui/Container";
import { TrackedLink } from "@/components/ui/TrackedLink";
import { navigationLinkClass } from "@/lib/button-styles";
import { publicHomeCopy } from "@/lib/home/public-home";
import type { PublishedBlogCard } from "@/lib/blog/service";

export function HomeRecentArticles({ posts }: { posts: PublishedBlogCard[] }) {
  if (posts.length === 0) return null;

  return (
    <section aria-labelledby="home-blog-heading" className="border-t border-border py-16 sm:py-20">
      <Container>
        <div className="max-w-3xl">
          <h2 id="home-blog-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {publicHomeCopy.blogTitle}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted">{publicHomeCopy.blogSupport}</p>
        </div>
        <ul
          className={
            posts.length >= 3
              ? "mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
              : posts.length === 2
                ? "mt-10 grid gap-8 sm:grid-cols-2"
                : "mt-10 grid gap-8 sm:grid-cols-1 sm:max-w-xl"
          }
        >
          {posts.map((post) => (
            <li key={post.slug} className="min-w-0">
              <BlogPostCard post={post} headingLevel="h3" />
            </li>
          ))}
        </ul>
        <p className="mt-10">
          <TrackedLink
            href="/blog"
            className={navigationLinkClass()}
            event="cta_click"
            params={{ cta_name: "home_ver_blog", cta_location: "home_blog", destination_type: "blog" }}
          >
            {publicHomeCopy.blogCta}
          </TrackedLink>
        </p>
      </Container>
    </section>
  );
}
