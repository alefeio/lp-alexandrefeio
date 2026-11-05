import { blogCtaHref } from "@/lib/blog/catalog";

const SAFE = /^[a-z0-9_-]{1,80}$/;

export type BlogClickParams = {
  cta_name: string;
  cta_location: "blog_post" | "blog_index";
  destination_type: "course" | "service";
  blog_post_slug?: string;
};

export function blogArticleClickParams(input: { slug: string; ctaKey: string }): BlogClickParams | null {
  if (!blogCtaHref(input.ctaKey)) return null;
  const slug = input.slug.trim().toLowerCase();
  const ctaName = input.ctaKey.trim().toLowerCase();
  if (!SAFE.test(slug) || !SAFE.test(ctaName)) return null;
  return {
    cta_name: ctaName,
    cta_location: "blog_post",
    destination_type: input.ctaKey === "TRAFFIC_SERVICE" ? "service" : "course",
    blog_post_slug: slug,
  };
}

export function blogIndexClickParams(kind: "courses" | "service"): BlogClickParams {
  if (kind === "service") {
    return { cta_name: "blog_delegar", cta_location: "blog_index", destination_type: "service" };
  }
  return { cta_name: "blog_formacoes", cta_location: "blog_index", destination_type: "course" };
}
