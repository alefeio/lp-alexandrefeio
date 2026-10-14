-- Amostra pública editorial de uma aula paga. O padrão é fechado.
ALTER TABLE "lesson_block" ADD COLUMN "isPublicPreview" BOOLEAN NOT NULL DEFAULT false;
