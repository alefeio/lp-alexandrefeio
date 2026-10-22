import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExperienceLessonHarness } from "@/app/dev/landing-experience-lesson/harness";
import { landingExperienceFixtureEnabled } from "@/lib/landing-page/experience/fixture";

export const metadata: Metadata = {
  title: "Revisão de experiência",
  robots: { index: false, follow: false },
};

export default function LandingExperienceLessonPage() {
  if (!landingExperienceFixtureEnabled()) notFound();
  return <ExperienceLessonHarness />;
}
