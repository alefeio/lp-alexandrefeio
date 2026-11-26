import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import {
  assertIsolatedCommerceLiveConnection,
  evaluateIsolatedCommerceDatabaseLive,
} from "../src/lib/db/urls";

async function main() {
  if (process.env.SHARED_DATABASE_TEST_CONFIRM !== "true") {
    console.error("test:database-live grava no banco. Confirme com SHARED_DATABASE_TEST_CONFIRM=true.");
    process.exit(1);
  }

  if (process.env.MERCADO_PAGO_ENV === "production") {
    console.error("test:database-live não usa credencial de production.");
    process.exit(1);
  }

  const isolatedCommerce = evaluateIsolatedCommerceDatabaseLive(process.env);
  if (!isolatedCommerce.ok) {
    console.error("[database-live] ABORT — identidade isolada inválida:");
    console.error(isolatedCommerce.message);
    console.error(
      "Exija ISOLATED_COMMERCE_DATABASE_TEST=1, DATABASE_ENV=test e as três URLs (ISOLATED/RUNTIME/POSTGRES) no mesmo Postgres local dedicado. Nenhum teste será executado.",
    );
    process.exit(2);
  }

  try {
    const probed = await assertIsolatedCommerceLiveConnection(process.env);
    console.info("[database-live] identidade viva OK", {
      host: probed.declared.host,
      port: probed.declared.port,
      database: probed.declared.database,
      valueHash12: probed.declared.valueHash12,
      userFingerprint: probed.declared.userFingerprint,
      liveDatabase: probed.live.database,
      liveUser: probed.live.dbUser,
      liveVersion: probed.live.version,
      serverAddr: probed.live.serverAddr,
    });
  } catch (error) {
    console.error("[database-live] ABORT — probe de conexão falhou:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  }

  const filter = (process.env.DATABASE_LIVE_FILTER ?? "").trim().toLowerCase();
  // commerce-isolated: fixtures auto-contidas no Postgres vazio commerce_qa (Gate D / CI).
  // Não inclui seeds de aulas/editorial que exigem catálogo do banco compartilhado.
  const allow =
    filter === "commerce-isolated"
      ? new Set([
          "commerce-concurrency.database.test.ts",
          "commerce-purchase-recovery.database.test.ts",
          "commerce.database.test.ts",
          "commerce-admin-audit.database.test.ts",
          "ai-idempotency.live.test.ts",
        ])
      : null;

  const files = readdirSync("tests/database-live")
    .filter((name) => name.endsWith(".test.ts"))
    .filter((name) => (allow ? allow.has(name) : true))
    .map((name) => `tests/database-live/${name}`);

  if (files.length === 0) {
    console.error("Nenhum teste de banco encontrado.");
    process.exit(1);
  }
  console.info("[database-live] arquivos", { filter: filter || "all", count: files.length, files });

  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.UNIT_TEST_ISOLATION;

  const child = spawn("npx", ["tsx", "--test", ...files], {
    stdio: "inherit",
    shell: true,
    env,
  });

  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
