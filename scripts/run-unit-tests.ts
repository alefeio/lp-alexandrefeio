import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";

const files = readdirSync("tests")
  .filter((name) => name.endsWith(".test.ts") && !name.includes(".live."))
  .map((name) => `tests/${name}`);

const env: NodeJS.ProcessEnv = { ...process.env, UNIT_TEST_ISOLATION: "1" };
delete env.SHARED_DATABASE_TEST_CONFIRM;
for (const key of [
  "COMMERCE_ENABLED",
  "COMMERCE_PRODUCTION_READY",
  "MERCADO_PAGO_ENV",
  "DATABASE_ENV",
  "VERCEL_ENV",
  "LANDING_PAGE_PUBLIC_RUNTIME_ENABLED",
  "LANDING_PAGE_RATE_LIMIT_SECRET",
]) {
  delete env[key];
}

const child = spawn("npx", ["tsx", "--test", ...files], {
  stdio: "inherit",
  shell: true,
  env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
