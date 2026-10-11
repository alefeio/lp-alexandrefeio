import { getPrisma } from "@/lib/db/prisma";

export async function hasActiveEntitlement(userId: string, lessonId: string): Promise<boolean> {
  const row = await getPrisma().entitlement.findFirst({
    where: { userId, lessonId, status: "ACTIVE" },
    select: { id: true },
  });
  return Boolean(row);
}
