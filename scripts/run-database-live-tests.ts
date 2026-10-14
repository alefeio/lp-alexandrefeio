import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";

if (process.env.SHARED_DATABASE_TEST_CONFIRM !== "true") {
  console.error("test:database-live grava no banco compartilhado. Confirme com SHARED_DATABASE_TEST_CONFIRM=true.");
  process.exit(1);
}

if (process.env.MERCADO_PAGO_ENV === "production") {
  console.error("test:database-live não usa credencial de production.");
  process.exit(1);
}

const files = readdirSync("tests/database-live")
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => `tests/database-live/${name}`);

if (files.length === 0) {
  console.error("Nenhum teste de banco encontrado.");
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
  process.exit(code ?? 1);
});
