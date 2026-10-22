import { siteConfig } from "@/data/site-config";
import type { LandingPagePublicationSnapshotV1 } from "@/lib/landing-page/publication/snapshot";

export function publicLandingMetadata(snapshot: LandingPagePublicationSnapshotV1, slug: string) {
  const canonical = `${siteConfig.url}/p/${slug}`;
  return {
    title: snapshot.page.title,
    description: snapshot.page.description,
    robots: { index: false, follow: false },
    alternates: { canonical },
    openGraph: {
      title: snapshot.page.title,
      description: snapshot.page.description,
      url: canonical,
    },
  };
}
