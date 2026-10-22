import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingPageRenderer } from "@/components/landing-page/LandingPageRenderer";
import { landingExperienceFixtureEnabled, experienceReviewFixture } from "@/lib/landing-page/experience/fixture";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Landing pública sintética",
  robots: { index: false, follow: false },
};

export default function LandingPublicationFixturePage() {
  if (!landingExperienceFixtureEnabled()) notFound();
  const fixture = experienceReviewFixture();
  return (
    <main>
      <LandingPageRenderer document={fixture.document} mode="PUBLIC" media={fixture.media} />
    </main>
  );
}
