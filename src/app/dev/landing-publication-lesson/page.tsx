import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicationLessonHarness } from "@/app/dev/landing-publication-lesson/harness";
import { createEmptyLandingPageDocument, landingPageDocumentSchema } from "@/lib/landing-page/document";
import { landingExperienceFixtureEnabled } from "@/lib/landing-page/experience/fixture";
import { toPublicationPageView } from "@/lib/landing-page/publication/lesson-flow";
import type { LandingPageProjectRecord } from "@/lib/landing-page/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Publicação sintética",
  robots: { index: false, follow: false },
};

export default function LandingPublicationLessonPage() {
  if (!landingExperienceFixtureEnabled()) notFound();
  const document = landingPageDocumentSchema.parse(createEmptyLandingPageDocument());
  document.sections = [
    {
      id: "hero",
      type: "HERO",
      variant: "default",
      order: 0,
      enabled: true,
      contentStatus: "APPROVED",
      content: { headline: "Página sintética", subheadline: "Somente para revisar a largura." },
      settings: { backgroundRole: "DEFAULT", alignment: "LEFT", emphasis: "NORMAL" },
    },
  ];
  const record: LandingPageProjectRecord = {
    id: "fixture",
    userId: "fixture",
    projectId: null,
    courseId: "course-sites",
    title: "Página sintética",
    slug: "pagina-sintetica",
    status: "READY_TO_PREVIEW",
    draftRevision: 1,
    draftDocument: landingPageDocumentSchema.parse(document),
    publishedPublicationId: null,
    publicationCount: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
  return (
    <PublicationLessonHarness
      page={toPublicationPageView(record, {
        media: [],
        history: [],
        activeVersion: null,
        activeSourceRevision: null,
        runtimeEnabled: false,
      })}
    />
  );
}
