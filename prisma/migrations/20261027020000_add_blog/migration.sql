-- Blog editorial. Somente tabelas novas. Não altera jornada, curso, pedido nem landing page.

CREATE TABLE "blog_post" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "contentMarkdown" TEXT NOT NULL DEFAULT '',
    "categorySlug" TEXT NOT NULL DEFAULT '',
    "ctaKey" TEXT NOT NULL DEFAULT 'NONE',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "coverImageUrl" TEXT,
    "coverImagePublicId" TEXT,
    "coverImageAlt" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_post_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_post_slug_key" ON "blog_post"("slug");
CREATE INDEX "blog_post_status_publishedAt_idx" ON "blog_post"("status", "publishedAt");
CREATE INDEX "blog_post_categorySlug_status_idx" ON "blog_post"("categorySlug", "status");

CREATE TABLE "blog_editorial_idea" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "angle" TEXT NOT NULL DEFAULT '',
    "categorySlug" TEXT NOT NULL DEFAULT '',
    "contentRole" TEXT NOT NULL,
    "searchIntent" TEXT NOT NULL,
    "ctaKey" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "rationale" TEXT NOT NULL DEFAULT '',
    "relatedPostId" TEXT,
    "draftPostId" TEXT,
    "trendStatus" TEXT,
    "trendCheckedAt" TIMESTAMP(3),
    "sourceUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_editorial_idea_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "blog_editorial_idea_status_idx" ON "blog_editorial_idea"("status");
CREATE INDEX "blog_editorial_idea_categorySlug_idx" ON "blog_editorial_idea"("categorySlug");
CREATE INDEX "blog_editorial_idea_relatedPostId_idx" ON "blog_editorial_idea"("relatedPostId");
CREATE INDEX "blog_editorial_idea_draftPostId_idx" ON "blog_editorial_idea"("draftPostId");

ALTER TABLE "blog_editorial_idea" ADD CONSTRAINT "blog_editorial_idea_relatedPostId_fkey" FOREIGN KEY ("relatedPostId") REFERENCES "blog_post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blog_editorial_idea" ADD CONSTRAINT "blog_editorial_idea_draftPostId_fkey" FOREIGN KEY ("draftPostId") REFERENCES "blog_post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
