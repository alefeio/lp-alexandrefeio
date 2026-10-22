import { createPrismaLandingPageMetricStore } from "@/lib/landing-page/measurement/prisma-store";
import { landingPagePublicRouteEnabled } from "@/lib/landing-page/publication/gate";
import { handlePublicLandingEvent } from "@/lib/landing-page/publication/http";
import { consumeLandingPagePublicEventRateLimit } from "@/lib/landing-page/publication/event-rate-limit";
import { createPrismaLandingPagePublicationStore } from "@/lib/landing-page/publication/prisma-store";
import { clientAddressLabel, landingPageAbuseKey } from "@/lib/landing-page/rate-limit/abuse-key";
import { LANDING_PAGE_RATE_POLICIES } from "@/lib/landing-page/rate-limit/policies";
import { landingPageRateLimitSecret } from "@/lib/landing-page/rate-limit/secret";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!landingPagePublicRouteEnabled()) return new Response(null, { status: 404 });
  const secret = landingPageRateLimitSecret();
  if (!secret) return new Response(null, { status: 503 });
  const params = await context.params;
  const now = Date.now();
  const abuseKey = landingPageAbuseKey({
    secret,
    address: clientAddressLabel(request.headers),
    namespace: LANDING_PAGE_RATE_POLICIES.publicEvent.namespace,
    now,
    windowSeconds: LANDING_PAGE_RATE_POLICIES.publicEvent.windowSeconds,
  });
  return handlePublicLandingEvent(
    {
      publications: createPrismaLandingPagePublicationStore(),
      metrics: createPrismaLandingPageMetricStore(),
      consumeEventLimit: (publicationId, at) => consumeLandingPagePublicEventRateLimit({ publicationId, abuseKey }, at),
    },
    request,
    params,
  );
}
