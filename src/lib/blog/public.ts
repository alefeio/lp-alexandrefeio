import { blogCategoryLabel, blogCtaHref } from "@/lib/blog/catalog";
import { siteConfig } from "@/data/site-config";

export { blogCategoryLabel, blogCtaHref };

export function siteAuthorName() {
  return siteConfig.name;
}
