-- Reserva atômica de intenções de IA. Não guarda prompt nem resposta.

CREATE TABLE "ai_operation_reservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerDispatched" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ai_operation_reservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_operation_reservation_scope_key" ON "ai_operation_reservation"("userId", "featureKey", "idempotencyKey");

CREATE INDEX "ai_operation_reservation_status_expiresAt_idx" ON "ai_operation_reservation"("status", "expiresAt");

CREATE INDEX "ai_operation_reservation_expiresAt_idx" ON "ai_operation_reservation"("expiresAt");

CREATE INDEX "ai_operation_reservation_requestId_idx" ON "ai_operation_reservation"("requestId");

ALTER TABLE "ai_operation_reservation" ADD CONSTRAINT "ai_operation_reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
