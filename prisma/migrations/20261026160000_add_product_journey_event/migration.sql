-- Eventos estratégicos da jornada. Não altera pedido, progresso, diagnóstico, acesso nem landing page.

CREATE TABLE "journey_event" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousId" TEXT,
    "sessionId" TEXT,
    "courseSlug" TEXT,
    "lessonSlug" TEXT,
    "sourceCourseSlug" TEXT,
    "targetCourseSlug" TEXT,
    "scenario" TEXT,
    "ctaName" TEXT,
    "sourcePath" TEXT,
    "targetPath" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "leadSource" TEXT,
    "leadMedium" TEXT,
    "landingPath" TEXT,
    "referrerHost" TEXT,
    "consentUpdatedAt" TIMESTAMP(3),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journey_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "journey_event_eventId_key" ON "journey_event"("eventId");

CREATE INDEX "journey_event_eventName_occurredAt_idx" ON "journey_event"("eventName", "occurredAt");

CREATE INDEX "journey_event_userId_occurredAt_idx" ON "journey_event"("userId", "occurredAt");

CREATE INDEX "journey_event_anonymousId_occurredAt_idx" ON "journey_event"("anonymousId", "occurredAt");

CREATE INDEX "journey_event_courseSlug_eventName_occurredAt_idx" ON "journey_event"("courseSlug", "eventName", "occurredAt");

ALTER TABLE "journey_event" ADD CONSTRAINT "journey_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
