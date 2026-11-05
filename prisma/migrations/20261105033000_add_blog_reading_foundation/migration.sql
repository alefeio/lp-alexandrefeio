-- Leitura editorial first-party. Não altera jornada, pedido, pagamento, conta nem landing page.
-- Não guarda IP, e-mail, nome, texto digitado, movimento de mouse nem nível de engajamento.

CREATE TABLE "blog_reading_session" (
    "id" TEXT NOT NULL,
    "clientReadingId" TEXT NOT NULL,
    "blogPostId" TEXT,
    "slugObserved" TEXT NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "activeTimeMs" INTEGER NOT NULL DEFAULT 0,
    "maxScrollPercent" INTEGER NOT NULL DEFAULT 0,
    "reachedEndAt" TIMESTAMP(3),
    "referrerHost" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "schemaVersion" INTEGER NOT NULL,
    "consentUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_reading_session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_reading_session_clientReadingId_key" ON "blog_reading_session"("clientReadingId");
CREATE INDEX "blog_reading_session_blogPostId_startedAt_idx" ON "blog_reading_session"("blogPostId", "startedAt");
CREATE INDEX "blog_reading_session_anonymousId_blogPostId_startedAt_idx" ON "blog_reading_session"("anonymousId", "blogPostId", "startedAt");
CREATE INDEX "blog_reading_session_startedAt_idx" ON "blog_reading_session"("startedAt");

CREATE TABLE "blog_commercial_click" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "readingSessionId" TEXT NOT NULL,
    "blogPostId" TEXT,
    "ctaName" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL,
    "targetPath" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_commercial_click_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_commercial_click_eventId_key" ON "blog_commercial_click"("eventId");
CREATE INDEX "blog_commercial_click_blogPostId_occurredAt_idx" ON "blog_commercial_click"("blogPostId", "occurredAt");
CREATE INDEX "blog_commercial_click_readingSessionId_occurredAt_idx" ON "blog_commercial_click"("readingSessionId", "occurredAt");

ALTER TABLE "blog_reading_session" ADD CONSTRAINT "blog_reading_session_blogPostId_fkey" FOREIGN KEY ("blogPostId") REFERENCES "blog_post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blog_commercial_click" ADD CONSTRAINT "blog_commercial_click_readingSessionId_fkey" FOREIGN KEY ("readingSessionId") REFERENCES "blog_reading_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_commercial_click" ADD CONSTRAINT "blog_commercial_click_blogPostId_fkey" FOREIGN KEY ("blogPostId") REFERENCES "blog_post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
