import { spawn } from "node:child_process";

if (process.env.MP_LIVE_TEST !== "1" || process.env.SHARED_DATABASE_TEST_CONFIRM !== "true") {
  console.error("O teste live do Mercado Pago exige MP_LIVE_TEST=1 e SHARED_DATABASE_TEST_CONFIRM=true.");
  process.exit(1);
}

if (process.env.MERCADO_PAGO_ENV === "production") {
  console.error("A suíte live não usa credencial de production.");
  process.exit(1);
}

const env: NodeJS.ProcessEnv = { ...process.env };
delete env.UNIT_TEST_ISOLATION;

const child = spawn("npx", ["tsx", "--test", "tests/mercado-pago.live.test.ts"], {
  stdio: "inherit",
  shell: true,
  env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
