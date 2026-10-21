import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LandingPageRenderer } from "@/components/landing-page/LandingPageRenderer";
import type { LandingPageResolvedMedia } from "@/components/landing-page/LandingPageRenderer";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { visibleLandingPageSections } from "@/lib/landing-page/order";
import { createPrismaLandingPageMediaStore } from "@/lib/landing-page/media/prisma-store";
import { createPrismaLandingPageStore } from "@/lib/landing-page/prisma-store";
import { getLandingPageProject, type LandingPageProjectView } from "@/lib/landing-page/service";
import type { LandingPageCode } from "@/lib/landing-page/errors";

export const metadata: Metadata = {
  title: "Visualização da landing page",
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<LandingPageProjectView["status"], string> = {
  DRAFT: "Rascunho",
  READY_TO_PREVIEW: "Pronta para visualizar",
  PUBLISHED: "Publicada",
  UNPUBLISHED: "Despublicada",
};

function previewMessage(code: LandingPageCode): string {
  if (code === "UNSUPPORTED_SCHEMA_VERSION" || code === "UNSUPPORTED_REGISTRY_VERSION" || code === "INVALID_DOCUMENT") {
    return "Não foi possível exibir esta landing page.";
  }
  return "Página não encontrada.";
}

export default async function LandingPagePreviewPage({
  params,
}: {
  params: Promise<{ landingPageProjectId: string }>;
}) {
  const session = await requireSession();
  const { landingPageProjectId } = await params;
  let result;
  try {
    result = await getLandingPageProject(createPrismaLandingPageStore(), {
      userId: session.user.id,
      landingPageProjectId,
    });
  } catch {
    return (
      <Container className="max-w-3xl">
        <p role="alert">Não foi possível exibir esta landing page.</p>
      </Container>
    );
  }

  if (!result.ok) {
    if (result.code === "NOT_FOUND") notFound();
    return (
      <Container className="max-w-3xl">
        <p role="alert">{previewMessage(result.code)}</p>
      </Container>
    );
  }

  const page = result.value;
  const visible = visibleLandingPageSections(page.draftDocument.sections);
  let media: LandingPageResolvedMedia[] = [];
  try {
    const rows = await createPrismaLandingPageMediaStore().listForProjectOwner(page.id, session.user.id);
    media = rows
      .filter((row) => row.status === "READY" && row.publicUrl)
      .map((row) => ({
        id: row.id,
        status: row.status,
        publicUrl: row.publicUrl,
        width: row.width,
        height: row.height,
        altText: row.altText,
      }));
  } catch {
    media = [];
  }

  return (
    <Container className="max-w-5xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Visualização da landing page</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{page.title}</p>
      <p className="mt-2 text-sm text-muted">
        {STATUS_LABEL[page.status]} · revisão {page.draftRevision}
      </p>
      <p className="mt-3 text-sm text-muted">Interação desativada no modo de visualização.</p>
      <p className="mt-4">
        <Link className="text-sm underline underline-offset-4" href="/app">
          Voltar
        </Link>
      </p>
      {visible.length === 0 ? <p className="mt-8 text-base">Sua landing page ainda não possui seções.</p> : null}
      <div className="mt-8 overflow-hidden rounded-xl border border-border">
        <LandingPageRenderer document={page.draftDocument} mode="PREVIEW" media={media} />
      </div>
    </Container>
  );
}
