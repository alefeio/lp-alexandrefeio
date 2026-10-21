import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { landingPageMessage } from "@/lib/landing-page/errors";
import { createPublicLandingPageMediaStorage } from "@/lib/landing-page/media/blob-storage";
import { createPrismaLandingPageMediaStore } from "@/lib/landing-page/media/prisma-store";
import { finalizeLandingPageMediaUpload } from "@/lib/landing-page/media/service";
import { createPrismaLandingPageStore } from "@/lib/landing-page/prisma-store";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: landingPageMessage("NOT_FOUND") }, { status: 400 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: landingPageMessage("NOT_FOUND") }, { status: 401 });
  const body = (await request.json()) as { mediaId?: string };
  const result = await finalizeLandingPageMediaUpload(
    createPrismaLandingPageStore(),
    createPrismaLandingPageMediaStore(),
    createPublicLandingPageMediaStorage(),
    { userId: session.user.id, mediaId: body.mediaId ?? "" },
  );
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json({ id: result.value.id, status: result.value.status });
}
