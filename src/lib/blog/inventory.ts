import { extractHeadings } from "@/lib/blog/rules";

export type InventoryPost = {
  logicalId: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  status: "PUBLISHED" | "DRAFT";
  publishedAt: string | null;
  headings: string[];
  cta: string;
  seoTitle: string;
  seoDescription: string;
};

export type InventoryIdea = {
  logicalId: string;
  title: string;
  angle: string;
  category: string;
  status: string;
  contentRole: string;
  searchIntent: string;
};

export type EditorialInventory = {
  published: InventoryPost[];
  drafts: InventoryPost[];
  planned: InventoryIdea[];
  dismissed: InventoryIdea[];
};

export function buildEditorialInventory(input: {
  posts: Array<{
    slug: string;
    title: string;
    excerpt: string;
    categorySlug: string;
    status: "PUBLISHED" | "DRAFT";
    publishedAt: Date | null;
    contentMarkdown: string;
    ctaKey: string;
    seoTitle: string | null;
    seoDescription: string | null;
  }>;
  ideas: Array<{
    id: string;
    title: string;
    angle: string;
    categorySlug: string;
    status: string;
    contentRole: string;
    searchIntent: string;
  }>;
}): EditorialInventory {
  const posts = input.posts.map((post) => ({
    logicalId: post.slug,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.categorySlug,
    status: post.status,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    headings: extractHeadings(post.contentMarkdown).slice(0, 12),
    cta: post.ctaKey,
    seoTitle: post.seoTitle ?? "",
    seoDescription: post.seoDescription ?? "",
  }));
  const ideas = input.ideas.map((idea) => ({
    logicalId: idea.title,
    title: idea.title,
    angle: idea.angle,
    category: idea.categorySlug,
    status: idea.status,
    contentRole: idea.contentRole,
    searchIntent: idea.searchIntent,
  }));
  return {
    published: posts.filter((post) => post.status === "PUBLISHED"),
    drafts: posts.filter((post) => post.status === "DRAFT"),
    planned: ideas.filter((idea) => idea.status === "PLANNED" || idea.status === "DRAFTED" || idea.status === "SUGGESTED"),
    dismissed: ideas.filter((idea) => idea.status === "DISMISSED"),
  };
}

export function coverageSnapshot(inventory: EditorialInventory) {
  const categories = ["trafego-pago", "sites-landing-pages", "aquisicao-conversao"];
  return {
    published: inventory.published.length,
    drafts: inventory.drafts.length,
    planned: inventory.planned.length,
    dismissed: inventory.dismissed.length,
    byCategory: categories.map((slug) => ({
      slug,
      published: inventory.published.filter((post) => post.category === slug).length,
      drafts: inventory.drafts.filter((post) => post.category === slug).length,
    })),
  };
}
