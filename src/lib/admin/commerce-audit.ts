import { getPrisma } from "@/lib/db/prisma";

export type AdminAuditAction =
  | "test_account_set"
  | "test_account_clear"
  | "payment_inspect"
  | "payment_reconcile";

export async function writeAdminAuditLog(input: {
  actorUserId: string;
  action: AdminAuditAction;
  targetType: "user" | "payment" | "order";
  targetId: string;
  summary: string;
}) {
  await getPrisma().adminAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      summary: input.summary.slice(0, 500),
    },
  });
}
