-- Token de geração (fencing) para invalidar operações de gerações anteriores após reclaim.

ALTER TABLE "ai_operation_reservation" ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 1;
