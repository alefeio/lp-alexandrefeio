import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonReader } from "@/components/learning/LessonReader";
import { Container } from "@/components/ui/Container";
import { requireAdmin } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { parseBlockData } from "@/lib/learning/blocks";
import { previewBlocksFor } from "@/lib/editorial/service";
import type { ReaderBlock } from "@/lib/learning/reader-types";
import { campaignBriefPreviewState } from "@/lib/learning/brief";
import { destinationPlanPreviewState } from "@/lib/learning/measurement";
import { keywordIntentPreviewState } from "@/lib/learning/keyword-plan";
import { leadConversionPreviewState } from "@/lib/learning/lead-conversion-plan";
import { metaCampaignPreviewState } from "@/lib/learning/meta-campaign-plan";
import { responsiveAdPreviewState } from "@/lib/learning/responsive-ad-plan";
import { searchBlueprintPreviewState } from "@/lib/learning/search-campaign";
import { trafficToolPreviewState } from "@/lib/learning/tool";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pré-visualização",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ tela?: string }> };

export default async function LessonPreviewPage({ params, searchParams }: PageProps) {
  const session = await requireAdmin();
  if (!session) return null;
  const { id } = await params;
  const query = await searchParams;
  const lesson = await getPrisma().lesson.findUnique({
    where: { id },
    include: {
      module: { include: { course: true } },
      blocks: { where: { retiredAt: null }, orderBy: { position: "asc" } },
    },
  });
  if (!lesson) notFound();
  const blocks = previewBlocksFor(
    session.user.role,
    lesson.blocks.flatMap((block) => {
      const data = parseBlockData(block.payload);
      if (!data) return [];
      const reader: ReaderBlock = {
        blockKey: block.blockKey,
        position: block.position,
        countsForProgress: block.countsForProgress,
        required: block.required,
        data,
      };
      return [reader];
    }),
  ) as ReaderBlock[];
  const narrow = query.tela === "320";

  return (
    <div className={narrow ? "mx-auto max-w-[320px]" : undefined}>
      <Container className="max-w-3xl pb-0">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Pré-visualização</p>
        <p className="mt-2 text-sm text-muted">Nada desta tela grava progresso nem dispara analytics.</p>
        <p className="mt-2 text-sm">
          <Link className="underline underline-offset-4" href={`/admin/aulas/${lesson.id}/preview`}>Desktop</Link>
          {" · "}
          <Link className="underline underline-offset-4" href={`/admin/aulas/${lesson.id}/preview?tela=320`}>320px</Link>
          {" · "}
          <Link className="underline underline-offset-4" href={`/admin/aulas/${lesson.id}`}>Voltar ao editor</Link>
        </p>
      </Container>
      <LessonReader
        preview
        lesson={{
          slug: lesson.slug,
          title: lesson.title,
          summary: lesson.summary,
          estimatedMinutes: lesson.estimatedMinutes,
          accessType: lesson.accessType,
          courseSlug: lesson.module.course.slug,
          courseTitle: lesson.module.course.title,
          moduleTitle: lesson.module.title,
        }}
        blocks={blocks}
        initial={{ percent: 0, completed: false, lastBlockKey: null, viewedBlockKeys: [], completedBlockKeys: [], responses: {}, notes: {}, bookmarks: [], result: null }}
        authenticated={false}
        resume={false}
        toolPanel={previewToolPanel(blocks)}
      />
    </div>
  );
}

function previewToolPanel(blocks: ReaderBlock[]) {
  const tool = blocks.find((block) => block.data.type === "TOOL");
  const toolKey = tool?.data.type === "TOOL" ? tool.data.toolKey : null;
  if (toolKey === "CAMPAIGN_BRIEF_V1") return campaignBriefPreviewState();
  if (toolKey === "DESTINATION_MEASUREMENT_PLAN_V1") return destinationPlanPreviewState();
  if (toolKey === "SEARCH_CAMPAIGN_BLUEPRINT_V1") return searchBlueprintPreviewState();
  if (toolKey === "KEYWORD_INTENT_PLAN_V1") return keywordIntentPreviewState();
  if (toolKey === "RESPONSIVE_SEARCH_AD_PLAN_V1") return responsiveAdPreviewState();
  if (toolKey === "META_CAMPAIGN_BLUEPRINT_V1") return metaCampaignPreviewState();
  if (toolKey === "META_LEAD_CONVERSION_PLAN_V1") return leadConversionPreviewState();
  return trafficToolPreviewState();
}
