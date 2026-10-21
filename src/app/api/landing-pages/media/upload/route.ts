import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createPrismaLandingPageStore } from "@/lib/landing-page/prisma-store";
import { landingPageMessage } from "@/lib/landing-page/errors";
import { LANDING_PAGE_MEDIA_CONTENT_TYPES, maxBytesForMediaType } from "@/lib/landing-page/media/limits";
import { createPrismaLandingPageMediaStore } from "@/lib/landing-page/media/prisma-store";

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
  const body = (await request.json()) as HandleUploadPresignedBody;
  try {
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname, clientPayload) => {
        const session = await getSession();
        const payload = JSON.parse(clientPayload || "{}") as { mediaId?: string };
        const mediaId = payload.mediaId ?? "";
        const row = session ? await createPrismaLandingPageMediaStore().findById(mediaId) : null;
        const project = row && session
          ? await createPrismaLandingPageStore().findByIdForUser(row.landingPageProjectId, session.user.id)
          : null;
        if (!session || !row || !project || row.userId !== session.user.id || row.status !== "UPLOADING" || row.storageKey !== pathname) {
          throw new Error(landingPageMessage("NOT_FOUND"));
        }
        if (!pathname.startsWith("landing-media/") || pathname.includes("..")) {
          throw new Error(landingPageMessage("LANDING_PAGE_MEDIA_REJECTED"));
        }
        const maximumSizeInBytes = maxBytesForMediaType(row.type);
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          validUntil: Date.now() + 5 * 60 * 1000,
          maximumSizeInBytes,
          allowedContentTypes: [...LANDING_PAGE_MEDIA_CONTENT_TYPES],
        });
        return {
          token,
          urlOptions: {
            maximumSizeInBytes,
            allowedContentTypes: [...LANDING_PAGE_MEDIA_CONTENT_TYPES],
            addRandomSuffix: false,
            allowOverwrite: false,
          },
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch {
    return NextResponse.json({ error: landingPageMessage("LANDING_PAGE_MEDIA_STORAGE") }, { status: 400 });
  }
}
