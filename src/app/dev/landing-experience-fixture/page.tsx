import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { LandingPageRenderer } from "@/components/landing-page/LandingPageRenderer";
import { ResponsivePreviewFrame } from "@/components/landing-page/ResponsivePreviewFrame";
import { experienceReviewFixture, landingExperienceFixtureEnabled } from "@/lib/landing-page/experience/fixture";

export const metadata: Metadata = {
  title: "Fixture de experiência",
  robots: { index: false, follow: false },
};

export default async function LandingExperienceFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ viewport?: string }>;
}) {
  if (!landingExperienceFixtureEnabled()) notFound();
  const params = await searchParams;
  const viewport = params.viewport === "MOBILE_SMALL" || params.viewport === "MOBILE" || params.viewport === "TABLET" || params.viewport === "DESKTOP"
    ? params.viewport
    : "MOBILE";
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "127.0.0.1:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const { document, media } = experienceReviewFixture();
  const localMedia = media.map((item) => ({ ...item, publicUrl: `${proto}://${host}/experience-fixture.png` }));
  return (
    <main className="mx-auto w-full max-w-[1360px] px-4 py-6" data-experience-fixture="true">
      <h1 className="text-lg font-semibold">Fixture de experiência</h1>
      <p className="mt-2 text-sm text-muted">Página sintética, sem projeto gravado e sem publicação.</p>
      <div className="mt-6">
        <ResponsivePreviewFrame
          initialMode="REVIEW"
          initialViewport={viewport}
          sections={document.sections.filter((section) => section.enabled).map((section) => ({ id: section.id, type: section.type }))}
        >
          <LandingPageRenderer document={document} mode="PREVIEW" media={localMedia} />
        </ResponsivePreviewFrame>
      </div>
    </main>
  );
}
