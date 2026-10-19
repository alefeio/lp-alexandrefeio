import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { authorizeUpload } from "@/lib/campaign-data/access";
import { CAMPAIGN_DATA_CODES, campaignDataMessage } from "@/lib/campaign-data/errors";
import { CAMPAIGN_DATA_LIMITS } from "@/lib/campaign-data/limits";
import { getPrisma } from "@/lib/db/prisma";

const CONTENT_TYPES = [
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
];

const HUMAN = new Set(CAMPAIGN_DATA_CODES.map((code) => campaignDataMessage(code)));

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
    return NextResponse.json({ error: campaignDataMessage("NOT_FOUND") }, { status: 400 });
  }
  const body = (await request.json()) as HandleUploadPresignedBody;
  try {
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname, clientPayload) => {
        const session = await getSession();
        const payload = JSON.parse(clientPayload || "{}") as { importId?: string };
        const importId = payload.importId ?? "";
        const row = session
          ? await getPrisma().campaignDataImport.findFirst({
              where: { id: importId, userId: session.user.id, status: "PENDING_UPLOAD", rawStoragePath: pathname },
              select: { id: true, projectId: true, userId: true, sizeBytes: true, originalFileName: true, rawStoragePath: true },
            })
          : null;
        const decision = authorizeUpload({
          sessionUserId: session?.user.id ?? null,
          projectOwnerId: row?.userId ?? null,
          projectId: row?.projectId ?? "",
          importId: row?.id ?? "",
          pathname,
          sizeBytes: row?.sizeBytes ?? 0,
          fileName: row?.originalFileName ?? "",
          env: process.env,
        });
        if (!decision.ok || !row || row.rawStoragePath !== pathname) {
          throw new Error(campaignDataMessage(decision.ok ? "NOT_FOUND" : decision.code));
        }
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          validUntil: Date.now() + CAMPAIGN_DATA_LIMITS.uploadGrantMs,
          maximumSizeInBytes: CAMPAIGN_DATA_LIMITS.maxFileBytes,
          allowedContentTypes: CONTENT_TYPES,
        });
        return {
          token,
          urlOptions: {
            maximumSizeInBytes: CAMPAIGN_DATA_LIMITS.maxFileBytes,
            allowedContentTypes: CONTENT_TYPES,
            addRandomSuffix: false,
            allowOverwrite: false,
          },
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error && HUMAN.has(error.message) ? error.message : campaignDataMessage("STORAGE_FAILED");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
