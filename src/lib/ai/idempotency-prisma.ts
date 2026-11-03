import { getPrisma } from "@/lib/db/prisma";
import type { AiIdempotencyStore, AiOperationReservationRecord, AiOperationStatus } from "@/lib/ai/idempotency";

type Row = {
  id: string;
  userId: string;
  featureKey: string;
  idempotencyKey: string;
  fingerprintHash: string;
  requestId: string;
  status: string;
  providerDispatched: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

function mapRow(row: Row): AiOperationReservationRecord {
  return {
    id: row.id,
    userId: row.userId,
    featureKey: row.featureKey,
    idempotencyKey: row.idempotencyKey,
    fingerprintHash: row.fingerprintHash,
    requestId: row.requestId,
    status: row.status as AiOperationStatus,
    providerDispatched: row.providerDispatched,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}

export function createPrismaAiIdempotencyStore(): AiIdempotencyStore {
  return {
    async tryInsert(record) {
      const prisma = getPrisma();
      const rows = await prisma.$queryRaw<Row[]>`
        INSERT INTO "ai_operation_reservation" (
          "id", "userId", "featureKey", "idempotencyKey", "fingerprintHash", "requestId",
          "status", "providerDispatched", "expiresAt", "createdAt", "updatedAt", "completedAt"
        )
        VALUES (
          ${record.id}, ${record.userId}, ${record.featureKey}, ${record.idempotencyKey},
          ${record.fingerprintHash}, ${record.requestId}, ${record.status}, ${record.providerDispatched},
          ${record.expiresAt}, ${record.createdAt}, ${record.updatedAt}, ${record.completedAt}
        )
        ON CONFLICT ("userId", "featureKey", "idempotencyKey") DO NOTHING
        RETURNING *
      `;
      return rows[0] ? mapRow(rows[0]) : null;
    },
    async findByScope(input) {
      const prisma = getPrisma();
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT * FROM "ai_operation_reservation"
        WHERE "userId" = ${input.userId}
          AND "featureKey" = ${input.featureKey}
          AND "idempotencyKey" = ${input.idempotencyKey}
        LIMIT 1
      `;
      return rows[0] ? mapRow(rows[0]) : null;
    },
    async reclaimFailed(input) {
      const prisma = getPrisma();
      const rows = await prisma.$queryRaw<Row[]>`
        UPDATE "ai_operation_reservation"
        SET
          "status" = 'IN_PROGRESS',
          "requestId" = ${input.requestId},
          "fingerprintHash" = ${input.fingerprintHash},
          "providerDispatched" = false,
          "expiresAt" = ${input.expiresAt},
          "updatedAt" = ${input.now},
          "completedAt" = NULL
        WHERE "userId" = ${input.userId}
          AND "featureKey" = ${input.featureKey}
          AND "idempotencyKey" = ${input.idempotencyKey}
          AND "status" = 'FAILED'
          AND "fingerprintHash" = ${input.fingerprintHash}
        RETURNING *
      `;
      return rows[0] ? mapRow(rows[0]) : null;
    },
    async reclaimExpiredUndispatched(input) {
      const prisma = getPrisma();
      const rows = await prisma.$queryRaw<Row[]>`
        UPDATE "ai_operation_reservation"
        SET
          "status" = 'IN_PROGRESS',
          "requestId" = ${input.requestId},
          "fingerprintHash" = ${input.fingerprintHash},
          "providerDispatched" = false,
          "expiresAt" = ${input.expiresAt},
          "updatedAt" = ${input.now},
          "completedAt" = NULL
        WHERE "userId" = ${input.userId}
          AND "featureKey" = ${input.featureKey}
          AND "idempotencyKey" = ${input.idempotencyKey}
          AND "status" = 'IN_PROGRESS'
          AND "providerDispatched" = false
          AND "fingerprintHash" = ${input.fingerprintHash}
          AND "expiresAt" <= ${input.now}
        RETURNING *
      `;
      return rows[0] ? mapRow(rows[0]) : null;
    },
    async markProviderDispatched(id, now) {
      const prisma = getPrisma();
      await prisma.$executeRaw`
        UPDATE "ai_operation_reservation"
        SET "providerDispatched" = true, "updatedAt" = ${now}
        WHERE "id" = ${id}
      `;
    },
    async markStatus(input) {
      const prisma = getPrisma();
      await prisma.$executeRaw`
        UPDATE "ai_operation_reservation"
        SET
          "status" = ${input.status},
          "updatedAt" = ${input.now},
          "completedAt" = CASE WHEN ${input.status} = 'COMPLETED' THEN ${input.now} ELSE "completedAt" END
        WHERE "id" = ${input.id}
      `;
    },
    async promoteExpiredDispatchedToUnknown(input) {
      const prisma = getPrisma();
      const rows = await prisma.$queryRaw<Row[]>`
        UPDATE "ai_operation_reservation"
        SET "status" = 'UNKNOWN', "updatedAt" = ${input.now}
        WHERE "userId" = ${input.userId}
          AND "featureKey" = ${input.featureKey}
          AND "idempotencyKey" = ${input.idempotencyKey}
          AND "status" = 'IN_PROGRESS'
          AND "providerDispatched" = true
          AND "expiresAt" <= ${input.now}
        RETURNING *
      `;
      return rows[0] ? mapRow(rows[0]) : null;
    },
  };
}
