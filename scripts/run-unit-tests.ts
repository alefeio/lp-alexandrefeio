import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";

const files = readdirSync("tests")
  .filter((name) => name.endsWith(".test.ts") && !name.includes(".live."))
  .map((name) => `tests/${name}`);

const env: NodeJS.ProcessEnv = { ...process.env, UNIT_TEST_ISOLATION: "1" };
delete env.SHARED_DATABASE_TEST_CONFIRM;

const child = spawn("npx", ["tsx", "--test", ...files], {
  stdio: "inherit",
  shell: true,
  env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
