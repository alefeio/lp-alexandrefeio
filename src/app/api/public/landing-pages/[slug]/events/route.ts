import { createPrismaLandingPageMetricStore } from "@/lib/landing-page/measurement/prisma-store";
import { landingPagePublicRuntimeEnabled } from "@/lib/landing-page/publication/gate";
import { handlePublicLandingEvent } from "@/lib/landing-page/publication/http";
import { createPrismaLandingPagePublicationStore } from "@/lib/landing-page/publication/prisma-store";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!landingPagePublicRuntimeEnabled()) return new Response(null, { status: 404 });
  const params = await context.params;
  return handlePublicLandingEvent(
    {
      publications: createPrismaLandingPagePublicationStore(),
      metrics: createPrismaLandingPageMetricStore(),
    },
    request,
    params,
  );
}
