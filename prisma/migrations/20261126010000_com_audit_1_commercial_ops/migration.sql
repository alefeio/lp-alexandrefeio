-- COM-AUDIT-1: classificação de contas de teste, origem prospectiva de cobrança e audit log admin.
-- Aditivo e retrocompatível. Não executar em Production sem autorização.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isTestAccount" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "user_isTestAccount_idx" ON "user"("isTestAccount");

ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "originChannel" TEXT;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "originCorrelationId" TEXT;
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "originDeviceCategory" TEXT;

CREATE TABLE IF NOT EXISTS "admin_audit_log" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_audit_log_createdAt_idx" ON "admin_audit_log"("createdAt");
CREATE INDEX IF NOT EXISTS "admin_audit_log_targetType_targetId_idx" ON "admin_audit_log"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "admin_audit_log_actorUserId_createdAt_idx" ON "admin_audit_log"("actorUserId", "createdAt");
