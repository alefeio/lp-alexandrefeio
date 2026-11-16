import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { evaluateIsolatedCommerceDatabaseLive } from "../src/lib/db/urls";

if (process.env.SHARED_DATABASE_TEST_CONFIRM !== "true") {
  console.error("test:database-live grava no banco. Confirme com SHARED_DATABASE_TEST_CONFIRM=true.");
  process.exit(1);
}

if (process.env.MERCADO_PAGO_ENV === "production") {
  console.error("test:database-live não usa credencial de production.");
  process.exit(1);
}

/**
 * Testes de concorrência comercial NÃO rodam no banco compartilhado.
 * Exigem ISOLATED_COMMERCE_DATABASE_* + DATABASE_ENV=test (ver evaluateIsolatedCommerceDatabaseLive).
 */
const commerceConcurrency = "tests/database-live/commerce-concurrency.database.test.ts";
const isolatedCommerce = evaluateIsolatedCommerceDatabaseLive(process.env);
if (!isolatedCommerce.ok) {
  console.error("[commerce-concurrency] BLOCKED — banco isolado ausente ou inseguro:");
  console.error(isolatedCommerce.message);
  console.error(
    "Plano: criar Postgres dedicado (local Docker ou branch Neon), aplicar migrations, exportar ISOLATED_COMMERCE_DATABASE_URL=RUNTIME_DATABASE_URL=POSTGRES_URL, DATABASE_ENV=test, ISOLATED_COMMERCE_DATABASE_TEST=1; não reutilizar db.prisma.io/postgres.",
  );
  console.error(`Este runner não executará ${commerceConcurrency} sem isolamento verificado.`);
}

const files = readdirSync("tests/database-live")
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => `tests/database-live/${name}`)
  .filter((file) => {
    if (file === commerceConcurrency && !isolatedCommerce.ok) return false;
    return true;
  });

if (files.length === 0) {
  console.error("Nenhum teste de banco elegível para execução.");
  process.exit(1);
}

const env: NodeJS.ProcessEnv = { ...process.env };
delete env.UNIT_TEST_ISOLATION;

const child = spawn("npx", ["tsx", "--test", ...files], {
  stdio: "inherit",
  shell: true,
  env,
});

child.on("exit", (code) => {
  if (!isolatedCommerce.ok) {
    console.error("[commerce-concurrency] resultado: BLOCKED (não executado).");
    // Não mascara falhas dos outros testes; se eles passaram, ainda assim sinaliza bloqueio do gate financeiro.
    process.exit(code === 0 ? 2 : code ?? 1);
  }
  process.exit(code ?? 1);
});
