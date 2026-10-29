import { config as loadEnv } from "dotenv";
import { INITIAL_BLOG_IDEAS, INITIAL_BLOG_POSTS } from "../src/lib/blog/seed-catalog";
import { getPrisma } from "../src/lib/db/prisma";
import { readDatabaseEnvLabel } from "../src/lib/db/urls";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

function assertBlogSeedAllowed(env: Record<string, string | undefined> = process.env) {
  if (env.VERCEL_ENV === "production") {
    throw new Error("blog:seed não roda dentro do runtime da Vercel em production.");
  }

  const label = readDatabaseEnvLabel(env);
  if (label === "production") {
    if (env.BLOG_SEED_CONFIRM !== "production") {
      throw new Error("blog:seed com DATABASE_ENV=production exige BLOG_SEED_CONFIRM=production.");
    }
    return;
  }

  if (label === "development") {
    if (env.BLOG_SEED_CONFIRM !== "shared") {
      throw new Error("O banco de development é compartilhado. Confirme com BLOG_SEED_CONFIRM=shared.");
    }
    return;
  }

  if (label === "test") return;
  throw new Error("blog:seed só aceita DATABASE_ENV=development, test ou production confirmado.");
}

async function seed() {
  assertBlogSeedAllowed();
  const prisma = getPrisma();
  const report = {
    postsCreated: 0,
    postsSkipped: 0,
    ideasCreated: 0,
    ideasSkipped: 0,
  };

  for (const post of INITIAL_BLOG_POSTS) {
    const existing = await prisma.blogPost.findFirst({
      where: { OR: [{ id: post.id }, { slug: post.slug }] },
      select: { id: true },
    });
    if (existing) {
      report.postsSkipped += 1;
      continue;
    }

    await prisma.blogPost.create({
      data: {
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        contentMarkdown: post.contentMarkdown,
        categorySlug: post.categorySlug,
        ctaKey: post.ctaKey,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        coverImageUrl: null,
        coverImagePublicId: null,
        coverImageAlt: null,
        status: "DRAFT",
        publishedAt: null,
      },
    });
    report.postsCreated += 1;
  }

  for (const idea of INITIAL_BLOG_IDEAS) {
    const existing = await prisma.blogEditorialIdea.findFirst({
      where: { OR: [{ id: idea.id }, { title: idea.title }] },
      select: { id: true },
    });
    if (existing) {
      report.ideasSkipped += 1;
      continue;
    }

    const relatedPost = await prisma.blogPost.findUnique({
      where: { slug: idea.relatedPostSlug },
      select: { id: true },
    });

    await prisma.blogEditorialIdea.create({
      data: {
        id: idea.id,
        title: idea.title,
        angle: idea.angle,
        categorySlug: idea.categorySlug,
        contentRole: idea.contentRole,
        searchIntent: idea.searchIntent,
        ctaKey: idea.ctaKey,
        status: "PLANNED",
        rationale: idea.rationale,
        relatedPostId: relatedPost?.id ?? null,
        trendStatus: "EVERGREEN",
        trendCheckedAt: null,
        sourceUrls: [],
      },
    });
    report.ideasCreated += 1;
  }

  console.log(JSON.stringify(report));
  await prisma.$disconnect();
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "blog seed failed");
  process.exit(1);
});
