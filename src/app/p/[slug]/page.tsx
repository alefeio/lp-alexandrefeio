import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingPageRenderer } from "@/components/landing-page/LandingPageRenderer";
import { PublicLandingInteractions } from "@/components/landing-page/PublicLandingInteractions";
import { landingPagePublicRuntimeEnabled } from "@/lib/landing-page/publication/gate";
import { publicLandingMetadata } from "@/lib/landing-page/publication/metadata";
import { createPrismaLandingPagePublicationStore } from "@/lib/landing-page/publication/prisma-store";
import { documentFromPublicationSnapshot } from "@/lib/landing-page/publication/snapshot";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!landingPagePublicRuntimeEnabled()) return { robots: { index: false, follow: false } };
  const page = await createPrismaLandingPagePublicationStore().findActiveBySlug(slug);
  if (!page) return { robots: { index: false, follow: false } };
  return publicLandingMetadata(page.publication.snapshot, page.slug);
}

export default async function PublicLandingPage({ params }: PageProps) {
  const { slug } = await params;
  if (!landingPagePublicRuntimeEnabled()) notFound();
  const page = await createPrismaLandingPagePublicationStore().findActiveBySlug(slug);
  if (!page) notFound();
  const document = documentFromPublicationSnapshot(page.publication.snapshot);
  if (!document) {
    return (
      <main>
        <p role="alert" className="px-4 py-8 text-sm">Não foi possível exibir esta landing page.</p>
      </main>
    );
  }
  return (
    <PublicLandingInteractions slug={page.slug}>
      <main>
        <LandingPageRenderer
          document={document}
          mode="PUBLIC"
          publicSlug={page.slug}
          proofs={page.publication.snapshot.trustProofs}
          media={page.publication.snapshot.media.map((item) => ({
            id: item.mediaId,
            status: "READY" as const,
            publicUrl: item.publicUrl,
            width: item.width,
            height: item.height,
            altText: item.altText,
          }))}
        />
      </main>
    </PublicLandingInteractions>
  );
}
