import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { landingPageMessage } from "@/lib/landing-page/errors";
import { maxBytesForMediaType } from "@/lib/landing-page/media/limits";
import { createPrismaLandingPageMediaStore } from "@/lib/landing-page/media/prisma-store";
import { completeLandingPageMediaUpload } from "@/lib/landing-page/media/service";
import { createLandingPageMediaStorage } from "@/lib/landing-page/media/storage-provider";
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
  const form = await request.formData().catch(() => null);
  const mediaId = form?.get("mediaId");
  const file = form?.get("file");
  if (typeof mediaId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: landingPageMessage("LANDING_PAGE_MEDIA_REJECTED") }, { status: 400 });
  }
  const row = await createPrismaLandingPageMediaStore().findById(mediaId);
  if (!row || row.userId !== session.user.id) {
    return NextResponse.json({ error: landingPageMessage("NOT_FOUND") }, { status: 400 });
  }
  if (file.size > maxBytesForMediaType(row.type)) {
    return NextResponse.json({ error: landingPageMessage("LANDING_PAGE_MEDIA_TOO_LARGE") }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await completeLandingPageMediaUpload(
    createPrismaLandingPageStore(),
    createPrismaLandingPageMediaStore(),
    createLandingPageMediaStorage(),
    { userId: session.user.id, mediaId, bytes },
  );
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json({ id: result.value.id, status: result.value.status });
}
