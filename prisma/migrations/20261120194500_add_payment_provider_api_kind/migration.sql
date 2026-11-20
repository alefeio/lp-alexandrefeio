-- Aditivo: identifica Orders API vs Payments API por tentativa.
-- Não executar em Production sem autorização explícita.
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "providerApiKind" TEXT;
