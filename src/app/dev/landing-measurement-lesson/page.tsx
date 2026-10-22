import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeasurementLessonHarness } from "@/app/dev/landing-measurement-lesson/harness";
import { landingExperienceFixtureEnabled } from "@/lib/landing-page/experience/fixture";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plano de mensuração sintético",
  robots: { index: false, follow: false },
};

export default function LandingMeasurementLessonPage() {
  if (!landingExperienceFixtureEnabled()) notFound();
  return <MeasurementLessonHarness />;
}
